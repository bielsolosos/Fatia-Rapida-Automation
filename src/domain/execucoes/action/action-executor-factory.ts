import type { Tarefa } from "@prisma/client";
import { ActionTipo } from "../../../core/enums/action-tipo.js";
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
