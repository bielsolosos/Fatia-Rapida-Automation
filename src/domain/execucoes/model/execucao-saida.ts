export type ExecucaoSaida =
  | {
      type: "SCRIPT";
      stdout: string;
      stderr: string;
      scriptNome: string;
      exitCode: number;
    }
  | { type: "SHELL"; stdout: string; stderr: string; comando: string }
  | { type: "NOOP" }
  | { type: "ERROR"; error: string; stdout: string; stderr: string };
