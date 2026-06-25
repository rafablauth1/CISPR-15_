'use client'

import { useRef, useState } from 'react'
import { MousePointer2, Square, Circle, Minus, Type as TypeIcon, Trash2, Cable, Undo2, Redo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Forma } from '@/lib/instrucoes/tipos'
import { COR_PADRAO, GRUPOS_COMP, CABOS, COMP_W, COMP_H, componenteSVG, conexaoSVG, linhaCaboSVG, pontosBase, pontosConexao, rotaConexao } from '@/lib/instrucoes/diagrama'

type Tool = 'select' | 'conectar' | 'retangulo' | 'elipse' | 'linha' | 'texto'
const CORES = ['#1f2937', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed']
const CONECTORES = ['Entrada', 'Saída', 'RF', 'Alim.', 'Linha', 'Neutro', 'Terra', 'Sinal'] // presets do menu
const FERRAMENTAS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: 'select',    icon: MousePointer2, label: 'Selecionar / mover' },
  { id: 'conectar',  icon: Cable,         label: 'Conectar (cabo entre equipamentos)' },
  { id: 'retangulo', icon: Square,        label: 'Retângulo' },
  { id: 'elipse',    icon: Circle,        label: 'Elipse' },
  { id: 'linha',     icon: Minus,         label: 'Linha / fio' },
  { id: 'texto',     icon: TypeIcon,      label: 'Texto' },
]
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

export function DiagramaEditor({ formas, w, h, onChange }: {
  formas: Forma[]; w: number; h: number; onChange: (f: Forma[]) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [cor, setCor] = useState(COR_PADRAO)
  const [sel, setSel] = useState<string | null>(null)
  const [caboSel, setCaboSel] = useState('simples') // tipo de cabo ativo (p/ linha e conexão)
  const [conFrom, setConFrom] = useState<string | null>(null) // 1º componente clicado p/ conectar
  const conFromPos = useRef<{ x: number; y: number } | null>(null) // bolinha do 1º clique
  const [guias, setGuias] = useState<{ vx?: number; hy?: number }[]>([]) // guias de alinhamento
  // Menu de "criar conexão" (botão direito): posição na tela + alvo + posição relativa.
  const [portaMenu, setPortaMenu] = useState<{ cx: number; cy: number; fid: string; px: number; py: number; removeIdx?: number; removeBase?: number; nomeAtual?: string } | null>(null)
  const [portaNome, setPortaNome] = useState('') // nome digitado p/ conexão "Outro"
  const draftRef = useRef<string | null>(null)
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const moveRef = useRef<{ id: string; ox: number; oy: number; isLine: boolean; snapped: boolean } | null>(null)
  const resizeRef = useRef<{ id: string; corner: string; ox: number; oy: number } | null>(null)
  const wpRef = useRef<{ cid: string; idx: number } | null>(null) // arrastando a dobra idx de um cabo
  // Histórico (desfazer/refazer) e área de transferência de formas.
  const histRef = useRef<Forma[][]>([])
  const redoRef = useRef<Forma[][]>([])
  const clipRef = useRef<Forma | null>(null)

  const selecionada = formas.find(f => f.id === sel) || null
  const byId: Record<string, Forma> = Object.fromEntries(formas.map(f => [f.id, f]))

  // Tira um snapshot ANTES de uma ação discreta (criar/mover/excluir/colar).
  function snapshot() {
    histRef.current.push(formas.map(f => ({ ...f })))
    if (histRef.current.length > 80) histRef.current.shift()
    redoRef.current = []
  }
  function undo() {
    const prev = histRef.current.pop(); if (!prev) return
    redoRef.current.push(formas.map(f => ({ ...f })))
    onChange(prev); setSel(null)
  }
  function redo() {
    const next = redoRef.current.pop(); if (!next) return
    histRef.current.push(formas.map(f => ({ ...f })))
    onChange(next)
  }
  function colar() {
    const c = clipRef.current; if (!c) return
    snapshot()
    const id = uid()
    const nova: Forma = { ...c, id, x: c.x + 18, y: c.y + 18 }
    if (c.x2 != null) { nova.x2 = c.x2 + 18; nova.y2 = (c.y2 ?? 0) + 18 }
    onChange([...formas, nova]); setSel(id)
  }
  function duplicar() { if (selecionada) { clipRef.current = { ...selecionada }; colar() } }

  function pt(e: React.PointerEvent) {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) }
  }

  // Alinhamento: encaixa a forma movida nas bordas/centros das outras e da página.
  function alinhar(f: Forma, todas: Forma[]) {
    const T = 6
    const fw = f.w ?? COMP_W, fh = f.h ?? COMP_H
    const alvosX: number[] = [0, w / 2, w], alvosY: number[] = [0, h / 2, h]
    for (const o of todas) {
      if (o.id === f.id || o.tipo === 'linha' || o.tipo === 'conexao') continue
      const ow = o.w ?? COMP_W, oh = o.h ?? COMP_H
      alvosX.push(o.x, o.x + ow / 2, o.x + ow)
      alvosY.push(o.y, o.y + oh / 2, o.y + oh)
    }
    let x = f.x, y = f.y
    const gs: { vx?: number; hy?: number }[] = []
    for (const [mx, off] of [[f.x, 0], [f.x + fw / 2, fw / 2], [f.x + fw, fw]] as [number, number][]) {
      const a = alvosX.find(v => Math.abs(mx - v) <= T)
      if (a !== undefined) { x = a - off; gs.push({ vx: a }); break }
    }
    for (const [my, off] of [[f.y, 0], [f.y + fh / 2, fh / 2], [f.y + fh, fh]] as [number, number][]) {
      const a = alvosY.find(v => Math.abs(my - v) <= T)
      if (a !== undefined) { y = a - off; gs.push({ hy: a }); break }
    }
    return { x, y, gs }
  }

  function onSvgPointerDown(e: React.PointerEvent) {
    if (e.target === svgRef.current && (tool === 'select' || tool === 'conectar')) { setSel(null); setConFrom(null); return }
    if (tool === 'select' || tool === 'conectar') return
    const { x, y } = pt(e)
    const id = uid()
    const nova: Forma =
      tool === 'linha' ? { id, tipo: 'linha', x, y, x2: x, y2: y, cor, cabo: caboSel } :
      tool === 'texto' ? { id, tipo: 'texto', x, y, texto: 'Texto', cor } :
                         { id, tipo: tool, x, y, w: 0, h: 0, cor }
    snapshot()
    onChange([...formas, nova])
    setSel(id)
    if (tool === 'texto') { setTool('select'); return }
    draftRef.current = id
    startRef.current = { x, y }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function startResize(e: React.PointerEvent, f: Forma, corner: string) {
    e.stopPropagation()
    setSel(f.id)
    snapshot()
    const { x, y } = pt(e)
    resizeRef.current = { id: f.id, corner, ox: x, oy: y }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  // Move a dobra idx de um cabo.
  function startWp(e: React.PointerEvent, c: Forma, idx: number) {
    e.stopPropagation()
    setSel(c.id)
    snapshot()
    wpRef.current = { cid: c.id, idx }
    svgRef.current?.setPointerCapture(e.pointerId)
  }
  // Insere uma nova dobra no trecho segIdx e já começa a arrastá-la.
  function addWp(e: React.PointerEvent, c: Forma, segIdx: number) {
    e.stopPropagation()
    setSel(c.id)
    snapshot()
    const p = pt(e)
    const wps = [...(c.waypoints ?? [])]
    wps.splice(segIdx, 0, p)
    onChange(formas.map(f => f.id === c.id ? { ...f, waypoints: wps } : f))
    wpRef.current = { cid: c.id, idx: segIdx }
    svgRef.current?.setPointerCapture(e.pointerId)
  }
  function removeWp(c: Forma, idx: number) {
    snapshot()
    onChange(formas.map(f => f.id === c.id ? { ...f, waypoints: (f.waypoints ?? []).filter((_, i) => i !== idx) } : f))
  }

  function onSvgPointerMove(e: React.PointerEvent) {
    const { x, y } = pt(e)
    if (wpRef.current) {
      const { cid, idx } = wpRef.current
      onChange(formas.map(f => {
        if (f.id !== cid) return f
        const wps = [...(f.waypoints ?? [])]
        wps[idx] = { x, y }
        return { ...f, waypoints: wps }
      }))
      return
    }
    if (resizeRef.current) {
      const rz = resizeRef.current
      const dx = x - rz.ox, dy = y - rz.oy
      if (dx === 0 && dy === 0) return
      onChange(formas.map(f => {
        if (f.id !== rz.id) return f
        const w0 = f.w ?? COMP_W, h0 = f.h ?? COMP_H
        let nx = f.x, ny = f.y, nw = w0, nh = h0
        if (rz.corner.includes('e')) nw = Math.max(20, w0 + dx)
        if (rz.corner.includes('s')) nh = Math.max(16, h0 + dy)
        if (rz.corner.includes('w')) { nw = Math.max(20, w0 - dx); nx = f.x + (w0 - nw) }
        if (rz.corner.includes('n')) { nh = Math.max(16, h0 - dy); ny = f.y + (h0 - nh) }
        return { ...f, x: nx, y: ny, w: nw, h: nh }
      }))
      rz.ox = x; rz.oy = y
      return
    }
    if (draftRef.current) {
      const id = draftRef.current
      const s = startRef.current
      onChange(formas.map(f => f.id !== id ? f
        : f.tipo === 'linha'
          ? { ...f, x2: x, y2: y }
          : { ...f, x: Math.min(s.x, x), y: Math.min(s.y, y), w: Math.abs(x - s.x), h: Math.abs(y - s.y) }))
    } else if (moveRef.current) {
      const m = moveRef.current
      const dx = x - m.ox, dy = y - m.oy
      if (dx === 0 && dy === 0) return
      if (!m.snapped) { snapshot(); m.snapped = true }   // histórico só no 1º movimento real
      let next = formas.map(f => f.id !== m.id ? f
        : m.isLine
          ? { ...f, x: f.x + dx, y: f.y + dy, x2: (f.x2 ?? f.x) + dx, y2: (f.y2 ?? f.y) + dy }
          : { ...f, x: f.x + dx, y: f.y + dy })
      const mov = next.find(f => f.id === m.id)!
      if (mov.tipo !== 'linha' && mov.tipo !== 'conexao') {
        const { x: sx, y: sy, gs } = alinhar(mov, next)
        if (sx !== mov.x || sy !== mov.y) next = next.map(f => f.id === m.id ? { ...f, x: sx, y: sy } : f)
        setGuias(gs)
      }
      onChange(next)
      m.ox = x; m.oy = y
    }
  }

  function onSvgPointerUp() {
    if (draftRef.current) {
      const id = draftRef.current
      draftRef.current = null
      setTool('select')
      // Descarta forma minúscula (clique sem arrastar)
      const f = formas.find(x => x.id === id)
      if (f) {
        const tiny = f.tipo === 'linha'
          ? Math.hypot((f.x2 ?? f.x) - f.x, (f.y2 ?? f.y) - f.y) < 5
          : (f.w ?? 0) < 5 && (f.h ?? 0) < 5
        if (tiny) { onChange(formas.filter(x => x.id !== id)); setSel(null) }
      }
    }
    moveRef.current = null
    resizeRef.current = null
    wpRef.current = null
    setGuias([])
  }

  // Alças de redimensionamento (cantos) de uma forma de caixa selecionada.
  function alcas(f: Forma) {
    if (f.id !== sel || tool !== 'select') return null
    if (f.tipo !== 'componente' && f.tipo !== 'retangulo' && f.tipo !== 'elipse') return null
    const cw = f.w ?? COMP_W, ch = f.h ?? COMP_H
    const cantos: [string, number, number][] = [
      ['nw', f.x, f.y], ['ne', f.x + cw, f.y], ['sw', f.x, f.y + ch], ['se', f.x + cw, f.y + ch],
    ]
    return cantos.map(([c, hx, hy]) => (
      <rect key={c} x={hx - 4} y={hy - 4} width={8} height={8} fill="#6366f1" stroke="#fff" strokeWidth={1}
        style={{ cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }}
        onPointerDown={(e) => startResize(e, f, c)} />
    ))
  }

  // Botão direito num equipamento: perto de uma porta existente → remove;
  // senão → abre o menu "criar conexão" no ponto clicado.
  function addPorta(e: React.MouseEvent, f: Forma) {
    e.preventDefault()
    if (f.tipo !== 'componente') return
    const r = svgRef.current!.getBoundingClientRect()
    const ax = e.clientX - r.left, ay = e.clientY - r.top   // absoluto no SVG
    setPortaNome('')
    const base = { cx: e.clientX, cy: e.clientY, fid: f.id, px: Math.round(ax - f.x), py: Math.round(ay - f.y) }
    // 1) perto de um terminal PADRÃO (não oculto)? → remover (ocultar)
    const off = f.portasOff ?? []
    const bIdx = pontosBase(f).findIndex((p, i) => !off.includes(i) && Math.hypot(p.x - ax, p.y - ay) <= 11)
    if (bIdx >= 0) { setPortaMenu({ ...base, removeBase: bIdx }); return }
    // 2) perto de uma porta nova? → remover
    const cIdx = (f.portas ?? []).findIndex(p => Math.hypot((f.x + p.x) - ax, (f.y + p.y) - ay) <= 11)
    if (cIdx >= 0) { setPortaMenu({ ...base, removeIdx: cIdx, nomeAtual: f.portas![cIdx].nome }); return }
    // 3) senão → menu de criar
    setPortaMenu(base)
  }
  function removerPorta() {
    const pm = portaMenu; if (!pm) return
    snapshot()
    onChange(formas.map(z => {
      if (z.id !== pm.fid) return z
      if (pm.removeBase != null) return { ...z, portasOff: [...(z.portasOff ?? []), pm.removeBase] }
      if (pm.removeIdx != null) return { ...z, portas: (z.portas ?? []).filter((_, i) => i !== pm.removeIdx) }
      return z
    }))
    setPortaMenu(null)
  }
  function criarPorta(nome: string) {
    const pm = portaMenu; if (!pm) return
    const f = formas.find(z => z.id === pm.fid)
    const cw = f?.w ?? COMP_W, ch = f?.h ?? COMP_H
    // Gruda o conector na BORDA mais próxima do ponto clicado.
    let px = Math.max(0, Math.min(cw, pm.px)), py = Math.max(0, Math.min(ch, pm.py))
    const dist = [px, cw - px, py, ch - py]
    const m = Math.min(...dist)
    if (m === px) px = 0
    else if (m === cw - px) px = cw
    else if (m === py) py = 0
    else py = ch
    snapshot()
    onChange(formas.map(z => z.id === pm.fid ? { ...z, portas: [...(z.portas ?? []), { x: px, y: py, nome: nome || undefined }] } : z))
    setSel(pm.fid); setPortaMenu(null); setPortaNome('')
  }

  function startMove(e: React.PointerEvent, f: Forma) {
    e.stopPropagation()
    // Modo conectar: clica numa bolinha do 1º equipamento, depois no 2º → cria o cabo.
    if (tool === 'conectar') {
      if (f.tipo !== 'componente') return
      const { x, y } = pt(e)
      const pts = pontosConexao(f)
      let np = pts[0], bd = Infinity
      for (const p of pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; np = p } }
      const pos = np ? { x: Math.round(np.x - f.x), y: Math.round(np.y - f.y) } : { x: Math.round(x - f.x), y: Math.round(y - f.y) }
      if (!conFrom) { setConFrom(f.id); conFromPos.current = pos; setSel(f.id); return }
      if (conFrom === f.id) { setConFrom(null); return }
      snapshot()
      onChange([...formas, { id: uid(), tipo: 'conexao', x: 0, y: 0, de: conFrom, dePos: conFromPos.current ?? undefined, para: f.id, paraPos: pos, cabo: caboSel }])
      setConFrom(null)
      return
    }
    setSel(f.id)
    if (tool !== 'select' || f.tipo === 'conexao') return
    const { x, y } = pt(e)
    moveRef.current = { id: f.id, ox: x, oy: y, isLine: f.tipo === 'linha', snapped: false }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  // Solta um componente de equipamento no quadro (com leve cascata p/ não empilhar).
  function addComponente(simbolo: string) {
    const n = formas.filter(f => f.tipo === 'componente').length
    const id = uid()
    const nova: Forma = {
      id, tipo: 'componente', simbolo,
      x: 40 + (n % 5) * 28, y: 40 + (n % 5) * 24,
      w: COMP_W, h: COMP_H, cor,
    }
    snapshot()
    onChange([...formas, nova])
    setSel(id)
    setTool('select')
  }

  function patchSel(patch: Partial<Forma>) {
    if (!sel) return
    onChange(formas.map(f => f.id === sel ? { ...f, ...patch } : f))
  }
  function aplicarCor(c: string) { setCor(c); if (sel) patchSel({ cor: c }) }
  function excluirSel() {
    if (!sel) return
    snapshot()
    // Remove a forma e, se for componente, os cabos ligados a ele.
    onChange(formas.filter(f => f.id !== sel && f.de !== sel && f.para !== sel))
    setSel(null)
  }
  // Atalhos de teclado no quadro (não atrapalha campos de texto).
  function onKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (e.key === 'Delete' || e.key === 'Backspace') { if (sel) { e.preventDefault(); excluirSel() } }
    else if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
    else if (mod && k === 'y') { e.preventDefault(); redo() }
    else if (mod && k === 'c') { if (selecionada) clipRef.current = { ...selecionada } }
    else if (mod && k === 'v') { e.preventDefault(); colar() }
    else if (mod && k === 'd') { e.preventDefault(); duplicar() }
    else if (e.key === 'Escape') { setConFrom(null); setSel(null) }
  }

  return (
    <div className="space-y-2 outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      {/* Barra de ferramentas */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
          {FERRAMENTAS.map(({ id, icon: Icon, label }) => (
            <button key={id} type="button" title={label} onClick={() => setTool(id)}
              className={cn('h-7 rounded-md flex items-center justify-center gap-1 transition-colors',
                id === 'conectar' ? 'px-2' : 'w-7',
                tool === id ? 'bg-brand/25 text-brand' : 'text-white/45 hover:text-white/80')}>
              <Icon size={14} />
              {id === 'conectar' && <span className="text-[10px] font-medium">Conectar</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {CORES.map(c => (
            <button key={c} type="button" title="Cor" onClick={() => aplicarCor(c)}
              className={cn('w-5 h-5 rounded-full border transition-transform', cor === c ? 'ring-2 ring-white/60 scale-110' : 'opacity-70 hover:opacity-100')}
              style={{ background: c, borderColor: 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
        <button type="button" onClick={undo} title="Desfazer (Ctrl+Z)" className="btn-ghost text-[11px] py-1"><Undo2 size={12} /></button>
        <button type="button" onClick={redo} title="Refazer (Ctrl+Y)" className="btn-ghost text-[11px] py-1"><Redo2 size={12} /></button>
        <button type="button" onClick={excluirSel} disabled={!sel}
          className="btn-ghost text-[11px] py-1 disabled:opacity-30"><Trash2 size={12} /> Excluir</button>
        <span className="text-[10px] text-white/30">
          {tool === 'conectar'
            ? (conFrom ? 'Agora clique no 2º equipamento. ' : 'Clique no 1º equipamento. ')
            : tool === 'select' ? 'Mover · botão direito no equipamento = porta · Del/Ctrl+Z/C/V. ' : 'Arraste pra desenhar. '}
          {formas.length} item{formas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tipo de cabo (ao desenhar linha ou conectar) */}
      {(tool === 'conectar' || tool === 'linha') && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/30 mr-1">Cabo</span>
          {CABOS.map(c => (
            <button key={c.id} type="button" onClick={() => setCaboSel(c.id)}
              className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border transition-colors',
                caboSel === c.id ? 'border-white/50 text-white' : 'border-white/10 text-white/50 hover:text-white/80')}>
              <span className="w-3 h-0.5 rounded" style={{ background: c.cor }} />{c.nome}
            </button>
          ))}
        </div>
      )}

      {/* Paleta de componentes por grupo (clique p/ soltar no quadro) */}
      <div className="space-y-1 max-h-32 overflow-y-auto pr-1 rounded-lg border border-white/8 p-2 bg-white/[0.02]">
        {GRUPOS_COMP.map(g => (
          <div key={g.grupo} className="flex items-start gap-1.5 flex-wrap">
            <span className="text-[9px] font-mono uppercase tracking-wider text-teal/60 w-full">{g.grupo}</span>
            {g.itens.map(c => (
              <button key={c.id} type="button" onClick={() => addComponente(c.id)} title={`Adicionar ${c.nome}`}
                className="px-2 py-0.5 rounded-md text-[10px] bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-teal/40 transition-colors">
                {c.nome}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Editar texto/rótulo da forma selecionada */}
      {selecionada && (selecionada.tipo === 'texto' || selecionada.tipo === 'retangulo' || selecionada.tipo === 'elipse' || selecionada.tipo === 'componente') && (
        <input className="input text-[11px] py-1" placeholder={selecionada.tipo === 'componente' ? 'Nome do equipamento' : selecionada.tipo === 'texto' ? 'Texto' : 'Rótulo (opcional)'}
          value={selecionada.texto ?? ''} onChange={e => patchSel({ texto: e.target.value })} />
      )}

      {/* Quadro de desenho */}
      <div className="overflow-auto rounded-lg border border-white/10" style={{ background: '#ffffff', maxWidth: '100%' }}>
        <svg ref={svgRef} width={w} height={h}
          onPointerDown={onSvgPointerDown} onPointerMove={onSvgPointerMove} onPointerUp={onSvgPointerUp}
          style={{ display: 'block', touchAction: 'none', cursor: tool === 'select' ? 'default' : 'crosshair' }}>
          {/* Camada de conexões (cabos) — atrás dos componentes */}
          {formas.filter(f => f.tipo === 'conexao').map(c => {
            const selC = c.id === sel
            const pts = selC ? rotaConexao(c, byId) : []
            const wps = c.waypoints ?? []
            const anchors = pts.length >= 2 ? [pts[0], ...wps, pts[pts.length - 1]] : []
            return (
              <g key={c.id}>
                <g onPointerDown={(e) => startMove(e, c)}
                  style={{ cursor: 'pointer', opacity: selC ? 0.6 : 1 }}
                  dangerouslySetInnerHTML={{ __html: conexaoSVG(c, byId) }} />
                {selC && anchors.slice(0, -1).map((a, i) => {
                  const b = anchors[i + 1]
                  return <circle key={'add' + i} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={4}
                    fill="#fff" stroke="#6366f1" strokeWidth={1.5} style={{ cursor: 'crosshair' }}
                    onPointerDown={(e) => addWp(e, c, i)} />
                })}
                {selC && wps.map((w, k) => (
                  <circle key={'wp' + k} cx={w.x} cy={w.y} r={5} fill="#6366f1" stroke="#fff" strokeWidth={1.5}
                    style={{ cursor: 'move' }} onPointerDown={(e) => startWp(e, c, k)}
                    onContextMenu={(e) => { e.preventDefault(); removeWp(c, k) }} />
                ))}
              </g>
            )
          })}
          {formas.map(f => {
            if (f.tipo === 'conexao') return null
            const isSel = f.id === sel || f.id === conFrom
            const stroke = f.cor || COR_PADRAO
            const comum = {
              onPointerDown: (e: React.PointerEvent) => startMove(e, f),
              style: { cursor: tool === 'select' ? 'move' : 'inherit' as const },
            }
            if (f.tipo === 'retangulo') return (
              <g key={f.id} {...comum}>
                <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={6} fill="#ffffff" stroke={stroke} strokeWidth={2} />
                {f.texto && <text x={(f.x) + (f.w ?? 0) / 2} y={(f.y) + (f.h ?? 0) / 2} fontSize={13} fill="#111827" textAnchor="middle" dominantBaseline="central">{f.texto}</text>}
                {isSel && <rect x={f.x - 2} y={f.y - 2} width={(f.w ?? 0) + 4} height={(f.h ?? 0) + 4} fill="none" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" />}
                {alcas(f)}
              </g>
            )
            if (f.tipo === 'elipse') return (
              <g key={f.id} {...comum}>
                <ellipse cx={f.x + (f.w ?? 0) / 2} cy={f.y + (f.h ?? 0) / 2} rx={Math.abs((f.w ?? 0) / 2)} ry={Math.abs((f.h ?? 0) / 2)} fill="#ffffff" stroke={stroke} strokeWidth={2} />
                {f.texto && <text x={f.x + (f.w ?? 0) / 2} y={f.y + (f.h ?? 0) / 2} fontSize={13} fill="#111827" textAnchor="middle" dominantBaseline="central">{f.texto}</text>}
                {isSel && <rect x={f.x - 2} y={f.y - 2} width={(f.w ?? 0) + 4} height={(f.h ?? 0) + 4} fill="none" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" />}
                {alcas(f)}
              </g>
            )
            if (f.tipo === 'linha') return (
              <g key={f.id} {...comum}>
                {isSel && <line x1={f.x} y1={f.y} x2={f.x2} y2={f.y2} stroke="#6366f1" strokeWidth={7} strokeOpacity={0.25} strokeLinecap="round" />}
                <g dangerouslySetInnerHTML={{ __html: linhaCaboSVG(f.x, f.y, f.x2 ?? f.x, f.y2 ?? f.y, f.cabo, f.cor) }} />
              </g>
            )
            if (f.tipo === 'componente') return (
              <g key={f.id} {...comum} onContextMenu={(e) => addPorta(e, f)}>
                <g dangerouslySetInnerHTML={{ __html: componenteSVG(f) }} />
                {isSel && <rect x={f.x - 2} y={f.y - 2} width={(f.w ?? COMP_W) + 4} height={(f.h ?? COMP_H) + 4} fill="none" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" />}
                {alcas(f)}
              </g>
            )
            return (
              <g key={f.id} {...comum}>
                <text x={f.x} y={f.y} fontSize={14} fill={stroke} dominantBaseline="hanging">{f.texto || 'Texto'}</text>
                {isSel && <rect x={f.x - 2} y={f.y - 2} width={Math.max(40, (f.texto?.length ?? 5) * 8)} height={20} fill="none" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" />}
              </g>
            )
          })}
          {/* Guias de alinhamento (aparecem ao arrastar) */}
          {guias.map((g, i) => g.vx != null
            ? <line key={i} x1={g.vx} y1={0} x2={g.vx} y2={h} stroke="#ec4899" strokeWidth={1} strokeDasharray="4 3" />
            : <line key={i} x1={0} y1={g.hy} x2={w} y2={g.hy} stroke="#ec4899" strokeWidth={1} strokeDasharray="4 3" />)}
        </svg>
      </div>

      {/* Menu "criar conexão" (botão direito no equipamento) */}
      {portaMenu && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setPortaMenu(null)} onContextMenu={(e) => { e.preventDefault(); setPortaMenu(null) }} />
          <div className="fixed z-[9999] card p-1.5 shadow-2xl" style={{ left: portaMenu.cx, top: portaMenu.cy, background: '#141B28' }}>
            {(portaMenu.removeIdx != null || portaMenu.removeBase != null) ? (
              <>
                <p className="text-[9px] font-mono uppercase tracking-wider text-white/40 px-1.5 pb-1">
                  Conexão{portaMenu.nomeAtual ? ` "${portaMenu.nomeAtual}"` : ''}
                </p>
                <button type="button" onClick={removerPorta}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-red-300 hover:bg-red-500/15">
                  <Trash2 size={12} /> Remover conexão
                </button>
              </>
            ) : (
              <>
                <p className="text-[9px] font-mono uppercase tracking-wider text-white/40 px-1.5 pb-1">Criar conexão</p>
                <div className="grid grid-cols-2 gap-0.5">
                  {CONECTORES.map(n => (
                    <button key={n} type="button" onClick={() => criarPorta(n)}
                      className="text-left px-2 py-1 rounded text-[11px] text-white/70 hover:bg-white/10 hover:text-white">{n}</button>
                  ))}
                </div>
                <div className="flex gap-1 mt-1 px-0.5">
                  <input autoFocus value={portaNome} onChange={e => setPortaNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && portaNome.trim()) criarPorta(portaNome.trim()); if (e.key === 'Escape') setPortaMenu(null) }}
                    placeholder="outro nome…" className="input text-[11px] py-0.5 w-28" />
                  <button type="button" onClick={() => portaNome.trim() && criarPorta(portaNome.trim())}
                    className="px-2 py-0.5 rounded text-[11px] bg-teal/20 text-teal hover:bg-teal/30">OK</button>
                </div>
                <button type="button" onClick={() => criarPorta('')}
                  className="w-full text-left px-2 py-1 mt-0.5 rounded text-[11px] text-white/40 hover:bg-white/10">Sem nome</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
