// Correção de GRANDEZA do certificado pela POSIÇÃO (x,y) — PDFs gerados de Excel
// embaralham o texto, mas a grade é fiel. A grandeza é o cabeçalho centralizado
// logo acima do "Parâmetro:"; aqui mapeamos parâmetro→grandeza e corrigimos os
// pontos já parseados (que acertam o parâmetro/tabela, mas erram a grandeza).

export interface LayoutItem { s: string; x: number; y: number; page?: number }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const soGr = (s: string) => s.split(/\s*[-–—]\s*/)[0].trim()
const chave = (s: string) => norm(s).replace(/[^a-z0-9]/g, '')

interface Linha { page: number; y: number; x: number; text: string }
function linhasDeLayout(items: LayoutItem[]): Linha[] {
  const byKey: Record<string, LayoutItem[]> = {}
  for (const it of items) { const k = (it.page ?? 0) + ':' + Math.round(it.y / 3); (byKey[k] ||= []).push(it) }
  return Object.values(byKey).map(g => {
    g.sort((a, b) => a.x - b.x)
    return {
      page: g[0].page ?? 0,
      y: Math.round(g.reduce((s, i) => s + i.y, 0) / g.length),
      x: Math.min(...g.map(i => i.x)),
      text: g.map(i => i.s).join(' ').replace(/\s+/g, ' ').trim(),
    }
  })
}

function ehHeading(t: string): boolean {
  const g = soGr(t); const n = norm(g)
  if (g.length < 4) return false
  if (/^[\d.,()∞\s+-]+$/.test(g)) return false
  if (/^(configura|par[aâ]metro|resultado|certificado|per[ií]odo|gerador de sinal|laborat|p[aá]gina|av\.|telefone|e-?mail|website|fax)/.test(n)) return false
  // Datas / campos administrativos não são grandeza
  if (/^(data|emiss|emiti|validade|vencimento|respons|assinatura|protocolo|n[uú]mero|n[º°]|local\b|cliente|endere|cnpj|equipamento|fabricante|modelo|tag|s[ée]rie|recebi|realizada?|aprovad)/.test(n)) return false
  if (/data\s+de\s+(emiss|calibra|valid)/.test(n)) return false
  if (/^(v\s*eff|k\b|im\b|vr\b|mm\b|ust|ump|veff)/.test(n)) return false   // fragmentos de coluna
  return /[a-zà-ÿ]{4,}/i.test(g)
}

/** Mapa parâmetro→grandeza pela posição (grandeza = cabeçalho acima do "Parâmetro:"). */
export function mapaGrandezaPorParametro(items: LayoutItem[]): { paramKey: string; grandeza: string }[] {
  const linhas = linhasDeLayout(items)
  const params = linhas.filter(l => /^par[aâ]metro/i.test(l.text) && l.text.length > 14)
  const out: { paramKey: string; grandeza: string }[] = []
  const seen = new Set<string>()
  for (const p of params) {
    const k = chave(p.text.replace(/^par[aâ]metro\s*:?\s*/i, ''))
    if (!k || seen.has(k)) continue
    seen.add(k)
    const cand = linhas.filter(l => l.page === p.page && l.y > p.y && l.x > 160 && ehHeading(l.text)).sort((a, b) => a.y - b.y)
    if (cand.length) out.push({ paramKey: k, grandeza: soGr(cand[0].text) })
  }
  return out
}

/** Corrige a grandeza dos pontos parseados, casando o parâmetro (tabela) com o mapa. */
export function corrigirGrandezasPorLayout<T extends { grandeza?: string; tabela?: string }>(pontos: T[], items: LayoutItem[]): T[] {
  const mapa = mapaGrandezaPorParametro(items)
  if (!mapa.length) return pontos
  return pontos.map(pt => {
    const tk = chave(pt.tabela || '')
    if (tk.length < 6) return pt
    const hit = mapa.find(m => tk.includes(m.paramKey) || m.paramKey.includes(tk))
    return hit ? { ...pt, grandeza: hit.grandeza } : pt
  })
}
