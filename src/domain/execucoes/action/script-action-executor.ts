import path from "node:path";
import { config } from "../../../config.js";
import { ActionTipo } from "../../../core/enums/action-tipo.js";
import { ScriptTipo } from "../../../core/enums/script-tipo.js";
import type { ProcessRunner } from "../runner/process-runner.js";
import type { ScriptStorage } from "../../scripts/storage/script-storage.js";
import type { ActionContext, ActionResult, ActionExecutor } from "./action-executor.js";

export class ScriptActionExecutor implements ActionExecutor {
  constructor(
    private readonly runner: ProcessRunner,
    private readonly storage: ScriptStorage,
  ) {}

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { script } = ctx;
    if (!script) {
      return { stdout: "", stderr: "", exitCode: 0, tipo: ActionTipo.SCRIPT };
    }

    await this.storage.ensure(script.arquivo, script.conteudo);

    const filePath = path.join(config.scriptsDir, script.arquivo);
    const { cmd, args } = this.buildCommand(script.tipo, filePath);
    const result = await this.runner.run(cmd, args, {
      cwd: config.scriptsDir,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      tipo: ActionTipo.SCRIPT,
    };
  }

  private buildCommand(
    tipo: string,
    filePath: string,
  ): { cmd: string; args: string[] } {
    if (process.platform === "win32") {
      if (tipo === ScriptTipo.NODEJS) return { cmd: "node", args: [filePath] };
      if (tipo === ScriptTipo.PYTHON) return { cmd: "python", args: [filePath] };
      return { cmd: "bash", args: ["-c", `"${filePath}" 2>&1`] };
    }
    if (tipo === ScriptTipo.NODEJS) return { cmd: "node", args: [filePath] };
    if (tipo === ScriptTipo.PYTHON) return { cmd: "python3", args: [filePath] };
    return { cmd: "bash", args: ["-c", `"${filePath}" 2>&1`] };
  }
}
