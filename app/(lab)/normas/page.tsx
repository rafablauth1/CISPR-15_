'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Norma } from '@/lib/normas/tipos'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'

function TipoBadge({ tipo }: { tipo: string }) {
  if (tipo === 'emissao')   return <span className="badge-gold">Emissão</span>
  if (tipo === 'imunidade') return <span className="badge-accent">Imunidade</span>
  return <span className="badge">Geral</span>
}

export default function NormasPage() {
  const [normas,  setNormas]  = useState<Norma[]>([])
  const [equips,  setEquips]  = useState<EquipamentoEMC[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/normas').then(r => r.json()),
      fetch('/api/equipamentos').then(r => r.json()),
    ]).then(([n, e]) => {
      setNormas(Array.isArray(n) ? n : [])
      setEquips(Array.isArray(e) ? e : [])
    }).catch(() => {})
  }, [])

  function grupoOk(grupoId: string) {
    return equips.some(e => e.grupoId === grupoId && e.status === 'ativo')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Laboratório · EMC</p>
          <h1 className="page-title">Normas</h1>
          <p className="page-sub">Referências normativas do laboratório</p>
        </div>
      </div>

      <div className="space-y-3">
        {normas.map(n => (
          <Link key={n.id} href={`/normas/${n.id}`}
            className="card p-5 flex gap-5 hover:border-white/15 transition-colors group block">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-display font-bold text-[15px]" style={{ color: 'var(--accent,#E8B94B)' }}>
                  {n.codigo}
                </span>
                <TipoBadge tipo={n.tipo} />
              </div>
              <p className="text-[12px] text-white/60 leading-relaxed mb-3">{n.titulo}</p>
              <div className="flex flex-wrap gap-2">
                {n.equipamentosNecessarios.map(eq => {
                  const ok = grupoOk(eq.grupoId)
                  return (
                    <span key={eq.grupoId}
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border"
                      style={{
                        color: ok ? '#22C55E' : '#F59E0B',
                        background: ok ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)',
                        borderColor: ok ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)',
                      }}>
                      {ok
                        ? <CheckCircle2 size={9} className="flex-shrink-0" />
                        : <AlertTriangle size={9} className="flex-shrink-0" />
                      }
                      {eq.descricao}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="self-center text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
