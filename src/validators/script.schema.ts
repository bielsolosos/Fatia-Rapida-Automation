import { z } from "zod";

export const SCRIPT_TIPOS = ["SHELL", "NODEJS", "PYTHON"] as const;
export type ScriptTipo = (typeof SCRIPT_TIPOS)[number];

export const scriptCreateSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(100),
  descricao: z.string().max(500).optional().default(""),
  tipo: z.enum(SCRIPT_TIPOS, { required_error: "Tipo obrigatório" }),
  conteudo: z.string().default(""),
});

export type ScriptCreateInput = z.infer<typeof scriptCreateSchema>;
export type ScriptUpdateInput = ScriptCreateInput;

export function parseFormScript(body: unknown): ScriptCreateInput {
  const raw = body as Record<string, unknown>;
  return scriptCreateSchema.parse({
    nome: raw.nome,
    descricao: raw.descricao ?? "",
    tipo: raw.tipo,
    conteudo: raw.conteudo ?? "",
  });
}
