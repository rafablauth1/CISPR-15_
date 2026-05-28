import { NextResponse } from 'next/server'
import { carregarNormas } from '@/lib/normas/loader'

export async function GET() {
  return NextResponse.json(carregarNormas())
}
