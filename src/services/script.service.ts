import type { PrismaClient } from "@prisma/client";
import { spawn } from "child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { ScriptCreateInput } from "../validators/script.schema.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function extensaoPorTipo(tipo: string): string {
  if (tipo === "NODEJS") return "js";
  if (tipo === "PYTHON") return "py";
  return "sh";
}

function executorPorTipo(
  tipo: string,
  filePath: string,
): { cmd: string; args: string[] } {
  if (process.platform === "win32") {
    if (tipo === "NODEJS") return { cmd: "node", args: [filePath] };
    if (tipo === "PYTHON") return { cmd: "python", args: [filePath] };
    // Windows: usa bash (Git Bash) para scripts .sh — cmd.exe abriria janela externa
    // sem capturar output. bash -c merges stderr+stdout via 2>&1.
    return { cmd: "bash", args: ["-c", `"${filePath}" 2>&1`] };
  }
  if (tipo === "NODEJS") return { cmd: "node", args: [filePath] };
  if (tipo === "PYTHON") return { cmd: "python3", args: [filePath] };
  // Linux: bash -c com 2>&1 — merge stderr+stdout na ordem real do terminal
  return { cmd: "bash", args: ["-c", `"${filePath}" 2>&1`] };
}

async function garantirDiretorio(): Promise<void> {
  await fs.mkdir(config.scriptsDir, { recursive: true });
}

async function escreverArquivo(
  arquivo: string,
  conteudo: string,
): Promise<void> {
  await garantirDiretorio();
  const filePath = path.join(config.scriptsDir, arquivo);
  // Normaliza line endings para LF (evita problemas com scripts editados no Windows)
  const conteudoNormalizado = conteudo
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  await fs.writeFile(filePath, conteudoNormalizado, "utf-8");
  // Torna executável no Linux
  if (process.platform !== "win32") {
    await fs.chmod(filePath, 0o755);
  }
}

async function removerArquivo(arquivo: string): Promise<void> {
  try {
    const filePath = path.join(config.scriptsDir, arquivo);
    await fs.unlink(filePath);
  } catch {
    // ignora se arquivo não existir
  }
}

// ── Service Functions ─────────────────────────────────────────────────────────

export async function listScripts(prisma: PrismaClient) {
  return prisma.script.findMany({
    include: { _count: { select: { tarefas: true, execucoes: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getScriptById(prisma: PrismaClient, id: string) {
  return prisma.script.findUnique({
    where: { id },
    include: { _count: { select: { tarefas: true, execucoes: true } } },
  });
}

export async function createScript(
  prisma: PrismaClient,
  input: ScriptCreateInput,
) {
  // Gera ID antecipado para montar nome do arquivo
  const id = randomUUID();
  const ext = extensaoPorTipo(input.tipo);
  const arquivo = `${id}.${ext}`;

  await escreverArquivo(arquivo, input.conteudo);

  return prisma.script.create({
    data: {
      id,
      nome: input.nome,
      descricao: input.descricao || null,
      tipo: input.tipo,
      arquivo,
      conteudo: input.conteudo,
    },
  });
}

export async function updateScript(
  prisma: PrismaClient,
  id: string,
  input: ScriptCreateInput,
) {
  const existing = await prisma.script.findUnique({ where: { id } });
  if (!existing) return null;

  // Se o tipo mudou, remover arquivo antigo e criar novo
  const ext = extensaoPorTipo(input.tipo);
  const novoArquivo = `${id}.${ext}`;

  if (existing.arquivo !== novoArquivo) {
    await removerArquivo(existing.arquivo);
  }

  await escreverArquivo(novoArquivo, input.conteudo);

  return prisma.script.update({
    where: { id },
    data: {
      nome: input.nome,
      descricao: input.descricao || null,
      tipo: input.tipo,
      arquivo: novoArquivo,
      conteudo: input.conteudo,
    },
  });
}

export async function deleteScript(prisma: PrismaClient, id: string) {
  const script = await prisma.script.findUnique({ where: { id } });
  if (!script) return null;

  await removerArquivo(script.arquivo);
  return prisma.script.delete({ where: { id } });
}

// ── Manual Execution ──────────────────────────────────────────────────────────

export interface ExecucaoResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duracao: number;
}

export async function executeScriptManually(
  prisma: PrismaClient,
  scriptId: string,
): Promise<ExecucaoResult> {
  const script = await prisma.script.findUnique({ where: { id: scriptId } });
  if (!script) throw new Error("Script não encontrado");

  const start = Date.now();
  const execucao = await prisma.execucao.create({
    data: { scriptId, status: "EM_ANDAMENTO" },
  });

  const filePath = path.join(config.scriptsDir, script.arquivo);
  const { cmd, args } = executorPorTipo(script.tipo, filePath);

  const result = await new Promise<ExecucaoResult>((resolve) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(cmd, args, {
      timeout: 60_000,
      // cwd = diretório dos scripts: permite que um bash chame outro script pelo nome relativo
      // ex: python3 ./uuid.py  ou  source ./uuid.sh
      cwd: config.scriptsDir,
      env: process.env,
    });

    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("close", (exitCode) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? 1,
        duracao: Date.now() - start,
      });
    });

    proc.on("error", (err) => {
      resolve({
        stdout: "",
        stderr: err.message,
        exitCode: 1,
        duracao: Date.now() - start,
      });
    });
  });

  const status = result.exitCode === 0 ? "SUCESSO" : "FALHA";
  await prisma.execucao.update({
    where: { id: execucao.id },
    data: {
      status,
      saida: JSON.stringify({
        type: "script",
        scriptNome: script.nome,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      }),
      duracao: result.duracao,
    },
  });

  return result;
}
