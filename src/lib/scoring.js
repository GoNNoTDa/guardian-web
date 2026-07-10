// Sistema de puntuación: acumula el peso de cada señal detectada y decide el
// nivel de riesgo. Trabajar por puntos (en vez de "malo/bueno") reduce los
// falsos positivos, que son el mayor enemigo de este tipo de herramientas.

export function computeVerdict(findings, thresholds) {
  const score = findings.reduce((sum, f) => sum + (f.weight || 0), 0);
  const reasons = [...findings].sort((a, b) => (b.weight || 0) - (a.weight || 0));

  let level = "safe";
  if (score >= thresholds.danger) level = "danger";
  else if (score >= thresholds.warning) level = "warning";

  return { score, level, reasons };
}
