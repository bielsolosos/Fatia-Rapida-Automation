import type { PrismaClient } from "@prisma/client";
import cron, { type ScheduledTask } from "node-cron";
import type { Logger } from "../../../core/logger/logger.js";
import type { ExecucaoService } from "../../execucoes/service/execucao-service.js";
import { generateCronExpressions } from "./cron-expression-builder.js";

export class SchedulerManager {
  private readonly jobs = new Map<string, ScheduledTask>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly execucao: ExecucaoService,
  ) {}

  private jobKey(tarefaId: string, index: number): string {
    return `${tarefaId}:${index}`;
  }

  async loadAll(): Promise<void> {
    const tarefas = await this.prisma.tarefa.findMany({
      where: { ativo: true },
    });

    let jobCount = 0;
    for (const tarefa of tarefas) {
      const expressions = generateCronExpressions(
        tarefa.diasSemana,
        tarefa.horarios,
      );
      for (let i = 0; i < expressions.length; i++) {
        const key = this.jobKey(tarefa.id, i);
        const task = cron.schedule(
          expressions[i],
          async () => {
            await this.runOne(tarefa.id);
          },
          { timezone: process.env.TZ || "America/Sao_Paulo" },
        );
        this.jobs.set(key, task);
        jobCount++;
      }
    }

    this.logger.info(
      `Scheduler: ${jobCount} cron jobs carregados para ${tarefas.length} tarefas`,
    );
  }

  async scheduleTask(tarefaId: string): Promise<void> {
    const tarefa = await this.prisma.tarefa.findUnique({
      where: { id: tarefaId, ativo: true },
    });
    if (!tarefa) return;

    const expressions = generateCronExpressions(
      tarefa.diasSemana,
      tarefa.horarios,
    );
    for (let i = 0; i < expressions.length; i++) {
      const key = this.jobKey(tarefaId, i);
      if (this.jobs.has(key)) continue;

      const task = cron.schedule(
        expressions[i],
        async () => {
          await this.runOne(tarefaId);
        },
        { timezone: process.env.TZ || "America/Sao_Paulo" },
      );
      this.jobs.set(key, task);
    }
  }

  unscheduleTask(tarefaId: string): void {
    for (const [key, task] of this.jobs.entries()) {
      if (key.startsWith(`${tarefaId}:`)) {
        task.stop();
        this.jobs.delete(key);
      }
    }
  }

  async rescheduleTask(tarefaId: string): Promise<void> {
    this.unscheduleTask(tarefaId);
    await this.scheduleTask(tarefaId);
  }

  getActiveJobCount(): number {
    return this.jobs.size;
  }

  async stopAll(): Promise<void> {
    for (const task of this.jobs.values()) {
      task.stop();
    }
    this.jobs.clear();
  }

  private async runOne(tarefaId: string): Promise<void> {
    try {
      const tarefa = await this.prisma.tarefa.findUnique({
        where: { id: tarefaId },
      });
      if (!tarefa) return;
      this.logger.info(`Executando tarefa "${tarefa.nome}" (${tarefa.id})`);
      await this.execucao.runTask(tarefa);
    } catch (err) {
      this.logger.error(`Erro ao executar tarefa ${tarefaId}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
