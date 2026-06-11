import { lerJSON, escreverJSON } from '@/lib/dados'
import type { Certificado } from '@/lib/certificados/tipos'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import type { GrandezaMetrologica } from '@/lib/metrologia/tipos'

const EQUIP_ARQ = 'equipamentos.json'

/* Ao salvar/atualizar um certificado, registra automaticamente as GRANDEZAS dele
   no equipamento (padrão), para aparecerem no seletor de grandeza da checagem.
   Usa a grandeza parseada (cabeçalho "Medição de…"), não o parâmetro da tabela. */
export function registrarGrandezasDoCertificado(cert: Certificado) {
  try {
    type Acc = { nome: string; unidade: string; vals: number[]; incs: number[] }
    const map = new Map<string, Acc>()
    const num = (v: unknown): number => {
      const n = parseFloat(String(v ?? '').replace(/[^\d.,+-]/g, '').replace(',', '.'))
      return isFinite(n) ? n : NaN
    }
    const add = (nome?: string, unidade?: string, val?: number, inc?: number) => {
      const n = (nome || '').trim()
      if (!n) return
      const key = n.toLowerCase()
      if (!map.has(key)) map.set(key, { nome: n, unidade: (unidade || '').trim(), vals: [], incs: [] })
      const a = map.get(key)!
      if (!a.unidade && unidade) a.unidade = unidade.trim()
      if (typeof val === 'number' && isFinite(val)) a.vals.push(val)
      if (typeof inc === 'number' && isFinite(inc)) a.incs.push(inc)
    }
    for (const p of (cert.grade2D?.pontos ?? []) as unknown as Array<Record<string, unknown>>) {
      add(p.grandeza as string, (p.eixo2Unidade as string) ?? cert.grade2D?.eixo2Unidade,
          num(p.eixo2 ?? p.vr), num(p.incerteza))
    }
    for (const it of cert.itens ?? []) {
      add(it.grandeza, it.unidade, num(it.valorNominal), num(it.incertezaExpandida))
    }
    if (!map.size) return

    const equips = lerJSON<EquipamentoEMC[]>(EQUIP_ARQ, [])
    const idx = equips.findIndex(e =>
      e.id === cert.equipamentoId ||
      (e.tag && cert.equipamentoTag && e.tag.toUpperCase() === cert.equipamentoTag.toUpperCase()))
    if (idx < 0) return
    const eq = equips[idx]
    const existentes = new Set((eq.grandezas ?? []).map(g => g.nome.trim().toLowerCase()))
    const novas: GrandezaMetrologica[] = []
    for (const a of map.values()) {
      if (existentes.has(a.nome.toLowerCase())) continue
      novas.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        nome: a.nome, simbolo: '', unidade: a.unidade,
        faixaMin: a.vals.length ? Math.min(...a.vals) : 0,
        faixaMax: a.vals.length ? Math.max(...a.vals) : 0,
        resolucao: '', incertezaExpandida: a.incs.length ? String(Math.max(...a.incs)) : '',
        fatorCobertura: 2,
      })
    }
    if (!novas.length) return
    equips[idx] = { ...eq, grandezas: [...(eq.grandezas ?? []), ...novas] }
    escreverJSON(EQUIP_ARQ, equips)
  } catch { /* não bloqueia o salvamento do certificado */ }
}
