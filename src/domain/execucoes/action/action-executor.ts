import type { Script, Tarefa } from "@prisma/client";
import type { ActionTipo } from "../../../core/enums/action-tipo.js";

export interface ActionContext {
  tarefa?: Tarefa;
  script?: Script | null;
}

export interface ActionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  tipo: ActionTipo;
}

export interface ActionExecutor {
  execute(ctx: ActionContext): Promise<ActionResult>;
}
