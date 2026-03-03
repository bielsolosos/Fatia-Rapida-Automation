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
  // Map: "tarefaId:agendamentoId:index" -> ScheduledTask
  const jobs = new Map<string, ScheduledTask>();

  function jobKey(
    tarefaId: string,
    agendamentoId: string,
    index: number,
  ): string {
    return `${tarefaId}:${agendamentoId}:${index}`;
  }

  const manager: SchedulerManager = {
    async loadAll() {
      const agendamentos = await app.prisma.agendamento.findMany({
        where: {
          ativo: true,
          tarefa: { ativo: true },
        },
        include: { tarefa: true },
      });

      let jobCount = 0;
      for (const ag of agendamentos) {
        const expressions = generateCronExpressions(ag.diasSemana, ag.horarios);

        for (let i = 0; i < expressions.length; i++) {
          const expr = expressions[i];
          const key = jobKey(ag.tarefaId, ag.id, i);

          const task = cron.schedule(
            expr,
            async () => {
              app.log.info(
                `⏰ Executando tarefa "${ag.tarefa.nome}" (${ag.tarefaId})`,
              );
              try {
                await executeTask(app.prisma, ag.tarefa);
              } catch (err) {
                app.log.error(err, `Erro ao executar tarefa ${ag.tarefaId}`);
              }
            },
            {
              timezone: process.env.TZ || "America/Sao_Paulo",
            },
          );

          jobs.set(key, task);
          jobCount++;
        }
      }

      app.log.info(
        `📋 Scheduler: ${jobCount} cron jobs carregados para ${agendamentos.length} agendamentos`,
      );
    },

    async scheduleTask(tarefaId: string) {
      const agendamentos = await app.prisma.agendamento.findMany({
        where: { tarefaId, ativo: true, tarefa: { ativo: true } },
        include: { tarefa: true },
      });

      for (const ag of agendamentos) {
        const expressions = generateCronExpressions(ag.diasSemana, ag.horarios);

        for (let i = 0; i < expressions.length; i++) {
          const key = jobKey(tarefaId, ag.id, i);

          // Skip if already scheduled
          if (jobs.has(key)) continue;

          const task = cron.schedule(
            expressions[i],
            async () => {
              app.log.info(
                `⏰ Executando tarefa "${ag.tarefa.nome}" (${tarefaId})`,
              );
              try {
                await executeTask(app.prisma, ag.tarefa);
              } catch (err) {
                app.log.error(err, `Erro ao executar tarefa ${tarefaId}`);
              }
            },
            {
              timezone: process.env.TZ || "America/Sao_Paulo",
            },
          );

          jobs.set(key, task);
        }
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
