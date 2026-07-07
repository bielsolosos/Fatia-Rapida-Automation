import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { SchedulerManager } from "../../domain/tarefas/scheduling/scheduler-manager.js";

declare module "fastify" {
  interface FastifyInstance {
    scheduler: SchedulerManager;
  }
}

export const schedulerPlugin = fp(async (app: FastifyInstance) => {
  app.decorate("scheduler", app.services.scheduler);

  await app.services.scheduler.loadAll();

  app.addHook("onClose", async () => {
    app.log.info("Parando todos os cron jobs...");
    await app.services.scheduler.stopAll();
  });
});
