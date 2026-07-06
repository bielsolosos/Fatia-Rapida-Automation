import { z } from "zod";
import { ScriptTipo } from "../core/enums/script-tipo.js";

export type { ScriptTipo };

const scriptTipoValues = Object.values(ScriptTipo) as [
  ScriptTipo,
  ...ScriptTipo[],
];

export const scriptCreateSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(100),
  descricao: z.string().max(500).optional().default(""),
  tipo: z.enum(scriptTipoValues, { required_error: "Tipo obrigatório" }),
  conteudo: z.string().default(""),
});

export type ScriptCreateInput = z.infer<typeof scriptCreateSchema>;
export type ScriptUpdateInput = ScriptCreateInput;

export function parseFormScript(body: unknown) {
  const raw = body as Record<string, unknown>;
  return {
    nome: String(raw.nome ?? ""),
    descricao: String(raw.descricao ?? ""),
    tipo: raw.tipo,
    conteudo: String(raw.conteudo ?? ""),
  };
}
