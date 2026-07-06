import { ActionTipo } from "../../../core/enums/action-tipo.js";
import type { ActionContext, ActionResult, ActionExecutor } from "./action-executor.js";

export class NoopActionExecutor implements ActionExecutor {
  async execute(_ctx: ActionContext): Promise<ActionResult> {
    return { stdout: "", stderr: "", exitCode: 0, tipo: ActionTipo.NOOP };
  }
}

export const noopActionExecutor = new NoopActionExecutor();
