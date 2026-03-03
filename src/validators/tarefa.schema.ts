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

// ── Agendamento ──
export const agendamentoSchema = z.object({
  diasSemana: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Selecione pelo menos um dia"),
  horarios: z
    .array(z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"))
    .min(1, "Adicione pelo menos um horário"),
  ativo: z.boolean().default(true),
});

export type AgendamentoInput = z.infer<typeof agendamentoSchema>;

// ── Tarefa: criação ──
export const tarefaCreateSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(100),
  descricao: z.string().max(500).optional().default(""),
  comandoOuPayload: z.string().max(2000).optional().default(""),
  webhookUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  agendamentos: z
    .array(agendamentoSchema)
    .min(1, "Adicione pelo menos um agendamento"),
});

export type TarefaCreateInput = z.infer<typeof tarefaCreateSchema>;

// ── Tarefa: atualização ──
export const tarefaUpdateSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(100),
  descricao: z.string().max(500).optional().default(""),
  comandoOuPayload: z.string().max(2000).optional().default(""),
  webhookUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  agendamentos: z
    .array(agendamentoSchema)
    .min(1, "Adicione pelo menos um agendamento"),
});

export type TarefaUpdateInput = z.infer<typeof tarefaUpdateSchema>;

// ── Helper: parse form data to structured object ──
// HTML forms send flat data. We need to reconstruct nested agendamentos.
export function parseFormTarefa(
  body: Record<string, unknown>,
): TarefaCreateInput {
  const nome = String(body.nome || "");
  const descricao = String(body.descricao || "");
  const comandoOuPayload = String(body.comandoOuPayload || "");
  const webhookUrl = String(body.webhookUrl || "");

  // Agendamentos come as:
  //   agendamentos[0].diasSemana = ["1", "3", "5"] or "1"
  //   agendamentos[0].horarios = ["09:00", "18:00"] or "09:00"
  //   agendamentos[0].ativo = "on" or undefined
  const agendamentos: AgendamentoInput[] = [];

  // Collect indices
  const indices = new Set<number>();
  for (const key of Object.keys(body)) {
    const match = key.match(/^agendamentos\[(\d+)\]/);
    if (match) indices.add(Number(match[1]));
  }

  for (const idx of Array.from(indices).sort((a, b) => a - b)) {
    const diasRaw =
      body[`agendamentos[${idx}].diasSemana`] ||
      body[`agendamentos[${idx}][diasSemana]`];
    const horariosRaw =
      body[`agendamentos[${idx}].horarios`] ||
      body[`agendamentos[${idx}][horarios]`];
    const ativoRaw =
      body[`agendamentos[${idx}].ativo`] || body[`agendamentos[${idx}][ativo]`];

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

    agendamentos.push({
      diasSemana,
      horarios,
      ativo: ativoRaw === "on" || ativoRaw === "true" || ativoRaw === true,
    });
  }

  // If no indexed agendamentos found, try flat format (single agendamento)
  if (agendamentos.length === 0 && body["diasSemana"]) {
    const diasRaw = body["diasSemana"];
    const horariosRaw = body["horarios"];

    const diasSemana = Array.isArray(diasRaw)
      ? diasRaw.map(Number)
      : [Number(diasRaw)];

    const horarios = Array.isArray(horariosRaw)
      ? horariosRaw.map(String).filter(Boolean)
      : horariosRaw
        ? [String(horariosRaw)].filter(Boolean)
        : [];

    agendamentos.push({
      diasSemana,
      horarios,
      ativo: true,
    });
  }

  return {
    nome,
    descricao: descricao || "",
    comandoOuPayload: comandoOuPayload || "",
    webhookUrl: webhookUrl || undefined,
    agendamentos,
  };
}
