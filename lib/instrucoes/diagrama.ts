// Renderização de um diagrama (formas) em SVG. O MESMO markup é usado no editor,
// na visualização e na geração de PDF — garante que o que se edita é o que sai.

import type { Forma, BlocoDiagrama } from './tipos'

export const DIAGRAMA_W = 760
export const DIAGRAMA_H = 420
export const COR_PADRAO = '#1f2937'

// Tamanho padrão de um componente ao ser solto no quadro.
export const COMP_W = 120
export const COMP_H = 64

// Paleta de componentes de equipamento (estilo Proteus) p/ a área EMC.
export const COMPONENTES: { id: string; nome: string }[] = [
  { id: 'gerador',      nome: 'Gerador RF' },
  { id: 'analisador',   nome: 'Analisador' },
  { id: 'receptor',     nome: 'Receptor EMI' },
  { id: 'lisn',         nome: 'LISN' },
  { id: 'antena',       nome: 'Antena' },
  { id: 'amplificador', nome: 'Amplificador' },
  { id: 'atenuador',    nome: 'Atenuador' },
  { id: 'filtro',       nome: 'Filtro' },
  { id: 'eut',          nome: 'EUT' },
  { id: 'medidor',      nome: 'Medidor' },
]
const NOME_COMP: Record<string, string> = Object.fromEntries(COMPONENTES.map(c => [c.id, c.nome]))

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Glifo (símbolo) de cada equipamento, desenhado dentro de uma caixa cx×ch a
// partir de (gx,gy). Coordenadas relativas pequenas — fica nítido em qualquer escala.
function glifo(simbolo: string, gx: number, gy: number, cw: number, cor: string): string {
  const cy = gy + 11
  const c = (x: number, y: number, r = 2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${cor}"/>`
  switch (simbolo) {
    case 'gerador': // onda senoidal
      return `<path d="M${gx} ${cy} q ${cw * 0.12} -10 ${cw * 0.25} 0 t ${cw * 0.25} 0 t ${cw * 0.25} 0" fill="none" stroke="${cor}" stroke-width="2"/>`
    case 'analisador':
    case 'receptor':
    case 'medidor': // tela com picos de espectro
      return `<rect x="${gx}" y="${gy + 2}" width="${cw}" height="18" rx="2" fill="none" stroke="${cor}" stroke-width="1.5"/>`
        + `<polyline points="${gx + 3},${gy + 18} ${gx + cw * 0.3},${gy + 7} ${gx + cw * 0.45},${gy + 16} ${gx + cw * 0.65},${gy + 5} ${gx + cw * 0.8},${gy + 17} ${gx + cw - 3},${gy + 12}" fill="none" stroke="${cor}" stroke-width="1.5"/>`
    case 'lisn': // bobina (indutor)
      return `<path d="M${gx} ${cy} a4 4 0 1 1 8 0 a4 4 0 1 1 8 0 a4 4 0 1 1 8 0 a4 4 0 1 1 8 0" fill="none" stroke="${cor}" stroke-width="1.8"/>`
    case 'antena': // dipolo
      return `<line x1="${gx + cw / 2}" y1="${gy + 20}" x2="${gx + cw / 2}" y2="${gy + 8}" stroke="${cor}" stroke-width="1.8"/>`
        + `<line x1="${gx + cw / 2 - 10}" y1="${gy + 2}" x2="${gx + cw / 2 + 10}" y2="${gy + 2}" stroke="${cor}" stroke-width="1.8"/>`
        + `<line x1="${gx + cw / 2}" y1="${gy + 8}" x2="${gx + cw / 2 - 8}" y2="${gy + 2}" stroke="${cor}" stroke-width="1.8"/>`
        + `<line x1="${gx + cw / 2}" y1="${gy + 8}" x2="${gx + cw / 2 + 8}" y2="${gy + 2}" stroke="${cor}" stroke-width="1.8"/>`
    case 'amplificador': // triângulo
      return `<polygon points="${gx + 4},${gy + 2} ${gx + 4},${gy + 20} ${gx + 26},${gy + 11}" fill="none" stroke="${cor}" stroke-width="1.8"/>`
    case 'atenuador': // caixa com "dB"
      return `<rect x="${gx}" y="${gy + 4}" width="${cw}" height="14" rx="2" fill="none" stroke="${cor}" stroke-width="1.5"/><text x="${gx + cw / 2}" y="${gy + 14}" font-size="10" fill="${cor}" text-anchor="middle">−dB</text>`
    case 'filtro': // resposta passa-baixa
      return `<path d="M${gx} ${gy + 4} h ${cw * 0.5} q ${cw * 0.15} 0 ${cw * 0.2} 14 l ${cw * 0.3} 0" fill="none" stroke="${cor}" stroke-width="1.8"/>`
    case 'eut': // caixa do equipamento sob ensaio
    default:
      return `<rect x="${gx}" y="${gy + 2}" width="${cw}" height="16" rx="2" fill="none" stroke="${cor}" stroke-width="1.5"/>`
  }
}

/** Markup de um COMPONENTE de equipamento (caixa + símbolo + nome + terminais). */
export function componenteSVG(f: Forma): string {
  const cor = f.cor || COR_PADRAO
  const x = f.x, y = f.y, w = f.w ?? COMP_W, h = f.h ?? COMP_H
  const nome = f.texto || NOME_COMP[f.simbolo || ''] || 'Equip.'
  const gw = Math.min(w - 24, 60)
  const gx = x + (w - gw) / 2
  return `<g>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="${cor}" stroke-width="2"/>`
    + `<circle cx="${x}" cy="${y + h / 2}" r="2.5" fill="${cor}"/><circle cx="${x + w}" cy="${y + h / 2}" r="2.5" fill="${cor}"/>`
    + glifo(f.simbolo || 'eut', gx, y + 8, gw, cor)
    + `<text x="${x + w / 2}" y="${y + h - 8}" font-size="11" fill="#111827" text-anchor="middle">${esc(nome)}</text>`
    + `</g>`
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
  if (f.tipo === 'componente') {
    return componenteSVG(f)
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
