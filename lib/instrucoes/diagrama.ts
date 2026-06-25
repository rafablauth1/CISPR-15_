// Renderização de um diagrama (formas) em SVG. O MESMO markup é usado no editor,
// na visualização e na geração de PDF — garante que o que se edita é o que sai.

import type { Forma, BlocoDiagrama } from './tipos'

export const DIAGRAMA_W = 760
export const DIAGRAMA_H = 420
export const COR_PADRAO = '#1f2937'

// Tamanho padrão de um componente ao ser solto no quadro.
export const COMP_W = 120
export const COMP_H = 64

// Paleta de componentes (estilo Proteus), dividida em grupos.
export const GRUPOS_COMP: { grupo: string; itens: { id: string; nome: string }[] }[] = [
  { grupo: 'RF / EMC', itens: [
    { id: 'gerador',          nome: 'Gerador RF' },
    { id: 'gerador-nivel',    nome: 'Gerador de nível' },
    { id: 'analisador',       nome: 'Analisador de espectro' },
    { id: 'receptor',         nome: 'Receptor EMI' },
    { id: 'amplificador',     nome: 'Amplificador' },
    { id: 'lisn',             nome: 'LISN' },
    { id: 'antena',           nome: 'Antena' },
    { id: 'atenuador',        nome: 'Atenuador' },
    { id: 'filtro-linha',     nome: 'Filtro de linha' },
    { id: 'acoplador-rede',   nome: 'Acoplador de rede' },
    { id: 'acoplador-bi',     nome: 'Acoplador bidirecional' },
    { id: 'terminacao',       nome: 'Terminação' },
    { id: 'eut',              nome: 'EUT' },
  ] },
  { grupo: 'Elétrica', itens: [
    { id: 'multimetro',          nome: 'Multímetro' },
    { id: 'multimetro-varredura',nome: 'Multímetro de varredura' },
    { id: 'wattimetro',          nome: 'Wattímetro digital' },
    { id: 'fonte-tensao',        nome: 'Fonte de tensão' },
    { id: 'osciloscopio',        nome: 'Osciloscópio digital' },
    { id: 'data-logger',         nome: 'Data Logger' },
    { id: 'analisador-bateria',  nome: 'Analisador de bateria' },
    { id: 'tacometro',           nome: 'Tacômetro' },
  ] },
  { grupo: 'Ambiente / Físicas', itens: [
    { id: 'termohigrometro', nome: 'Termo-higrômetro' },
    { id: 'termometro',      nome: 'Termômetro digital' },
    { id: 'barometro',       nome: 'Barômetro' },
    { id: 'manometro',       nome: 'Manômetro' },
    { id: 'cronometro',      nome: 'Cronômetro digital' },
  ] },
  { grupo: 'Volumétrica / Química', itens: [
    { id: 'balao',      nome: 'Balão volumétrico' },
    { id: 'proveta',    nome: 'Proveta' },
    { id: 'micropipeta',nome: 'Micropipeta' },
    { id: 'ph',         nome: 'Medidor de pH' },
    { id: 'balanca',    nome: 'Balança' },
  ] },
  { grupo: 'Dimensional / Diversos', itens: [
    { id: 'paquimetro',  nome: 'Paquímetro digital' },
    { id: 'forno',       nome: 'Forno' },
    { id: 'refrigerador',nome: 'Refrigerador' },
  ] },
]
export const COMPONENTES = GRUPOS_COMP.flatMap(g => g.itens)
const NOME_COMP: Record<string, string> = Object.fromEntries(COMPONENTES.map(c => [c.id, c.nome]))

// Tipos de cabo. Cores NEUTRAS (tons de cinza/ardósia) — diferenciados pelo
// traço e pelo rótulo em cima da linha, não por cores berrantes.
export const CABOS: { id: string; nome: string; rotulo: string; cor: string; dash: string }[] = [
  { id: 'simples', nome: 'Simples',      rotulo: '',      cor: '#475569', dash: '' },
  { id: 'rf',      nome: 'RF',           rotulo: 'RF',    cor: '#1f2937', dash: '' },
  { id: 'rede',    nome: 'Rede',         rotulo: 'Rede',  cor: '#475569', dash: '7 4' },
  { id: 'linha',   nome: 'Linha (Fase)', rotulo: 'Linha', cor: '#dc2626', dash: '' },
  { id: 'neutro',  nome: 'Neutro',       rotulo: 'Neutro',cor: '#2563eb', dash: '' },
  { id: 'terra',   nome: 'Terra',        rotulo: 'Terra', cor: '#16a34a', dash: '' },
]
const CABO = Object.fromEntries(CABOS.map(c => [c.id, c]))

/** Estilo de uma linha/cabo: cor, traço, espessura e rótulo curto pelo tipo. */
export function estiloCabo(cabo: string | undefined, fallback?: string): { cor: string; dash: string; w: number; rotulo: string } {
  const c = cabo ? CABO[cabo] : undefined
  if (!c || cabo === 'simples') return { cor: fallback || COR_PADRAO, dash: '', w: 2.5, rotulo: '' }
  return { cor: c.cor, dash: c.dash, w: cabo === 'rf' ? 3 : 2.5, rotulo: c.rotulo }
}

/** Rótulo (nomezinho) centralizado em cima de uma linha de (x1,y1)→(x2,y2). */
function rotuloLinha(x1: number, y1: number, x2: number, y2: number, texto: string, cor: string): string {
  if (!texto) return ''
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  return `<text x="${mx}" y="${my - 5}" font-size="10" fill="${cor}" text-anchor="middle" style="paint-order:stroke" stroke="#ffffff" stroke-width="3">${texto}</text>`
}

/** SVG de uma linha de cabo (com o caso especial do Terra verde-amarelo) + rótulo. */
export function linhaCaboSVG(x1: number, y1: number, x2: number, y2: number, cabo?: string, fallback?: string): string {
  const e = estiloCabo(cabo, fallback)
  let linha: string
  if (cabo === 'terra') {
    // Terra: verde-amarelo listrado (amarelo por baixo + verde tracejado por cima).
    linha = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#eab308" stroke-width="${e.w}" stroke-linecap="round"/>`
          + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#16a34a" stroke-width="${e.w}" stroke-dasharray="6 6"/>`
  } else {
    const dash = e.dash ? ` stroke-dasharray="${e.dash}"` : ''
    linha = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${e.cor}" stroke-width="${e.w}" stroke-linecap="round"${dash}/>`
  }
  return linha + rotuloLinha(x1, y1, x2, y2, e.rotulo, e.cor)
}

/** Terminais PADRÃO de um componente (posições absolutas), sem os ocultos. */
export function pontosBase(f: Forma): { x: number; y: number }[] {
  const w = f.w ?? COMP_W, h = f.h ?? COMP_H
  return f.simbolo === 'acoplador-bi'
    // Acoplador bidirecional: 1 porta em cada ponta + 2 acopladas no meio (mesmo lado).
    ? [{ x: f.x, y: f.y + h / 2 }, { x: f.x + w, y: f.y + h / 2 },
       { x: f.x + w * 0.35, y: f.y + h }, { x: f.x + w * 0.65, y: f.y + h }]
    : [{ x: f.x, y: f.y + h / 2 }, { x: f.x + w, y: f.y + h / 2 }]
}

/** Pontos de conexão: terminais padrão (menos os ocultos) + portas extras. */
export function pontosConexao(f: Forma): { x: number; y: number }[] {
  const off = f.portasOff ?? []
  const base = pontosBase(f).filter((_, i) => !off.includes(i))
  const extra = (f.portas ?? []).map(p => ({ x: f.x + p.x, y: f.y + p.y }))
  return [...base, ...extra]
}

/** Markup de UMA conexão (cabo) entre dois componentes — liga os terminais que se enfrentam. */
export function conexaoSVG(c: Forma, byId: Record<string, Forma>): string {
  const a = byId[c.de || ''], b = byId[c.para || '']
  if (!a || !b) return ''
  // Usa o ponto exato clicado (dePos/paraPos); senão, o par de pontos mais próximos.
  let p1: { x: number; y: number } | undefined
  let p2: { x: number; y: number } | undefined
  if (c.dePos) p1 = { x: a.x + c.dePos.x, y: a.y + c.dePos.y }
  if (c.paraPos) p2 = { x: b.x + c.paraPos.x, y: b.y + c.paraPos.y }
  if (!p1 || !p2) {
    const pa = pontosConexao(a), pb = pontosConexao(b)
    if (!pa.length || !pb.length) return ''
    let best = { d: Infinity, p1: pa[0], p2: pb[0] }
    for (const a1 of pa) for (const b1 of pb) {
      const d = (a1.x - b1.x) ** 2 + (a1.y - b1.y) ** 2
      if (d < best.d) best = { d, p1: a1, p2: b1 }
    }
    p1 = p1 ?? best.p1; p2 = p2 ?? best.p2
  }
  // Roteamento ortogonal que desvia dos componentes (menos os dois conectados).
  const obst: Caixa[] = Object.values(byId)
    .filter(f => f.tipo === 'componente' && f.id !== a.id && f.id !== b.id)
    .map(f => ({ x: f.x, y: f.y, w: f.w ?? COMP_W, h: f.h ?? COMP_H }))
  const pts = rotaCabo(p1, dirPorta(a, p1), p2, dirPorta(b, p2), obst)
  return caboPolySVG(pts, c.cabo, undefined)
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Glifo (símbolo) de cada equipamento, desenhado dentro de (gx,gy)..(gx+cw, gy+~22).
// Desenhos simples ("humildes"), nítidos em qualquer escala.
function glifo(simbolo: string, gx: number, gy: number, cw: number, cor: string): string {
  const cx = gx + cw / 2, cy = gy + 11
  const sw = (w = 1.6) => `stroke="${cor}" stroke-width="${w}" fill="none"`
  const disp = (t: string) => `<rect x="${gx}" y="${gy + 2}" width="${cw}" height="16" rx="2" ${sw(1.4)}/><text x="${cx}" y="${gy + 14}" font-size="9" fill="${cor}" text-anchor="middle">${t}</text>`
  const dial = (t = '') => `<circle cx="${cx}" cy="${cy}" r="9" ${sw(1.4)}/><line x1="${cx}" y1="${cy}" x2="${cx + 6}" y2="${cy - 5}" ${sw(1.4)}/>` + (t ? `<text x="${cx}" y="${gy + 24}" font-size="7" fill="${cor}" text-anchor="middle">${t}</text>` : '')
  const sine = () => `<path d="M${gx} ${cy} q ${cw * 0.12} -8 ${cw * 0.25} 0 t ${cw * 0.25} 0 t ${cw * 0.25} 0" ${sw(1.8)}/>`
  const screen = () => `<rect x="${gx}" y="${gy + 2}" width="${cw}" height="18" rx="2" ${sw(1.4)}/>`
  const peaks = () => screen() + `<polyline points="${gx + 3},${gy + 18} ${gx + cw * 0.3},${gy + 7} ${gx + cw * 0.45},${gy + 16} ${gx + cw * 0.65},${gy + 5} ${gx + cw * 0.8},${gy + 17} ${gx + cw - 3},${gy + 12}" ${sw(1.4)}/>`
  const term = (cx0: number) => `<circle cx="${cx0}" cy="${cy}" r="2.5" fill="${cor}"/>`
  switch (simbolo) {
    case 'gerador':       return sine()
    case 'gerador-nivel': return sine() + `<text x="${cx}" y="${gy + 24}" font-size="7" fill="${cor}" text-anchor="middle">dBm</text>`
    case 'analisador':    return peaks() + `<text x="${cx}" y="${gy + 26}" font-size="7" fill="${cor}" text-anchor="middle">dBm</text>`
    case 'receptor':      return peaks() + `<text x="${cx}" y="${gy + 26}" font-size="7" fill="${cor}" text-anchor="middle">dBµV</text>`
    case 'medidor':       return disp('MED')
    case 'amplificador':  return `<polygon points="${gx + 6},${gy + 2} ${gx + 6},${gy + 20} ${gx + cw - 6},${gy + 11}" ${sw(1.8)}/>`
    case 'lisn':          return `<path d="M${gx} ${cy} a4 4 0 1 1 8 0 a4 4 0 1 1 8 0 a4 4 0 1 1 8 0 a4 4 0 1 1 8 0" ${sw(1.8)}/>`
    case 'antena':        return `<line x1="${cx}" y1="${gy + 20}" x2="${cx}" y2="${gy + 8}" ${sw(1.8)}/><line x1="${cx - 10}" y1="${gy + 2}" x2="${cx + 10}" y2="${gy + 2}" ${sw(1.8)}/><line x1="${cx}" y1="${gy + 8}" x2="${cx - 8}" y2="${gy + 2}" ${sw(1.8)}/><line x1="${cx}" y1="${gy + 8}" x2="${cx + 8}" y2="${gy + 2}" ${sw(1.8)}/>`
    case 'atenuador':     return `<rect x="${gx}" y="${gy + 4}" width="${cw}" height="14" rx="2" ${sw(1.4)}/><text x="${cx}" y="${gy + 14}" font-size="10" fill="${cor}" text-anchor="middle">−dB</text>`
    case 'filtro-linha':  return `<path d="M${gx} ${gy + 4} h ${cw * 0.5} q ${cw * 0.15} 0 ${cw * 0.2} 14 l ${cw * 0.3} 0" ${sw(1.8)}/>`
    case 'acoplador-rede':return `<line x1="${gx}" y1="${gy + 6}" x2="${gx + cw}" y2="${gy + 6}" ${sw(1.6)}/><line x1="${gx}" y1="${gy + 16}" x2="${gx + cw}" y2="${gy + 16}" ${sw(1.6)}/><line x1="${cx - 8}" y1="${gy + 6}" x2="${cx - 8}" y2="${gy + 16}" ${sw(1.2)}/><line x1="${cx + 8}" y1="${gy + 6}" x2="${cx + 8}" y2="${gy + 16}" ${sw(1.2)}/>`
    case 'acoplador-bi':  return `<rect x="${gx}" y="${gy + 4}" width="${cw}" height="14" rx="2" ${sw(1.4)}/><text x="${cx}" y="${gy + 15}" font-size="11" fill="${cor}" text-anchor="middle">⇄</text>`
    case 'cabo-rf':       return `<line x1="${gx}" y1="${cy}" x2="${gx + cw}" y2="${cy}" ${sw(2)}/>` + term(gx) + term(gx + cw)
    case 'terminacao':    return `<line x1="${gx}" y1="${cy}" x2="${cx}" y2="${cy}" ${sw(1.6)}/><line x1="${cx}" y1="${gy + 4}" x2="${cx}" y2="${gy + 18}" ${sw(1.6)}/><line x1="${cx + 5}" y1="${gy + 6}" x2="${cx + 5}" y2="${gy + 16}" ${sw(1.4)}/><line x1="${cx + 10}" y1="${gy + 8}" x2="${cx + 10}" y2="${gy + 14}" ${sw(1.2)}/>`
    case 'eut':           return `<rect x="${gx}" y="${gy + 2}" width="${cw}" height="16" rx="2" ${sw(1.4)}/><text x="${cx}" y="${gy + 14}" font-size="9" fill="${cor}" text-anchor="middle">EUT</text>`
    // Elétrica
    case 'multimetro':           return disp('V Ω')
    case 'multimetro-varredura': return disp('V~ ⟳')
    case 'wattimetro':           return disp('W')
    case 'fonte-tensao':         return `<line x1="${cx - 9}" y1="${gy + 4}" x2="${cx - 9}" y2="${gy + 18}" ${sw(2)}/><line x1="${cx - 3}" y1="${gy + 7}" x2="${cx - 3}" y2="${gy + 15}" ${sw(1.4)}/><text x="${cx + 8}" y="${gy + 15}" font-size="10" fill="${cor}" text-anchor="middle">V⎓</text>`
    case 'osciloscopio':         return screen() + sine()
    case 'data-logger':          return disp('LOG')
    case 'analisador-bateria':   return `<rect x="${gx}" y="${gy + 5}" width="${cw - 4}" height="12" rx="1" ${sw(1.4)}/><rect x="${gx + cw - 4}" y="${gy + 8}" width="3" height="6" fill="${cor}"/><text x="${cx}" y="${gy + 14}" font-size="8" fill="${cor}" text-anchor="middle">+ −</text>`
    case 'tacometro':            return dial('rpm')
    // Ambiente / físicas
    case 'termohigrometro':      return `<line x1="${gx + 8}" y1="${gy + 2}" x2="${gx + 8}" y2="${gy + 15}" ${sw(1.6)}/><circle cx="${gx + 8}" cy="${gy + 18}" r="3" fill="${cor}"/><path d="M${gx + cw - 14} ${gy + 4} q 5 7 0 10 q -5 -3 0 -10" ${sw(1.4)}/>`
    case 'termometro':           return `<line x1="${cx}" y1="${gy + 2}" x2="${cx}" y2="${gy + 15}" ${sw(1.8)}/><circle cx="${cx}" cy="${gy + 18}" r="3.5" fill="${cor}"/>`
    case 'barometro':            return dial('hPa')
    case 'manometro':            return dial('bar')
    case 'cronometro':           return `<circle cx="${cx}" cy="${gy + 13}" r="8" ${sw(1.4)}/><line x1="${cx}" y1="${gy + 2}" x2="${cx}" y2="${gy + 5}" ${sw(1.6)}/><line x1="${cx}" y1="${gy + 13}" x2="${cx + 4}" y2="${gy + 9}" ${sw(1.4)}/>`
    // Volumétrica / química
    case 'balao':                return `<path d="M${cx - 3} ${gy + 2} h 6 v 5 l 7 11 a 9 9 0 1 1 -20 0 l 7 -11 z" ${sw(1.5)}/>`
    case 'proveta':              return `<rect x="${cx - 7}" y="${gy + 2}" width="14" height="19" rx="1" ${sw(1.4)}/><line x1="${cx + 1}" y1="${gy + 7}" x2="${cx + 5}" y2="${gy + 7}" ${sw(1)}/><line x1="${cx + 1}" y1="${gy + 12}" x2="${cx + 5}" y2="${gy + 12}" ${sw(1)}/>`
    case 'micropipeta':          return `<rect x="${cx - 3}" y="${gy + 2}" width="6" height="6" rx="1" ${sw(1.4)}/><path d="M${cx - 3} ${gy + 8} h 6 l -2 12 h -2 z" ${sw(1.4)}/>`
    case 'ph':                   return `<path d="M${cx - 6} ${gy + 6} q 6 9 0 12 q -6 -3 0 -12" ${sw(1.5)}/><text x="${cx + 9}" y="${gy + 16}" font-size="9" fill="${cor}" text-anchor="middle">pH</text>`
    case 'balanca':              return `<line x1="${gx + 6}" y1="${gy + 6}" x2="${gx + cw - 6}" y2="${gy + 6}" ${sw(1.6)}/><line x1="${cx}" y1="${gy + 6}" x2="${cx}" y2="${gy + 18}" ${sw(1.4)}/><path d="M${gx + 2} ${gy + 6} l 4 8 h -8 z" ${sw(1.2)}/><path d="M${gx + cw - 2} ${gy + 6} l -4 8 h 8 z" ${sw(1.2)}/>`
    // Dimensional / diversos
    case 'paquimetro':           return `<line x1="${gx}" y1="${gy + 8}" x2="${gx + cw}" y2="${gy + 8}" ${sw(1.6)}/><line x1="${gx + 2}" y1="${gy + 8}" x2="${gx + 2}" y2="${gy + 16}" ${sw(1.6)}/><line x1="${gx + cw * 0.6}" y1="${gy + 8}" x2="${gx + cw * 0.6}" y2="${gy + 16}" ${sw(1.6)}/>`
    case 'forno':                return `<rect x="${gx}" y="${gy + 2}" width="${cw}" height="18" rx="2" ${sw(1.4)}/><path d="M${cx - 8} ${gy + 16} q 4 -4 0 -8 m 8 8 q 4 -4 0 -8" ${sw(1.3)}/>`
    case 'refrigerador':         return `<rect x="${cx - 8}" y="${gy + 1}" width="16" height="20" rx="2" ${sw(1.4)}/><line x1="${cx - 8}" y1="${gy + 9}" x2="${cx + 8}" y2="${gy + 9}" ${sw(1.2)}/><line x1="${cx - 4}" y1="${gy + 4}" x2="${cx - 4}" y2="${gy + 7}" ${sw(1.2)}/>`
    default:                     return `<rect x="${gx}" y="${gy + 2}" width="${cw}" height="16" rx="2" ${sw(1.4)}/>`
  }
}

// ── Roteamento ortogonal de cabos (desvia dos componentes) ──────────────────
interface Caixa { x: number; y: number; w: number; h: number }
type Dir = 'l' | 'r' | 't' | 'b'

/** Em qual borda do componente está o ponto (p/ saber a direção de saída). */
function dirPorta(f: Forma, p: { x: number; y: number }): Dir {
  const w = f.w ?? COMP_W, h = f.h ?? COMP_H
  const rx = p.x - f.x, ry = p.y - f.y
  const ds: [Dir, number][] = [['l', rx], ['r', w - rx], ['t', ry], ['b', h - ry]]
  return ds.sort((a, b) => a[1] - b[1])[0][0]
}

function afastar(p: { x: number; y: number }, d: Dir, s: number) {
  return d === 'l' ? { x: p.x - s, y: p.y } : d === 'r' ? { x: p.x + s, y: p.y }
    : d === 't' ? { x: p.x, y: p.y - s } : { x: p.x, y: p.y + s }
}

// Um segmento ortogonal cruza a caixa? (com leve margem interna p/ tolerar bordas)
function segCruzaCaixa(x1: number, y1: number, x2: number, y2: number, b: Caixa): boolean {
  const m = 2
  const bx1 = b.x + m, by1 = b.y + m, bx2 = b.x + b.w - m, by2 = b.y + b.h - m
  return Math.min(x1, x2) < bx2 && Math.max(x1, x2) > bx1 && Math.min(y1, y2) < by2 && Math.max(y1, y2) > by1
}

function rotaCruza(pts: { x: number; y: number }[], obst: Caixa[]): boolean {
  for (let i = 0; i < pts.length - 1; i++)
    for (const b of obst)
      if (segCruzaCaixa(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, b)) return true
  return false
}

function dedup(pts: { x: number; y: number }[]) {
  return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y)
}

function comprimento(pts: { x: number; y: number }[]) {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y)
  return s
}

/** Rota ortogonal entre dois pontos (stub na direção da porta), desviando dos obstáculos. */
function rotaCabo(p1: { x: number; y: number }, d1: Dir, p2: { x: number; y: number }, d2: Dir, obst: Caixa[]) {
  const S = 18, M = 12
  const e1 = afastar(p1, d1, S), e2 = afastar(p2, d2, S)
  // Canais candidatos: meio, pontas, e rente às bordas de cada obstáculo (p/ contornar).
  const xs = new Set<number>([(e1.x + e2.x) / 2, e1.x, e2.x])
  const ys = new Set<number>([(e1.y + e2.y) / 2, e1.y, e2.y])
  for (const b of obst) {
    xs.add(b.x - M); xs.add(b.x + b.w + M)
    ys.add(b.y - M); ys.add(b.y + b.h + M)
  }
  const cands: { x: number; y: number }[][] = []
  for (const mx of xs) cands.push(dedup([p1, e1, { x: mx, y: e1.y }, { x: mx, y: e2.y }, e2, p2]))
  for (const my of ys) cands.push(dedup([p1, e1, { x: e1.x, y: my }, { x: e2.x, y: my }, e2, p2]))
  // "L" diretos (2 trechos)
  cands.push(dedup([p1, e1, { x: e2.x, y: e1.y }, e2, p2]))
  cands.push(dedup([p1, e1, { x: e1.x, y: e2.y }, e2, p2]))
  // Pega a rota mais curta que NÃO cruza obstáculo; se nenhuma, a mais curta no geral.
  const limpas = cands.filter(c => !rotaCruza(c, obst))
  const pool = limpas.length ? limpas : cands
  pool.sort((a, b) => comprimento(a) - comprimento(b))
  return pool[0]
}

/** Polyline de um cabo (com Terra verde-amarelo) + rótulo no meio. */
export function caboPolySVG(pts: { x: number; y: number }[], cabo?: string, fallback?: string): string {
  const e = estiloCabo(cabo, fallback)
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ')
  let path: string
  if (cabo === 'terra') {
    path = `<path d="${d}" fill="none" stroke="#eab308" stroke-width="${e.w}" stroke-linejoin="round"/>`
         + `<path d="${d}" fill="none" stroke="#16a34a" stroke-width="${e.w}" stroke-dasharray="6 6" stroke-linejoin="round"/>`
  } else {
    const dash = e.dash ? ` stroke-dasharray="${e.dash}"` : ''
    path = `<path d="${d}" fill="none" stroke="${e.cor}" stroke-width="${e.w}" stroke-linejoin="round"${dash}/>`
  }
  const mid = pts[Math.floor(pts.length / 2)] || pts[0]
  return path + (e.rotulo ? `<text x="${mid.x}" y="${mid.y - 5}" font-size="10" fill="${e.cor}" text-anchor="middle" style="paint-order:stroke" stroke="#ffffff" stroke-width="3">${e.rotulo}</text>` : '')
}

/** Markup de um COMPONENTE de equipamento (caixa + símbolo + nome + terminais). */
export function componenteSVG(f: Forma): string {
  const cor = f.cor || COR_PADRAO
  const x = f.x, y = f.y, w = f.w ?? COMP_W, h = f.h ?? COMP_H
  const nome = f.texto || NOME_COMP[f.simbolo || ''] || 'Equip.'
  const gw = Math.min(w - 24, 60)
  const gx = x + (w - gw) / 2
  const labelsPortas = (f.portas ?? []).map(p => p.nome
    ? `<text x="${x + p.x}" y="${y + p.y - 5}" font-size="8" fill="${cor}" text-anchor="middle" style="paint-order:stroke" stroke="#ffffff" stroke-width="2.5">${esc(p.nome)}</text>`
    : '').join('')
  return `<g>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="${cor}" stroke-width="2"/>`
    + pontosConexao(f).map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${cor}"/>`).join('')
    + glifo(f.simbolo || 'eut', gx, y + 8, gw, cor)
    + `<text x="${x + w / 2}" y="${y + h - 8}" font-size="11" fill="#111827" text-anchor="middle">${esc(nome)}</text>`
    + labelsPortas
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
    return linhaCaboSVG(x, y, f.x2 ?? x, f.y2 ?? y, f.cabo, f.cor)
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
  const formas = b.formas || []
  const byId: Record<string, Forma> = Object.fromEntries(formas.map(f => [f.id, f]))
  // Conexões (cabos) primeiro, atrás dos componentes.
  const cabos = formas.filter(f => f.tipo === 'conexao').map(f => conexaoSVG(f, byId)).join('')
  const resto = formas.filter(f => f.tipo !== 'conexao').map(formaSVG).join('')
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width:${w}px;border:1px solid #d1d5db;border-radius:8px;background:#ffffff">${cabos}${resto}</svg>`
}
