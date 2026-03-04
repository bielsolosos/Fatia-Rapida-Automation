import type { PrismaClient, Tarefa } from "@prisma/client";
import { exec, spawn } from "child_process";
import path from "node:path";
import { promisify } from "util";
import { config } from "../config.js";
import { sendDiscordWebhook } from "./webhook.service.js";

const execAsync = promisify(exec);

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

  try {
    let stdout = "";
    let stderr = "";
    let saidaTipo: "shell" | "script" | "noop" = "noop";

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
            // Windows: usa bash (Git Bash) para scripts shell
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
            // Linux/Raspberry Pi: bash com merge de stderr+stdout
            cmd = "bash";
            args = ["-c", `"${filePath}" 2>&1`];
          }
        }

        const result = await new Promise<{
          stdout: string;
          stderr: string;
          exitCode: number;
        }>((resolve) => {
          let out = "";
          let err = "";
          const proc = spawn(cmd, args, {
            timeout: 60_000,
            cwd: config.scriptsDir,
            env: process.env,
          });
          proc.stdout.on("data", (d: Buffer) => (out += d.toString()));
          proc.stderr.on("data", (d: Buffer) => (err += d.toString()));
          proc.on("close", (code) =>
            resolve({
              stdout: out.trim(),
              stderr: err.trim(),
              exitCode: code ?? 1,
            }),
          );
          proc.on("error", (e) =>
            resolve({ stdout: "", stderr: e.message, exitCode: 1 }),
          );
        });
        stdout = result.stdout;
        stderr = result.stderr;
        saidaTipo = "script";

        if (result.exitCode !== 0)
          throw new Error(
            `Script saiu com código ${result.exitCode}\n${stderr}`,
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
      await sendDiscordWebhook(tarefa.webhookUrl, {
        nome: tarefa.nome,
        descricao: tarefa.descricao,
        payload:
          saidaTipo === "shell" || saidaTipo === "script"
            ? `**stdout:**\n\`\`\`\n${stdout || "(sem saída)"}\n\`\`\`${stderr ? `\n**stderr:**\n\`\`\`\n${stderr}\n\`\`\`` : ""}`
            : tarefa.comandoOuPayload,
      });
    }

    const duracao = Date.now() - start;
    const saida = JSON.stringify(
      saidaTipo === "shell"
        ? { type: "shell", comando: tarefa.comandoOuPayload, stdout, stderr }
        : saidaTipo === "script"
          ? { type: "script", stdout, stderr }
          : { type: "noop", message: "Tarefa sem ação configurada" },
    );

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

    await prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: "FALHA",
        saida: JSON.stringify({ error: errorMessage }),
        duracao,
      },
    });
  }
}
