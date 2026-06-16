'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption { id: string; label: string; count?: number; color?: string }

/** Dropdown de filtro multi-seleção (abre uma caixinha com checkboxes). */
export function FilterDropdown({ label, options, selected, onChange, icon }: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (next: string[]) => void
  icon?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (options.length === 0) return null
  const n = selected.length
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border transition-all',
          n > 0 ? 'border-teal/50 bg-teal/10 text-teal' : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25')}>
        {icon}
        <span>{label}</span>
        {n > 0 && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-teal/25 text-teal">{n}</span>}
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')}/>
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 left-0 card p-1.5 min-w-[210px] max-h-72 overflow-y-auto shadow-2xl">
          {n > 0 && (
            <button type="button" onClick={() => onChange([])}
              className="w-full text-left text-[11px] text-white/40 hover:text-white px-2 py-1 mb-0.5 border-b border-white/5">
              Limpar seleção
            </button>
          )}
          {options.map(o => {
            const on = selected.includes(o.id)
            return (
              <button key={o.id} type="button" onClick={() => toggle(o.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/6 text-left">
                <span className={cn('w-4 h-4 rounded flex items-center justify-center border flex-shrink-0',
                  on ? 'bg-teal border-teal' : 'border-white/20')}>
                  {on && <Check size={11} className="text-navy"/>}
                </span>
                {o.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }}/>}
                <span className="text-[12px] text-white/80 flex-1 truncate">{o.label}</span>
                {o.count !== undefined && <span className="text-[10px] font-mono text-white/30">{o.count}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
