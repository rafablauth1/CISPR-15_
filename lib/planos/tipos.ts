// Plano de Calibração: define, por equipamento, os pontos + tolerâncias que um
// certificado de calibração deve conter (a "régua" para validar certificados).

export interface PontoPlano {
  id: string
  grandeza: string
  unidade: string
  valorNominal: string
  // Tolerância flexível (qualquer combinação). Limite absoluto (±) =
  //   |nominal|·(tolPercentual/100) + |tolFixo| + |nominal|·(tolPpm/1e6)
  tolPercentual?: string   // % da leitura/valor nominal
  tolFixo?: string         // valor fixo absoluto, na unidade da grandeza
  tolPpm?: string          // partes por milhão do valor nominal
  obs?: string
}

export interface PlanoCalibracao {
  id: string
  equipamentoId: string
  equipamentoTag: string
  nome?: string
  pontos: PontoPlano[]
  obs?: string
  criadoEm: string
}

const num = (s?: string): number => {
  const n = parseFloat(String(s ?? '').replace(',', '.'))
  return isFinite(n) ? n : 0
}

/** Limite absoluto (±) de um ponto, combinando %, fixo e ppm. null se não houver tolerância. */
export function limiteAbsoluto(p: PontoPlano): number | null {
  const nominal = Math.abs(num(p.valorNominal))
  const lim = nominal * num(p.tolPercentual) / 100 + Math.abs(num(p.tolFixo)) + nominal * num(p.tolPpm) / 1e6
  return lim > 0 ? lim : null
}

/** Texto curto da tolerância (ex.: "±(0,5% + 2)" ou "±0,05" ou "±10 ppm"). */
export function tolTexto(p: PontoPlano): string {
  const partes: string[] = []
  if (num(p.tolPercentual)) partes.push(`${p.tolPercentual}%`)
  if (num(p.tolPpm))        partes.push(`${p.tolPpm} ppm`)
  if (num(p.tolFixo))       partes.push(`${p.tolFixo}${p.unidade ? ' ' + p.unidade : ''}`)
  if (!partes.length) return '—'
  return partes.length === 1 ? `±${partes[0]}` : `±(${partes.join(' + ')})`
}

/** Faixa aceitável [min, max] de um ponto, se houver nominal + tolerância. */
export function faixaAceitavel(p: PontoPlano): { min: number; max: number } | null {
  const nominal = num(p.valorNominal)
  const lim = limiteAbsoluto(p)
  if (lim === null || !isFinite(nominal)) return null
  return { min: nominal - lim, max: nominal + lim }
}
