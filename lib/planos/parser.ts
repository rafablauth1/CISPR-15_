import type { PontoPlano } from '@/lib/planos/tipos'

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

/** Interpreta um critério de aprovação (ex.: "± 1 dB", "± 7,0 %", "0,00003%",
 *  "3 Hz", "10 ppm") em campos estruturados + texto original. */
export function parsearCriterio(s: string): Partial<PontoPlano> {
  const t = s.replace(/\s+/g, ' ').trim()
  const out: Partial<PontoPlano> = { criterioTexto: t.replace(/^±\s*/, '± ') }
  const m = t.match(/±?\s*([\d.,]+)\s*(ppm|%|dB[m]?|Hz|kHz|MHz|GHz|mV|µV|uV|V|mA|µA|uA|A|Ω|ohm|°C|s|ms|µs)?/i)
  if (m) {
    const valor = m[1]
    const un = (m[2] || '').trim()
    if (/ppm/i.test(un)) out.tolPpm = valor
    else if (un === '%') out.tolPercentual = valor
    else { out.tolFixo = valor; if (un) out.unidade = un }
  }
  return out
}

const RE_GRANDEZA = /(exatid|linearidade|resposta|estabilidade|n[ií]vel|frequ[eê]ncia|pot[eê]ncia|tens[aã]o|corrente|resist[eê]ncia|modula|amplitude|impedanc|atenua|ru[ií]do|distor|ganho|temperatura|umidade|press[aã]o|tempo|fase)/i

const BLACKLIST = /(^|\b)(for\s*6400|identifica|dados para|observa|grandeza\s*$|^data$|crit[eé]rio|respons[aá]vel|faixa de medi|pontos de calibra|nome do|tag do|revis[aã]o|elaborado|aprovado|p[aá]gina|an[aá]lise cr[ií]tica|informa[çc])/i

function ehData(l: string)     { return /^\d{2}\/\d{2}\/\d{4}$/.test(l.trim()) }
function ehNomePessoa(l: string){ return /^[A-ZÀ-Ý][a-zà-ÿ]+(\s+[A-ZÀ-Ý][a-zà-ÿ.]+){1,3}(\s*-\s*.+)?$/.test(l.trim()) && !RE_GRANDEZA.test(l) }
function ehCriterio(l: string) {
  const t = l.trim()
  if (/[a-zà-ÿ]{6,}/i.test(t) && !/^±/.test(t)) return false   // frase longa não é critério
  return /^±/.test(t) || /^[\d.,]+\s*(ppm|%|dB[m]?|Hz|kHz|MHz|GHz|V|A|Ω)\b/i.test(t)
}
function ehPontos(l: string) {
  const t = l.trim()
  return (/\(/.test(t) && /\d/.test(t)) || /ponto\s*:/i.test(t) || /\d\s*a\s*-?\d/i.test(t) ||
         /\d.*\b(MHz|GHz|kHz|Hz|dBm|dB|V|A|%)\b/.test(t)
}
function ehGrandeza(l: string) {
  const t = l.trim()
  if (t.length < 8) return false
  if (BLACKLIST.test(t) || ehData(t) || ehCriterio(t) || ehNomePessoa(t)) return false
  if (/^[(\d±]/.test(t)) return false
  return RE_GRANDEZA.test(t) || (t.split(/\s+/).length >= 3 && /[a-zà-ÿ]{4,}/i.test(t))
}

/** Extrai linhas do plano (FOR 6400) de um texto OCR. Associa grandeza↔pontos↔critério
 *  por PROXIMIDADE (o pdf-parse embaralha as células; é best-effort, revise depois). */
export function parsearPlanoOCR(texto: string): PontoPlano[] {
  const linhas = texto.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

  const grandezas: { idx: number; text: string; row: PontoPlano }[] = []
  const criterios: { idx: number; text: string; claimed: boolean }[] = []
  const pontos:    { idx: number; text: string; claimed: boolean }[] = []

  linhas.forEach((l, idx) => {
    if (ehGrandeza(l)) grandezas.push({ idx, text: l, row: { id: uid(), grandeza: l, unidade: '', pontosTexto: '' } })
    else if (ehCriterio(l)) criterios.push({ idx, text: l, claimed: false })
    else if (ehPontos(l))   pontos.push({ idx, text: l, claimed: false })
  })

  if (!grandezas.length) return []

  // dedup grandezas iguais consecutivas (OCR repete)
  const uniq: typeof grandezas = []
  for (const g of grandezas) {
    if (!uniq.length || uniq[uniq.length - 1].text.toLowerCase() !== g.text.toLowerCase()) uniq.push(g)
  }

  // associa cada critério/ponto à grandeza mais próxima (por distância de linha)
  const nearest = (idx: number) =>
    uniq.reduce((best, g) => Math.abs(g.idx - idx) < Math.abs(best.idx - idx) ? g : best, uniq[0])

  for (const c of criterios) {
    const g = nearest(c.idx)
    const parsed = parsearCriterio(c.text)
    g.row = { ...g.row, ...parsed, unidade: g.row.unidade || parsed.unidade || '' }
  }
  for (const p of pontos) {
    const g = nearest(p.idx)
    g.row.pontosTexto = g.row.pontosTexto ? `${g.row.pontosTexto} · ${p.text}` : p.text
  }

  return uniq.map(g => g.row)
}
