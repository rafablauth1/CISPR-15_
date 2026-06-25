'use client'

import { useRef, useState } from 'react'
import { MousePointer2, Square, Circle, Minus, Type as TypeIcon, Trash2, Cable, Undo2, Redo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Forma } from '@/lib/instrucoes/tipos'
import { COR_PADRAO, GRUPOS_COMP, CABOS, COMP_W, COMP_H, componenteSVG, conexaoSVG, linhaCaboSVG } from '@/lib/instrucoes/diagrama'

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
  const [guias, setGuias] = useState<{ vx?: number; hy?: number }[]>([]) // guias de alinhamento
  // Menu de "criar conexão" (botão direito): posição na tela + alvo + posição relativa.
  const [portaMenu, setPortaMenu] = useState<{ cx: number; cy: number; fid: string; px: number; py: number } | null>(null)
  const draftRef = useRef<string | null>(null)
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const moveRef = useRef<{ id: string; ox: number; oy: number; isLine: boolean; snapped: boolean } | null>(null)
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

  function onSvgPointerMove(e: React.PointerEvent) {
    const { x, y } = pt(e)
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
    setGuias([])
  }

  // Botão direito num equipamento → abre o menu "criar conexão" no ponto clicado.
  function addPorta(e: React.MouseEvent, f: Forma) {
    e.preventDefault()
    if (f.tipo !== 'componente') return
    const r = svgRef.current!.getBoundingClientRect()
    const px = Math.round(e.clientX - r.left - f.x), py = Math.round(e.clientY - r.top - f.y)
    setPortaMenu({ cx: e.clientX, cy: e.clientY, fid: f.id, px, py })
  }
  function criarPorta(nome: string) {
    const pm = portaMenu; if (!pm) return
    snapshot()
    onChange(formas.map(z => z.id === pm.fid ? { ...z, portas: [...(z.portas ?? []), { x: pm.px, y: pm.py, nome: nome || undefined }] } : z))
    setSel(pm.fid); setPortaMenu(null)
  }

  function startMove(e: React.PointerEvent, f: Forma) {
    e.stopPropagation()
    // Modo conectar: clica no 1º equipamento, depois no 2º → cria o cabo.
    if (tool === 'conectar') {
      if (f.tipo !== 'componente') return
      if (!conFrom) { setConFrom(f.id); setSel(f.id); return }
      if (conFrom === f.id) { setConFrom(null); return }
      snapshot()
      onChange([...formas, { id: uid(), tipo: 'conexao', x: 0, y: 0, de: conFrom, para: f.id, cabo: caboSel }])
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
          {formas.filter(f => f.tipo === 'conexao').map(c => (
            <g key={c.id} onPointerDown={(e) => startMove(e, c)}
              style={{ cursor: 'pointer', opacity: c.id === sel ? 0.5 : 1 }}
              dangerouslySetInnerHTML={{ __html: conexaoSVG(c, byId) }} />
          ))}
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
              </g>
            )
            if (f.tipo === 'elipse') return (
              <g key={f.id} {...comum}>
                <ellipse cx={f.x + (f.w ?? 0) / 2} cy={f.y + (f.h ?? 0) / 2} rx={Math.abs((f.w ?? 0) / 2)} ry={Math.abs((f.h ?? 0) / 2)} fill="#ffffff" stroke={stroke} strokeWidth={2} />
                {f.texto && <text x={f.x + (f.w ?? 0) / 2} y={f.y + (f.h ?? 0) / 2} fontSize={13} fill="#111827" textAnchor="middle" dominantBaseline="central">{f.texto}</text>}
                {isSel && <rect x={f.x - 2} y={f.y - 2} width={(f.w ?? 0) + 4} height={(f.h ?? 0) + 4} fill="none" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" />}
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
            <p className="text-[9px] font-mono uppercase tracking-wider text-white/40 px-1.5 pb-1">Criar conexão</p>
            <div className="grid grid-cols-2 gap-0.5">
              {CONECTORES.map(n => (
                <button key={n} type="button" onClick={() => criarPorta(n)}
                  className="text-left px-2 py-1 rounded text-[11px] text-white/70 hover:bg-white/10 hover:text-white">{n}</button>
              ))}
            </div>
            <button type="button" onClick={() => { const n = prompt('Nome da conexão:') ?? ''; if (n.trim()) criarPorta(n.trim()) }}
              className="w-full text-left px-2 py-1 mt-0.5 rounded text-[11px] text-teal/80 hover:bg-white/10">Outro…</button>
            <button type="button" onClick={() => criarPorta('')}
              className="w-full text-left px-2 py-1 rounded text-[11px] text-white/40 hover:bg-white/10">Sem nome</button>
          </div>
        </>
      )}
    </div>
  )
}
