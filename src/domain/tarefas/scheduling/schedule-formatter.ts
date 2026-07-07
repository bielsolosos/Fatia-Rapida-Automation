export function formatDiasSemana(diasSemanaJson: string): string {
  const dias: number[] = JSON.parse(diasSemanaJson);
  const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return dias.map((d) => nomes[d] || "?").join(", ");
}

export function formatHorarios(horariosJson: string): string {
  const horarios: string[] = JSON.parse(horariosJson);
  return horarios.join(", ");
}
