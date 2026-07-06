import { ActionTipo } from "../enums/action-tipo.js";
import type { Logger } from "../logger/logger.js";
import { prisma } from "../../infrastructure/persistence/prisma.js";
import { ActionExecutorFactory } from "../../domain/execucoes/action/action-executor-factory.js";
import { NoopActionExecutor } from "../../domain/execucoes/action/noop-action-executor.js";
import { ScriptActionExecutor } from "../../domain/execucoes/action/script-action-executor.js";
import { ShellActionExecutor } from "../../domain/execucoes/action/shell-action-executor.js";
import { DiscordChannel } from "../../domain/execucoes/notification/discord-channel.js";
import { NotificationService } from "../../domain/execucoes/notification/notification-service.js";
import { ProcessRunner } from "../../domain/execucoes/runner/process-runner.js";
import { ExecucaoService } from "../../domain/execucoes/service/execucao-service.js";
import { ScriptStorage } from "../../domain/scripts/storage/script-storage.js";
import { ScriptService } from "../../domain/scripts/service/script-service.js";
import { TarefaService } from "../../domain/tarefas/service/tarefa-service.js";
import { DashboardService } from "../../domain/dashboard/service/dashboard-service.js";

export interface Services {
  tarefa: TarefaService;
  script: ScriptService;
  execucao: ExecucaoService;
  dashboard: DashboardService;
}

export function buildServices(logger: Logger): Services {
  const processRunner = new ProcessRunner({ defaultTimeoutMs: 60_000 });
  const scriptStorage = new ScriptStorage();

  const scriptActionExecutor = new ScriptActionExecutor(processRunner);
  const shellActionExecutor = new ShellActionExecutor();
  const noopActionExecutor = new NoopActionExecutor();
  const actionFactory = new ActionExecutorFactory({
    [ActionTipo.SCRIPT]: scriptActionExecutor,
    [ActionTipo.SHELL]: shellActionExecutor,
    [ActionTipo.NOOP]: noopActionExecutor,
  });

  const notificationService = new NotificationService(
    [new DiscordChannel()],
    logger,
  );

  const execucao = new ExecucaoService(
    prisma,
    logger,
    actionFactory,
    scriptActionExecutor,
    notificationService,
  );
  const tarefa = new TarefaService(prisma);
  const script = new ScriptService(prisma, scriptStorage);
  const dashboard = new DashboardService(prisma);

  return { tarefa, script, execucao, dashboard };
}
