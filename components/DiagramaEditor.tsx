'use client'

import { useRef, useState } from 'react'
import { MousePointer2, Square, Circle, Minus, Type as TypeIcon, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Forma, FormaTipo } from '@/lib/instrucoes/tipos'
import { COR_PADRAO } from '@/lib/instrucoes/diagrama'

type Tool = 'select' | FormaTipo
const CORES = ['#1f2937', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed']
const FERRAMENTAS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: 'select',    icon: MousePointer2, label: 'Selecionar / mover' },
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
  const draftRef = useRef<string | null>(null)
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const moveRef = useRef<{ id: string; ox: number; oy: number; isLine: boolean } | null>(null)

  const selecionada = formas.find(f => f.id === sel) || null

  function pt(e: React.PointerEvent) {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) }
  }

  function onSvgPointerDown(e: React.PointerEvent) {
    if (e.target === svgRef.current && tool === 'select') { setSel(null); return }
    if (tool === 'select') return
    const { x, y } = pt(e)
    const id = uid()
    const nova: Forma =
      tool === 'linha' ? { id, tipo: 'linha', x, y, x2: x, y2: y, cor } :
      tool === 'texto' ? { id, tipo: 'texto', x, y, texto: 'Texto', cor } :
                         { id, tipo: tool, x, y, w: 0, h: 0, cor }
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
      onChange(formas.map(f => f.id !== m.id ? f
        : m.isLine
          ? { ...f, x: f.x + dx, y: f.y + dy, x2: (f.x2 ?? f.x) + dx, y2: (f.y2 ?? f.y) + dy }
          : { ...f, x: f.x + dx, y: f.y + dy }))
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
  }

  function startMove(e: React.PointerEvent, f: Forma) {
    e.stopPropagation()
    setSel(f.id)
    if (tool !== 'select') return
    const { x, y } = pt(e)
    moveRef.current = { id: f.id, ox: x, oy: y, isLine: f.tipo === 'linha' }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function patchSel(patch: Partial<Forma>) {
    if (!sel) return
    onChange(formas.map(f => f.id === sel ? { ...f, ...patch } : f))
  }
  function aplicarCor(c: string) { setCor(c); if (sel) patchSel({ cor: c }) }
  function excluirSel() { if (!sel) return; onChange(formas.filter(f => f.id !== sel)); setSel(null) }

  return (
    <div className="space-y-2">
      {/* Barra de ferramentas */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
          {FERRAMENTAS.map(({ id, icon: Icon, label }) => (
            <button key={id} type="button" title={label} onClick={() => setTool(id)}
              className={cn('w-7 h-7 rounded-md flex items-center justify-center transition-colors',
                tool === id ? 'bg-brand/25 text-brand' : 'text-white/45 hover:text-white/80')}>
              <Icon size={14} />
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
        <button type="button" onClick={excluirSel} disabled={!sel}
          className="btn-ghost text-[11px] py-1 disabled:opacity-30"><Trash2 size={12} /> Excluir</button>
        <span className="text-[10px] text-white/30">
          {tool === 'select' ? 'Clique numa forma para mover. ' : 'Arraste no quadro para desenhar. '}
          {formas.length} forma{formas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Editar texto da forma selecionada (texto / rótulo de retângulo/elipse) */}
      {selecionada && (selecionada.tipo === 'texto' || selecionada.tipo === 'retangulo' || selecionada.tipo === 'elipse') && (
        <input className="input text-[11px] py-1" placeholder={selecionada.tipo === 'texto' ? 'Texto' : 'Rótulo (opcional)'}
          value={selecionada.texto ?? ''} onChange={e => patchSel({ texto: e.target.value })} />
      )}

      {/* Quadro de desenho */}
      <div className="overflow-auto rounded-lg border border-white/10" style={{ background: '#ffffff', maxWidth: '100%' }}>
        <svg ref={svgRef} width={w} height={h}
          onPointerDown={onSvgPointerDown} onPointerMove={onSvgPointerMove} onPointerUp={onSvgPointerUp}
          style={{ display: 'block', touchAction: 'none', cursor: tool === 'select' ? 'default' : 'crosshair' }}>
          {formas.map(f => {
            const isSel = f.id === sel
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
                <line x1={f.x} y1={f.y} x2={f.x2} y2={f.y2} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
                {isSel && <line x1={f.x} y1={f.y} x2={f.x2} y2={f.y2} stroke="#6366f1" strokeWidth={6} strokeOpacity={0.2} strokeLinecap="round" />}
              </g>
            )
            return (
              <g key={f.id} {...comum}>
                <text x={f.x} y={f.y} fontSize={14} fill={stroke} dominantBaseline="hanging">{f.texto || 'Texto'}</text>
                {isSel && <rect x={f.x - 2} y={f.y - 2} width={Math.max(40, (f.texto?.length ?? 5) * 8)} height={20} fill="none" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" />}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
