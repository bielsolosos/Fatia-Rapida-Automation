/**
 * Gera expressões cron a partir de diasSemana (JSON) e horarios (JSON).
 * Corrige o bug do projeto antigo que usava apenas o primeiro horário.
 *
 * @param diasSemanaJson - JSON string: number[] (0=dom, 6=sab)
 * @param horariosJson - JSON string: string[] ("HH:MM")
 * @returns Array de expressões cron (uma por horário)
 */
export function generateCronExpressions(
  diasSemanaJson: string,
  horariosJson: string,
): string[] {
  const diasSemana: number[] = JSON.parse(diasSemanaJson);
  const horarios: string[] = JSON.parse(horariosJson);

  if (diasSemana.length === 0 || horarios.length === 0) return [];

  const diasStr = diasSemana.join(",");

  return horarios.map((horario) => {
    const [hora, minuto] = horario.split(":");
    return `${Number(minuto)} ${Number(hora)} * * ${diasStr}`;
  });
}

/**
 * Formata diasSemana para exibição legível.
 */
export function formatDiasSemana(diasSemanaJson: string): string {
  const dias: number[] = JSON.parse(diasSemanaJson);
  const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return dias.map((d) => nomes[d] || "?").join(", ");
}

/**
 * Formata horarios para exibição legível.
 */
export function formatHorarios(horariosJson: string): string {
  const horarios: string[] = JSON.parse(horariosJson);
  return horarios.join(", ");
}
