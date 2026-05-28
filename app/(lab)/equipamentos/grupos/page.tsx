'use client'

import { useState, useEffect } from 'react'

interface Subgrupo { id: string; nome: string; numero: string }
interface Grupo { id: string; nome: string; descricao: string; cor: string; subgrupos: Subgrupo[] }

const COR: Record<string, string> = {
  blue: '#4F8EF7', gold: '#E8B94B', purple: '#A855F7',
  green: '#22C55E', coral: '#F87171', gray: '#94A3B8',
}

export default function GruposPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([])

  useEffect(() => {
    fetch('/api/grupos').then(r => r.json()).then(g => {
      if (Array.isArray(g)) setGrupos(g)
    }).catch(() => {})
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Laboratório · EMC</p>
          <h1 className="page-title">Taxonomia de grupos</h1>
          <p className="page-sub">Organização dos equipamentos por tipo e subgrupo</p>
        </div>
      </div>

      <div className="space-y-3">
        {grupos.map((g, gi) => {
          const cor = COR[g.cor] ?? '#94A3B8'
          return (
            <div key={g.id} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
                     style={{ background: `${cor}18`, border: `1px solid ${cor}28`, color: cor }}>
                  {gi + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="font-display font-bold text-[15px] text-white">{g.nome}</h2>
                    <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{g.id}</span>
                  </div>
                  <p className="text-[12px] text-white/40 mb-3">{g.descricao}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.subgrupos.map(s => (
                      <span key={s.id} className="badge font-mono"
                            style={{ background: `${cor}12`, color: cor, border: `1px solid ${cor}22`, fontSize: 9 }}>
                        {s.numero} — {s.nome}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
