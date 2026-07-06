import type { PrismaClient } from "@prisma/client";
import { ExecucaoStatus } from "../../../core/enums/execucao-status.js";

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async getStats() {
    const [
      totalTarefas,
      tarefasAtivas,
      totalExecucoes,
      execucoes24h,
      execucoesSucesso,
      execucoesFalha,
      ultimasExecucoes,
    ] = await Promise.all([
      this.prisma.tarefa.count(),
      this.prisma.tarefa.count({ where: { ativo: true } }),
      this.prisma.execucao.count(),
      this.prisma.execucao.count({
        where: {
          executadoEm: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.execucao.count({ where: { status: ExecucaoStatus.SUCESSO } }),
      this.prisma.execucao.count({ where: { status: ExecucaoStatus.FALHA } }),
      this.prisma.execucao.findMany({
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
}
