import type { PrismaClient } from "@prisma/client";
import { ExecucaoStatus } from "../../../core/enums/execucao-status.js";

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
    prisma.execucao.count({ where: { status: ExecucaoStatus.SUCESSO } }),
    prisma.execucao.count({ where: { status: ExecucaoStatus.FALHA } }),
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
