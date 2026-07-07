export const ExecucaoStatus = {
  EM_ANDAMENTO: "EM_ANDAMENTO",
  SUCESSO: "SUCESSO",
  FALHA: "FALHA",
} as const;

export type ExecucaoStatus = (typeof ExecucaoStatus)[keyof typeof ExecucaoStatus];
