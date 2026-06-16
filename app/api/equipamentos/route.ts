import { NextRequest, NextResponse } from 'next/server'
import { lerJSON, escreverJSON } from '@/lib/dados'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'

const ARQUIVO = 'equipamentos.json'

const DEFAULTS: EquipamentoEMC[] = [
  { id: '1', tag: '1528EMC', nome: 'Analisador de Espectro R&S', grupoId: 'medidores', subgrupoId: 'analisador-espectro', status: 'ativo', grandezas: [], ultimaCalibracao: '2025-12-01', proximaCalibracao: '2026-12-01', intervaloCalibracao: 12 },
  { id: '2', tag: '1196EMC', nome: 'Receptor EMI', grupoId: 'medidores', subgrupoId: 'receptor-emi', status: 'ativo', grandezas: [], ultimaCalibracao: '2025-11-01', proximaCalibracao: '2026-11-01', intervaloCalibracao: 12 },
  { id: '3', tag: '1429EMC', nome: 'LISN 50µH', grupoId: 'redes-impedancia', subgrupoId: 'lisn-50uh', status: 'ativo', grandezas: [], ultimaCalibracao: '2025-05-03', proximaCalibracao: '2026-05-03', intervaloCalibracao: 12 },
  { id: '4', tag: '1907EMC', nome: 'Antena de Loop Tripla', grupoId: 'antenas', subgrupoId: 'antena-loop', status: 'ativo', grandezas: [], ultimaCalibracao: '2025-07-22', proximaCalibracao: '2026-07-22', intervaloCalibracao: 12 },
  { id: '5', tag: '3055EMC', nome: 'Gerador de Sinal', grupoId: 'geradores', subgrupoId: 'gerador-sinal-rf', status: 'ativo', grandezas: [], ultimaCalibracao: '2025-06-14', proximaCalibracao: '2026-06-14', intervaloCalibracao: 12 },
]

export async function GET() {
  return NextResponse.json(lerJSON<EquipamentoEMC[]>(ARQUIVO, DEFAULTS))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<EquipamentoEMC, 'id'>
    const lista = lerJSON<EquipamentoEMC[]>(ARQUIVO, DEFAULTS)
    const novo: EquipamentoEMC = { ...body, id: Date.now().toString() }
    escreverJSON(ARQUIVO, [...lista, novo])
    return NextResponse.json(novo, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// Exclusão em lote: body { ids: string[] } → remove todos numa escrita só.
export async function DELETE(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: string[] }
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: 'Informe os ids.' }, { status: 400 })
    }
    const set = new Set(ids)
    const lista = lerJSON<EquipamentoEMC[]>(ARQUIVO, DEFAULTS)
    const nova = lista.filter(e => !set.has(e.id))
    escreverJSON(ARQUIVO, nova)
    return NextResponse.json({ ok: true, removidos: lista.length - nova.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
