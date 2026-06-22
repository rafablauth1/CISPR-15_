import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Ferramenta interna/temporária (quadro Check em /check.html).
// Grava o markdown das demandas na RAIZ do projeto, pra ser lido e implementado.
// Usa process.cwd() de propósito: em `next dev` é a pasta do projeto (o que queremos).
export async function POST(req: NextRequest) {
  try {
    const { markdown } = (await req.json()) as { markdown?: string }
    if (typeof markdown !== 'string') {
      return NextResponse.json({ error: 'markdown ausente' }, { status: 400 })
    }
    const destino = path.join(process.cwd(), 'DEMANDAS.md')
    fs.writeFileSync(destino, markdown, 'utf-8')
    return NextResponse.json({ ok: true, path: destino })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
