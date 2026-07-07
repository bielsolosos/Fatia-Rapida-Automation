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
