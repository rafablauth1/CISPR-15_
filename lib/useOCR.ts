'use client'

import { fileToBase64 } from '@/lib/utils'

/**
 * Extrai texto de um arquivo (imagem/PDF) usando o OCR do Windows via Electron IPC
 * quando disponível, com fallback para a API route (Tesseract.js — mais lento).
 */
export async function extrairTextoArquivo(file: File): Promise<string> {
  const base64 = await fileToBase64(file)

  // Tenta Windows OCR via Electron (rápido, nativo)
  const api = typeof window !== 'undefined' ? (window as Window & typeof globalThis & { electronAPI?: { recognizeOcr?: (imgs: { base64: string }[]) => Promise<{ ok: boolean; texts: string[] }> } }).electronAPI : null
  if (api?.recognizeOcr) {
    try {
      const res = await api.recognizeOcr([{ base64 }])
      if (res?.ok && res.texts?.length) {
        const texto = res.texts.filter(t => t.trim()).join('\n')
        if (texto.trim()) return texto
      }
    } catch { /* fallback */ }
  }

  // Fallback: API route com Tesseract.js
  const res = await fetch('/api/importacao/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagemBase64: base64 }),
  })
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  return d.texto ?? ''
}
