import { spawn } from "child_process";

export interface RunOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class ProcessRunner {
  constructor(private readonly defaults: { defaultTimeoutMs: number }) {}

  run(
    cmd: string,
    args: string[] = [],
    options?: RunOptions,
  ): Promise<RunResult> {
    return new Promise<RunResult>((resolve) => {
      let stdout = "";
      let stderr = "";

      const proc = spawn(cmd, args, {
        cwd: options?.cwd,
        timeout: options?.timeoutMs ?? this.defaults.defaultTimeoutMs,
        env: options?.env ?? process.env,
      });

      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });

      proc.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });

      proc.on("close", (code) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 1,
        });
      });

      proc.on("error", (e) => {
        resolve({
          stdout: "",
          stderr: e.message,
          exitCode: 1,
        });
      });
    });
  }
}

export const processRunner = new ProcessRunner({ defaultTimeoutMs: 60_000 });
