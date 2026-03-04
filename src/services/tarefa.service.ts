import type { PrismaClient } from "@prisma/client";
import type {
  TarefaCreateInput,
  TarefaUpdateInput,
} from "../validators/tarefa.schema.js";

/**
 * Cria uma tarefa com agendamento (diasSemana + horarios na mesma tabela).
 */
export async function createTarefa(
  prisma: PrismaClient,
  input: TarefaCreateInput,
) {
  return prisma.tarefa.create({
    data: {
      nome: input.nome,
      descricao: input.descricao || null,
      comandoOuPayload: input.comandoOuPayload || null,
      webhookUrl: input.webhookUrl || null,
      diasSemana: JSON.stringify(input.diasSemana),
      horarios: JSON.stringify(input.horarios),
      scriptId: input.scriptId ?? null,
    },
  });
}

/**
 * Atualiza uma tarefa.
 */
export async function updateTarefa(
  prisma: PrismaClient,
  id: string,
  input: TarefaUpdateInput,
) {
  return prisma.tarefa.update({
    where: { id },
    data: {
      nome: input.nome,
      descricao: input.descricao || null,
      comandoOuPayload: input.comandoOuPayload || null,
      webhookUrl: input.webhookUrl || null,
      diasSemana: JSON.stringify(input.diasSemana),
      horarios: JSON.stringify(input.horarios),
      scriptId: input.scriptId ?? null,
    },
  });
}

/**
 * Busca tarefa por ID.
 */
export async function getTarefaById(prisma: PrismaClient, id: string) {
  return prisma.tarefa.findUnique({
    where: { id },
    include: {
      script: true,
      _count: { select: { execucoes: true } },
    },
  });
}

/**
 * Lista todas as tarefas com agendamentos.
 */
export async function listTarefas(prisma: PrismaClient) {
  return prisma.tarefa.findMany({
    include: {
      script: { select: { id: true, nome: true } },
      _count: { select: { execucoes: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Toggle ativo/inativo.
 */
export async function toggleTarefa(prisma: PrismaClient, id: string) {
  const tarefa = await prisma.tarefa.findUnique({ where: { id } });
  if (!tarefa) return null;

  return prisma.tarefa.update({
    where: { id },
    data: { ativo: !tarefa.ativo },
  });
}

/**
 * Deleta uma tarefa (cascade deleta agendamentos e execuções).
 */
export async function deleteTarefa(prisma: PrismaClient, id: string) {
  return prisma.tarefa.delete({ where: { id } });
}

/**
 * Busca estatísticas para o dashboard.
 */
export async function getDashboardStats(prisma: PrismaClient) {
  const [
    totalTarefas,
    tarefasAtivas,
    totalExecucoes,
    execucoes24h,
    execucoesSucesso,
    execucoesFalha,
    ultimasExecucoes,
  ] = await Promise.all([
    prisma.tarefa.count(),
    prisma.tarefa.count({ where: { ativo: true } }),
    prisma.execucao.count(),
    prisma.execucao.count({
      where: {
        executadoEm: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.execucao.count({ where: { status: "SUCESSO" } }),
    prisma.execucao.count({ where: { status: "FALHA" } }),
    prisma.execucao.findMany({
      take: 5,
      orderBy: { executadoEm: "desc" },
      include: { tarefa: { select: { nome: true } } },
    }),
  ]);

  const taxaSucesso =
    totalExecucoes > 0
      ? Math.round((execucoesSucesso / totalExecucoes) * 100)
      : 0;

  return {
    totalTarefas,
    tarefasAtivas,
    totalExecucoes,
    execucoes24h,
    execucoesSucesso,
    execucoesFalha,
    taxaSucesso,
    ultimasExecucoes,
  };
}
