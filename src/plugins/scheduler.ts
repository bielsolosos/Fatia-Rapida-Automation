import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import cron, { type ScheduledTask } from "node-cron";
import { generateCronExpressions } from "../services/cron.service.js";
import { executeTask } from "../services/execucao.service.js";

declare module "fastify" {
  interface FastifyInstance {
    scheduler: SchedulerManager;
  }
}

interface SchedulerManager {
  loadAll(): Promise<void>;
  scheduleTask(tarefaId: string): Promise<void>;
  unscheduleTask(tarefaId: string): void;
  rescheduleTask(tarefaId: string): Promise<void>;
  getActiveJobCount(): number;
}

export const schedulerPlugin = fp(async (app: FastifyInstance) => {
  // Map: "tarefaId:index" -> ScheduledTask
  const jobs = new Map<string, ScheduledTask>();

  function jobKey(tarefaId: string, index: number): string {
    return `${tarefaId}:${index}`;
  }

  const manager: SchedulerManager = {
    async loadAll() {
      const tarefas = await app.prisma.tarefa.findMany({
        where: { ativo: true },
      });

      let jobCount = 0;
      for (const tarefa of tarefas) {
        const expressions = generateCronExpressions(
          tarefa.diasSemana,
          tarefa.horarios,
        );

        for (let i = 0; i < expressions.length; i++) {
          const key = jobKey(tarefa.id, i);

          const task = cron.schedule(
            expressions[i],
            async () => {
              app.log.info(
                `⏰ Executando tarefa "${tarefa.nome}" (${tarefa.id})`,
              );
              try {
                await executeTask(app.prisma, tarefa);
              } catch (err) {
                app.log.error(err, `Erro ao executar tarefa ${tarefa.id}`);
              }
            },
            { timezone: process.env.TZ || "America/Sao_Paulo" },
          );

          jobs.set(key, task);
          jobCount++;
        }
      }

      app.log.info(
        `📋 Scheduler: ${jobCount} cron jobs carregados para ${tarefas.length} tarefas`,
      );
    },

    async scheduleTask(tarefaId: string) {
      const tarefa = await app.prisma.tarefa.findUnique({
        where: { id: tarefaId, ativo: true },
      });

      if (!tarefa) return;

      const expressions = generateCronExpressions(
        tarefa.diasSemana,
        tarefa.horarios,
      );

      for (let i = 0; i < expressions.length; i++) {
        const key = jobKey(tarefaId, i);
        if (jobs.has(key)) continue;

        const task = cron.schedule(
          expressions[i],
          async () => {
            app.log.info(`⏰ Executando tarefa "${tarefa.nome}" (${tarefaId})`);
            try {
              await executeTask(app.prisma, tarefa);
            } catch (err) {
              app.log.error(err, `Erro ao executar tarefa ${tarefaId}`);
            }
          },
          { timezone: process.env.TZ || "America/Sao_Paulo" },
        );

        jobs.set(key, task);
      }
    },

    unscheduleTask(tarefaId: string) {
      for (const [key, task] of jobs.entries()) {
        if (key.startsWith(`${tarefaId}:`)) {
          task.stop();
          jobs.delete(key);
        }
      }
    },

    async rescheduleTask(tarefaId: string) {
      manager.unscheduleTask(tarefaId);
      await manager.scheduleTask(tarefaId);
    },

    getActiveJobCount() {
      return jobs.size;
    },
  };

  app.decorate("scheduler", manager);

  // Load all jobs on startup
  await manager.loadAll();

  // Cleanup on close
  app.addHook("onClose", async () => {
    app.log.info("Parando todos os cron jobs...");
    for (const task of jobs.values()) {
      task.stop();
    }
    jobs.clear();
  });
});
