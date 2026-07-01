import { NextRequest, NextResponse } from 'next/server'
import { lerJSON, escreverJSON } from '@/lib/dados'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import {
  parsearDadosPadrao, parsearMetadadosCertificado, resolverTag,
  ehAnaliseCritica, parsearAnaliseCritica,
} from '@/lib/certificados/parser'
import { addM } from '@/lib/utils'

// Evita pré-renderização estática (senão o POST daria 405 no app empacotado).
export const dynamic = 'force-dynamic'

const ARQ = 'equipamentos.json'

interface ItemScan { folder: string; text?: string; certPath?: string | null }

// DD/MM/AAAA (ou já ISO) → ISO YYYY-MM-DD.
function toISO(s?: string): string {
  if (!s) return ''
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
}

// SOMENTE ATUALIZA equipamentos existentes quando aparece um certificado/análise
// crítica MAIS NOVO na pasta. Nunca cria, apaga ou toca em qualquer arquivo da
// pasta-mãe — recebe o texto já lido (a varredura é read-only no Electron).
export async function POST(req: NextRequest) {
  try {
    const { itens } = (await req.json()) as { itens?: ItemScan[] }
    if (!Array.isArray(itens)) return NextResponse.json({ error: 'Informe itens.' }, { status: 400 })

    const lista = lerJSON<EquipamentoEMC[]>(ARQ, [])
    const byTag = new Map(lista.map(e => [e.tag.toUpperCase(), e]))
    const atualizados: { tag: string; oque: string; de: string; para: string }[] = []
    let mudou = false

    for (const it of itens) {
      const text = it.text || ''
      if (!text.trim()) continue

      const ac = ehAnaliseCritica(text) ? parsearAnaliseCritica(text) : null
      const dados = parsearDadosPadrao(text)
      const meta = parsearMetadadosCertificado(text)
      const tag = (ac?.tag || resolverTag(it.folder, dados.tag, text) || '').toUpperCase()
      if (!tag) continue

      const eq = byTag.get(tag)
      if (!eq) continue   // NUNCA cria — só atualiza existente

      // 1) Análise crítica mais nova → periodicidade (recalcula próxima calibração).
      if (ac?.periodicidadeMeses && ac.dataAnalise && !(eq.obs ?? '').includes(ac.dataAnalise)) {
        const antes = `${eq.intervaloCalibracao} meses`
        eq.intervaloCalibracao = ac.periodicidadeMeses
        if (eq.ultimaCalibracao) eq.proximaCalibracao = addM(eq.ultimaCalibracao, ac.periodicidadeMeses)
        eq.obs = `Periodicidade pela análise crítica de ${ac.dataAnalise} (${ac.periodicidadeMeses} meses)`
        atualizados.push({ tag, oque: 'periodicidade', de: antes, para: `${ac.periodicidadeMeses} meses` })
        mudou = true
      }

      // 2) Certificado mais novo → última/próxima calibração + nº do certificado.
      const novaCal = toISO(meta.dataEmissao || ac?.dataCertificado || dados.ultimaCalibracao)
      if (novaCal && (!eq.ultimaCalibracao || novaCal > eq.ultimaCalibracao)) {
        const antes = eq.ultimaCalibracao || '—'
        eq.ultimaCalibracao = novaCal
        eq.proximaCalibracao = addM(novaCal, eq.intervaloCalibracao || 12)
        const num = meta.numero || ac?.certificado || dados.numeroCertificado
        if (num) eq.numeroCertificado = num
        if (eq.status === 'calibrar' || eq.status === 'calibrar-antes-uso') eq.status = 'ativo'
        atualizados.push({ tag, oque: 'calibração', de: antes, para: novaCal })
        mudou = true
      }
    }

    if (mudou) escreverJSON(ARQ, lista)
    return NextResponse.json({ ok: true, atualizados, total: atualizados.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
