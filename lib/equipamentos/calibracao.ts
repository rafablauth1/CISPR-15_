// Regras de vencimento de calibração.
//
// "Calibrar antes do uso": equipamento cuja calibração está vencida há mais que a
// periodicidade da análise crítica do laboratório (4 anos). Acima disso não basta
// recalibrar na agenda — tem de ser calibrado antes do próximo uso.

export const ANOS_ANALISE_CRITICA = 4

/** Anos (fracionários) decorridos desde a data de vencimento até hoje.
 *  0 = ainda no prazo (ou data inválida); >0 = vencido há tantos anos. */
export function anosVencido(proximaCalibracao: string, hoje: Date = new Date()): number {
  if (!proximaCalibracao) return 0
  const venc = new Date(proximaCalibracao + 'T00:00:00')
  if (isNaN(venc.getTime())) return 0
  const ms = hoje.getTime() - venc.getTime()
  if (ms <= 0) return 0
  return ms / (365.25 * 24 * 3600 * 1000)
}

/** Calibração vencida há mais que a periodicidade da análise crítica? */
export function exigeCalibrarAntesDoUso(
  proximaCalibracao: string,
  anos: number = ANOS_ANALISE_CRITICA,
  hoje: Date = new Date(),
): boolean {
  return anosVencido(proximaCalibracao, hoje) > anos
}
