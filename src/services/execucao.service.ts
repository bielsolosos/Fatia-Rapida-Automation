import type { PrismaClient, Tarefa } from "@prisma/client";
import { exec, spawn } from "child_process";
import path from "node:path";
import { promisify } from "util";
import { config } from "../config.js";
import { sendDiscordWebhook } from "./webhook.service.js";

const execAsync = promisify(exec);

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/**
 * Executa uma tarefa: cria registro de execução, roda o comando, envia para Discord, salva no banco.
 */
export async function executeTask(
  prisma: PrismaClient,
  tarefa: Tarefa,
): Promise<void> {
  const start = Date.now();

  const execucao = await prisma.execucao.create({
    data: { tarefaId: tarefa.id, status: "EM_ANDAMENTO" },
  });

  let stdout = "";
  let stderr = "";
  let saidaTipo: "shell" | "script" | "noop" = "noop";

  try {
    // ── Se a tarefa tem script vinculado, executa o arquivo ──
    if (tarefa.scriptId) {
      const script = await prisma.script.findUnique({
        where: { id: tarefa.scriptId },
      });

      if (script) {
        console.log(
          `\n[Scheduler] ▶ Tarefa "${tarefa.nome}" via script "${script.nome}"`,
        );
        const filePath = path.join(config.scriptsDir, script.arquivo);

        let cmd: string;
        let args: string[];
        if (process.platform === "win32") {
          if (script.tipo === "NODEJS") {
            cmd = "node";
            args = [filePath];
          } else if (script.tipo === "PYTHON") {
            cmd = "python";
            args = [filePath];
          } else {
            cmd = "bash";
            args = ["-c", `"${filePath}" 2>&1`];
          }
        } else {
          if (script.tipo === "NODEJS") {
            cmd = "node";
            args = [filePath];
          } else if (script.tipo === "PYTHON") {
            cmd = "python3";
            args = [filePath];
          } else {
            cmd = "bash";
            args = ["-c", `"${filePath}" 2>&1`];
          }
        }

        const result = await runCommand(cmd, args, { cwd: config.scriptsDir });

        stdout = result.stdout;
        stderr = result.stderr;
        saidaTipo = "script";

        if (result.exitCode !== 0)
          throw new Error(
            `Script saiu com código ${result.exitCode}`,
          );
      }
    }

    // ── Caso contrário, executa o comando/payload no shell ──
    else if (tarefa.comandoOuPayload) {
      console.log(`\n[Scheduler] ▶ Tarefa "${tarefa.nome}"`);
      console.log(`[Scheduler] $ ${tarefa.comandoOuPayload}`);

      const result = await execAsync(tarefa.comandoOuPayload, {
        timeout: 60_000,
        shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
      });
      stdout = result.stdout.trim();
      stderr = result.stderr.trim();
      saidaTipo = "shell";

      if (stdout) console.log(`[Scheduler] stdout:\n${stdout}`);
      if (stderr) console.error(`[Scheduler] stderr:\n${stderr}`);
    } else {
      console.log(`[Scheduler] ⚠ Tarefa "${tarefa.nome}" sem ação configurada`);
    }

    // ── Envia resultado para Discord (se webhook configurado) ──
    if (tarefa.webhookUrl) {
      const discordPayload = [
        `**Tarefa:** ${tarefa.nome}`,
        tarefa.descricao ? `*${tarefa.descricao}*` : "",
        "",
        "**Saída (stdout):**",
        `\`\`\`\n${stdout || "(sem saída)"}\n\`\`\``,
      ];

      if (stderr) {
        discordPayload.push("**Erro (stderr):**");
        discordPayload.push(`\`\`\`\n${stderr}\n\`\`\``);
      }

      await sendDiscordWebhook(tarefa.webhookUrl, {
        nome: tarefa.nome,
        descricao: tarefa.descricao,
        payload: discordPayload.join("\n"),
      });
    }

    const duracao = Date.now() - start;
    const saida = JSON.stringify({
      type: saidaTipo,
      stdout: stdout || "",
      stderr: stderr || "",
      comando: saidaTipo === "shell" ? tarefa.comandoOuPayload : undefined,
    });

    console.log(`[Scheduler] ✓ "${tarefa.nome}" concluída em ${duracao}ms`);

    await prisma.execucao.update({
      where: { id: execucao.id },
      data: { status: "SUCESSO", saida, duracao },
    });
  } catch (err) {
    const duracao = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(
      `[Scheduler] ✗ Tarefa "${tarefa.nome}" falhou: ${errorMessage}`,
    );

    // Salva o erro mas também tenta manter stdout/stderr se existirem
    await prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: "FALHA",
        saida: JSON.stringify({
          type: saidaTipo,
          error: errorMessage,
          stdout: stdout || "",
          stderr: stderr || "",
        }),
        duracao,
      },
    });
  }
}

/**
 * Função principal que tem como objetivo de ser o executor de scripts Node, Python e Shell.
 *
 * Retorna uma promise com o output tanto positivo quanto negativo desse input
 *
 */
async function runCommand(
  cmd: string,
  args: string[] = [],
  options?: {
    cwd?: string;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
  },
): Promise<CommandResult> {
  return new Promise((resolve) => {
    let out = "";
    let err = "";

    //spawn -> Worker do node que executa comando.
    const proc = spawn(cmd, args, {
      cwd: options?.cwd,
      timeout: options?.timeout ?? 60_000,
      env: options?.env ?? process.env,
    });

    // Buffers para coletarmos o resultado geral do sistema
    proc.stdout.on("data", (d: Buffer) => {
      out += d.toString();
    });

    proc.stderr.on("data", (d: Buffer) => {
      err += d.toString();
    });

    proc.on("close", (code) => {
      resolve({
        stdout: out.trim(),
        stderr: err.trim(),
        exitCode: code ?? 1,
      });
    });

    proc.on("error", (e) => {
      resolve({
        stdout: "",
        stderr: e.message,
        exitCode: 1,
      });
    });
  });
}
