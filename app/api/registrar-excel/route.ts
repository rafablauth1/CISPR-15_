import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { readSettings } from '@/lib/settings-server'

function getExcelPath(): string {
  const settings = readSettings()
  if (settings.excelPath) return path.normalize(settings.excelPath)
  // fallback para desenvolvimento
  return path.normalize('C:/Users/Notla/OneDrive/Área de Trabalho/Compatibilidade eletromagnética_2026.xlsx')
}

function toExcelSerial(date: Date): number {
  return date.getTime() / 86400000 + 25569
}

function readWorkbook() {
  const EXCEL_PATH = getExcelPath()
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Planilha não encontrada: ${EXCEL_PATH}\n\nConfigure o caminho em Configurações.`)
  }
  const buf = fs.readFileSync(EXCEL_PATH)
  return { wb: XLSX.read(buf, { type: 'buffer' }), path: EXCEL_PATH }
}

async function writeWorkbook(wb: XLSX.WorkBook, filePath: string): Promise<void> {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      fs.writeFileSync(filePath, buf)
      return
    } catch (err: any) {
      lastErr = err
      if (attempt < 4) await new Promise(r => setTimeout(r, 400 * attempt))
    }
  }
  throw lastErr
}

function findNextEmptyRow(rows: any[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1] === 'EMC' && rows[i][4] === '' && rows[i][5] === '' && rows[i][6] === '') {
      return i
    }
  }
  return -1
}

export async function GET(request: NextRequest) {
  const checkProtocolo = request.nextUrl.searchParams.get('checkProtocolo')

  try {
    const { wb } = readWorkbook()
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

    if (checkProtocolo !== null) {
      const needle = checkProtocolo.trim().toLowerCase()
      for (const row of rows) {
        const cell = String(row[6] ?? '').trim().toLowerCase()
        if (cell && cell === needle) {
          const num = row[2]
          const year = new Date().getFullYear()
          return NextResponse.json({ exists: true, numRelatorio: num ? `EMC ${num}/${year}` : undefined })
        }
      }
      return NextResponse.json({ exists: false })
    }

    const idx = findNextEmptyRow(rows)
    if (idx === -1) return NextResponse.json({ error: 'Sem linhas disponíveis' }, { status: 400 })
    const num = parseInt(String(rows[idx][2]), 10)
    const year = new Date().getFullYear()
    return NextResponse.json({ proximoNumero: num, relatorio: `EMC ${num}/${year}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { cliente = '', produto = '', protocolo = '', orcamento = '', responsavel = '' } = await request.json()
    const { wb, path: excelPath } = readWorkbook()
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]
    const idx = findNextEmptyRow(rows)
    if (idx === -1) return NextResponse.json({ error: 'Sem linhas disponíveis na planilha' }, { status: 400 })

    const num = parseInt(String(rows[idx][2]), 10)
    const row1 = idx + 1
    const orcNum = Number(orcamento)

    const updates: [string, any, XLSX.ExcelDataType][] = [
      [`E${row1}`, cliente,                               's'],
      [`F${row1}`, produto,                               's'],
      [`G${row1}`, protocolo,                             's'],
      [`H${row1}`, isNaN(orcNum) ? orcamento : orcNum,   isNaN(orcNum) ? 's' : 'n'],
      [`I${row1}`, toExcelSerial(new Date()),             'n'],
      [`J${row1}`, responsavel,                           's'],
    ]

    for (const [ref, value, type] of updates) {
      const existing = ws[ref] ?? {}
      ws[ref] = { ...existing, v: value, t: type, w: undefined }
    }
    const dateCell = ws[`I${row1}`]
    if (dateCell && !dateCell.z) dateCell.z = 'dd/mm/yyyy hh:mm'

    await writeWorkbook(wb, excelPath)

    const year = new Date().getFullYear()
    return NextResponse.json({ numero: num, numRelatorio: `EMC ${num}/${year}` })
  } catch (err: any) {
    const msg = err.message ?? String(err)
    const hint = msg.includes('EBUSY') || msg.includes('lock') ||
      msg.includes('EPERM') || msg.includes('EACCES') || msg.includes('ENOENT')
      ? ' — verifique se a planilha está fechada e tente novamente'
      : ''
    return NextResponse.json({ error: msg + hint }, { status: 500 })
  }
}
