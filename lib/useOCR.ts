'use client'

import { fileToBase64 } from '@/lib/utils'

/**
 * Extrai texto de uma imagem/PDF.
 * Usa o OCR nativo do Windows via Electron IPC (rápido).
 * Não usa Tesseract.js — é lento demais para uso interativo.
 */
export async function extrairTextoArquivo(file: File): Promise<string> {
  const base64 = await fileToBase64(file)

  const api = typeof window !== 'undefined'
    ? (window as Window & typeof globalThis & {
        electronAPI?: {
          recognizeOcr?: (imgs: { base64: string }[]) => Promise<{ ok: boolean; texts: string[] }>
        }
      }).electronAPI
    : null

  if (api?.recognizeOcr) {
    const res = await api.recognizeOcr([{ base64 }])
    if (res?.ok && res.texts?.length) {
      const texto = res.texts.filter((t: string) => t.trim()).join('\n')
      if (texto.trim()) return texto
    }
    throw new Error('OCR não retornou texto. Verifique se a imagem é legível.')
  }

  throw new Error('OCR nativo não disponível. Use a opção de colar texto manualmente.')
}
