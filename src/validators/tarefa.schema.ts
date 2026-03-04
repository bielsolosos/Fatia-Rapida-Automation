import { z } from "zod";

// ── Constantes ──
export const DIAS_SEMANA = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
] as const;

// ── Tarefa: criação ──
export const tarefaCreateSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(100),
  descricao: z.string().max(500).optional().default(""),
  comandoOuPayload: z.string().max(2000).optional().default(""),
  webhookUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  diasSemana: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Selecione pelo menos um dia"),
  horarios: z
    .array(z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"))
    .min(1, "Adicione pelo menos um horário"),
  scriptId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
});

export type TarefaCreateInput = z.infer<typeof tarefaCreateSchema>;

// ── Tarefa: atualização (idêntica) ──
export const tarefaUpdateSchema = tarefaCreateSchema;
export type TarefaUpdateInput = TarefaCreateInput;

// ── Helper: parse form data ──
// Os campos diasSemana e horarios chegam direto no body (sem prefixo de índice).
export function parseFormTarefa(
  body: Record<string, unknown>,
): TarefaCreateInput {
  const nome = String(body.nome || "");
  const descricao = String(body.descricao || "");
  const comandoOuPayload = String(body.comandoOuPayload || "");
  const webhookUrl = String(body.webhookUrl || "");

  const diasRaw = body["diasSemana"];
  const horariosRaw = body["horarios"];

  const diasSemana = Array.isArray(diasRaw)
    ? diasRaw.map(Number)
    : diasRaw
      ? [Number(diasRaw)]
      : [];

  const horarios = Array.isArray(horariosRaw)
    ? horariosRaw.map(String).filter(Boolean)
    : horariosRaw
      ? [String(horariosRaw)].filter(Boolean)
      : [];

  const scriptId = body.scriptId ? String(body.scriptId) : undefined;

  return {
    nome,
    descricao: descricao || "",
    comandoOuPayload: comandoOuPayload || "",
    webhookUrl: webhookUrl || undefined,
    diasSemana,
    horarios,
    scriptId: scriptId || undefined,
  };
}
