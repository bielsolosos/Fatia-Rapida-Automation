import { exec } from "child_process";
import { promisify } from "util";
import { ActionTipo } from "../../../core/enums/action-tipo.js";
import type { ActionContext, ActionResult, ActionExecutor } from "./action-executor.js";

const execAsync = promisify(exec);

export class ShellActionExecutor implements ActionExecutor {
  async execute(ctx: ActionContext): Promise<ActionResult> {
    const comando = ctx.tarefa?.comandoOuPayload ?? "";
    try {
      const result = await execAsync(comando, {
        timeout: 60_000,
        shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
      });
      return {
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
        exitCode: 0,
        tipo: ActionTipo.SHELL,
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: number | string };
      return {
        stdout: (e.stdout ?? "").trim(),
        stderr: (e.stderr ?? "").trim(),
        exitCode: typeof e.code === "number" ? e.code : 1,
        tipo: ActionTipo.SHELL,
      };
    }
  }
}
