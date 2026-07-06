export const ScriptTipo = {
  SHELL: "SHELL",
  NODEJS: "NODEJS",
  PYTHON: "PYTHON",
} as const;

export type ScriptTipo = (typeof ScriptTipo)[keyof typeof ScriptTipo];
