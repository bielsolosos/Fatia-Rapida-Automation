import type { Tarefa } from "@prisma/client";
import { ActionTipo } from "../../../core/enums/action-tipo.js";
import { noopActionExecutor } from "./noop-action-executor.js";
import { scriptActionExecutor } from "./script-action-executor.js";
import { shellActionExecutor } from "./shell-action-executor.js";
import type { ActionExecutor } from "./action-executor.js";

export class ActionExecutorFactory {
  constructor(
    private readonly executors: Record<ActionTipo, ActionExecutor>,
  ) {}

  for(tarefa: Tarefa): ActionExecutor {
    if (tarefa.scriptId) return this.executors[ActionTipo.SCRIPT];
    if (tarefa.comandoOuPayload) return this.executors[ActionTipo.SHELL];
    return this.executors[ActionTipo.NOOP];
  }
}

export const actionExecutorFactory = new ActionExecutorFactory({
  [ActionTipo.SCRIPT]: scriptActionExecutor,
  [ActionTipo.SHELL]: shellActionExecutor,
  [ActionTipo.NOOP]: noopActionExecutor,
});
