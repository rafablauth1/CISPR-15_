'use client'

import { cn } from '@/lib/utils'

/** Controles de paginação reutilizáveis. Padrão 25 por página, opção 50. */
export function Paginacao({ total, porPagina, setPorPagina, pagina, setPagina, opcoes = [25, 50] }: {
  total: number
  porPagina: number
  setPorPagina: (n: number) => void
  pagina: number
  setPagina: (updater: (p: number) => number) => void
  opcoes?: number[]
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const pg = Math.min(pagina, totalPaginas)
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-white/5 flex-wrap">
      <div className="flex items-center gap-2 text-[11px] text-white/40">
        <span>Por página:</span>
        {opcoes.map(n => (
          <button key={n} type="button" onClick={() => setPorPagina(n)}
            className={cn('px-2 py-0.5 rounded-md font-mono transition-all',
              porPagina === n ? 'bg-teal/20 text-teal border border-teal/40' : 'text-white/40 hover:text-white border border-transparent')}>
            {n}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-white/40 font-mono">
          {(pg - 1) * porPagina + 1}–{Math.min(pg * porPagina, total)} de {total}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={pg <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}
            className="px-2 py-1 rounded-md border border-white/10 hover:border-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all">‹</button>
          <span className="font-mono text-white/50 px-1">{pg}/{totalPaginas}</span>
          <button type="button" disabled={pg >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
            className="px-2 py-1 rounded-md border border-white/10 hover:border-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all">›</button>
        </div>
      </div>
    </div>
  )
}
