import { NextRequest, NextResponse } from 'next/server'
import { lerLaboratorios, salvarLaboratorios, type LaboratorioCal } from '@/lib/laboratorios/registro'

export async function GET() {
  return NextResponse.json(lerLaboratorios())
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as LaboratorioCal[]
    const limpo = (Array.isArray(body) ? body : [])
      .map(l => ({ cal: (l.cal || '').toUpperCase().replace(/\s+/g, ' ').trim(), nome: (l.nome || '').trim(), modelo: l.modelo?.trim() || undefined }))
      .filter(l => l.cal)
    salvarLaboratorios(limpo)
    return NextResponse.json(limpo)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
