import type { PrismaClient, Tarefa } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
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
    let saidaTipo: "shell" | "noop" = "noop";

    // ── Executa o comando/payload no shell ──
    if (tarefa.comandoOuPayload) {
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
          saidaTipo === "shell"
            ? `**stdout:**\n\`\`\`\n${stdout || "(sem saída)"}\n\`\`\`${stderr ? `\n**stderr:**\n\`\`\`\n${stderr}\n\`\`\`` : ""}`
            : tarefa.comandoOuPayload,
      });
    }

    const duracao = Date.now() - start;
    const saida = JSON.stringify(
      saidaTipo === "shell"
        ? { type: "shell", comando: tarefa.comandoOuPayload, stdout, stderr }
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
