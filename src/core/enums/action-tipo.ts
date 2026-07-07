export const ActionTipo = {
  SCRIPT: "SCRIPT",
  SHELL: "SHELL",
  NOOP: "NOOP",
} as const;

export type ActionTipo = (typeof ActionTipo)[keyof typeof ActionTipo];
