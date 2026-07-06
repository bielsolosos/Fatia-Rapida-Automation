import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ScriptTipo } from "../core/enums/script-tipo.js";
import { scriptStorage } from "../domain/scripts/storage/script-storage.js";
import type { ScriptCreateInput } from "../validators/script.schema.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function extensaoPorTipo(tipo: string): string {
  if (tipo === ScriptTipo.NODEJS) return "js";
  if (tipo === ScriptTipo.PYTHON) return "py";
  return "sh";
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

  await scriptStorage.write(arquivo, input.conteudo);

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
    await scriptStorage.remove(existing.arquivo);
  }

  await scriptStorage.write(novoArquivo, input.conteudo);

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

  await scriptStorage.remove(script.arquivo);
  return prisma.script.delete({ where: { id } });
}
