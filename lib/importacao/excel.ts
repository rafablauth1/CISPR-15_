import * as XLSX from 'xlsx'
import type { ItemChecagem } from '@/lib/checagens/tipos'

export function parsearExcelChecagem(buffer: ArrayBuffer): ItemChecagem[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  const itens: ItemChecagem[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const descricao = String(row[0] ?? '').trim()
    if (!descricao) continue
    const valorMedido = String(row[1] ?? '').trim()
    const unidade     = String(row[2] ?? '').trim()
    const minRaw      = parseFloat(String(row[3] ?? ''))
    const maxRaw      = parseFloat(String(row[4] ?? ''))
    itens.push({
      id: `excel-${i}`,
      descricao,
      valorMedido,
      unidade,
      criterioMin: isNaN(minRaw) ? undefined : minRaw,
      criterioMax: isNaN(maxRaw) ? undefined : maxRaw,
      resultado: 'na',
    })
  }
  return itens
}
