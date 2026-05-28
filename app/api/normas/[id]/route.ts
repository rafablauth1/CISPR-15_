import { NextRequest, NextResponse } from 'next/server'
import { carregarNorma } from '@/lib/normas/loader'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const norma = carregarNorma(params.id)
  if (!norma) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(norma)
}
