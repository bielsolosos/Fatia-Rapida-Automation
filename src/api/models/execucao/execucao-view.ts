import { ExecucaoStatus } from "../../../core/enums/execucao-status.js";

export interface ExecucaoRowView {
  id: string;
  dataFormatada: string;
  status: string;
  statusBadgeClass: string;
  origem: { kind: "tarefa" | "script" | "avulso"; nome: string | null };
  duracaoLabel: string;
  temSaida: boolean;
}

export type ExecucaoRow = {
  id: string;
  executadoEm: Date;
  status: string;
  duracao: number | null;
  saida: string | null;
  tarefaId: string | null;
  tarefa?: { nome: string } | null;
  script?: { nome: string } | null;
};

function resolveBadgeClass(status: string): string {
  if (status === ExecucaoStatus.SUCESSO) return "badge-success";
  if (status === ExecucaoStatus.FALHA) return "badge-error";
  return "badge-warning";
}

function resolveOrigem(exec: ExecucaoRow): ExecucaoRowView["origem"] {
  if (exec.tarefa != null) return { kind: "tarefa", nome: exec.tarefa.nome };
  if (exec.script != null) return { kind: "script", nome: exec.script.nome };
  return { kind: "avulso", nome: null };
}

export function toExecucaoRowView(exec: ExecucaoRow): ExecucaoRowView {
  return {
    id: exec.id,
    dataFormatada: new Date(exec.executadoEm).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }),
    status: exec.status,
    statusBadgeClass: resolveBadgeClass(exec.status),
    origem: resolveOrigem(exec),
    duracaoLabel: exec.duracao ? `${exec.duracao}ms` : "—",
    temSaida: Boolean(exec.saida),
  };
}
