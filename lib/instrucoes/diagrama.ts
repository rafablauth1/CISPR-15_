// Renderização de um diagrama (formas) em SVG. O MESMO markup é usado no editor,
// na visualização e na geração de PDF — garante que o que se edita é o que sai.

import type { Forma, BlocoDiagrama } from './tipos'

export const DIAGRAMA_W = 760
export const DIAGRAMA_H = 420
export const COR_PADRAO = '#1f2937'

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Markup de UMA forma (sem interatividade) — usado na exportação/visualização. */
export function formaSVG(f: Forma): string {
  const cor = f.cor || COR_PADRAO
  const x = f.x, y = f.y, w = f.w ?? 0, h = f.h ?? 0
  if (f.tipo === 'retangulo') {
    const rotulo = f.texto
      ? `<text x="${x + w / 2}" y="${y + h / 2}" font-size="13" fill="#111827" text-anchor="middle" dominant-baseline="central">${esc(f.texto)}</text>`
      : ''
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="${cor}" stroke-width="2"/>${rotulo}`
  }
  if (f.tipo === 'elipse') {
    const rotulo = f.texto
      ? `<text x="${x + w / 2}" y="${y + h / 2}" font-size="13" fill="#111827" text-anchor="middle" dominant-baseline="central">${esc(f.texto)}</text>`
      : ''
    return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${Math.abs(w / 2)}" ry="${Math.abs(h / 2)}" fill="#ffffff" stroke="${cor}" stroke-width="2"/>${rotulo}`
  }
  if (f.tipo === 'linha') {
    return `<line x1="${x}" y1="${y}" x2="${f.x2 ?? x}" y2="${f.y2 ?? y}" stroke="${cor}" stroke-width="2.5" stroke-linecap="round"/>`
  }
  // texto
  return `<text x="${x}" y="${y}" font-size="14" fill="${cor}" dominant-baseline="hanging">${esc(f.texto || 'Texto')}</text>`
}

/** SVG completo do diagrama (string) — para visualização e PDF. */
export function diagramaParaSVG(b: BlocoDiagrama): string {
  const w = b.w || DIAGRAMA_W
  const h = b.h || DIAGRAMA_H
  const corpo = (b.formas || []).map(formaSVG).join('')
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width:${w}px;border:1px solid #d1d5db;border-radius:8px;background:#ffffff">${corpo}</svg>`
}
