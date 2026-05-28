import { NextRequest, NextResponse } from 'next/server'
import { extrairTextoOCR } from '@/lib/importacao/ocr'

export async function POST(req: NextRequest) {
  try {
    const { imagemBase64 } = await req.json() as { imagemBase64: string }
    if (!imagemBase64) return NextResponse.json({ error: 'imagemBase64 obrigatório' }, { status: 400 })
    const texto = await extrairTextoOCR(imagemBase64)
    return NextResponse.json({ texto })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
