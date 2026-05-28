'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight } from 'lucide-react'
import { fmt } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { EquipamentoEMC, GrupoId } from '@/lib/equipamentos/tipos'

interface Grupo {
  id: GrupoId
  nome: string
  cor: string
  subgrupos: { id: string; nome: string; numero: string }[]
}

const COR_ICON: Record<string, string> = {
  blue:   '#4F8EF7',
  gold:   '#E8B94B',
  purple: '#A855F7',
  green:  '#22C55E',
  coral:  '#F87171',
  gray:   '#94A3B8',
}

function StatusPill({ status }: { status: string }) {
  if (status === 'ativo')    return <span className="badge-success">Ativo</span>
  if (status === 'calibrar') return <span className="badge-warning">Calibrar</span>
  return <span className="badge-danger">Fora</span>
}

export default function EquipamentosPage() {
  const [equips, setEquips] = useState<EquipamentoEMC[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/equipamentos').then(r => r.json()),
      fetch('/api/grupos').then(r => r.json()),
    ]).then(([e, g]) => {
      setEquips(Array.isArray(e) ? e : [])
      setGrupos(Array.isArray(g) ? g : [])
    }).catch(() => {})
  }, [])

  const equipsByGrupo = (grupoId: string) => equips.filter(e => e.grupoId === grupoId)

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Laboratório · EMC</p>
          <h1 className="page-title">Equipamentos</h1>
          <p className="page-sub">Por grupo e subgrupo</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/equipamentos/novo" className="btn-primary">
            <Plus size={13} /> Novo Equipamento
          </Link>
          <Link href="/checagens/nova" className="btn-secondary">
            <Plus size={13} /> Nova Checagem
          </Link>
        </div>
      </div>

      {/* Grupos */}
      {grupos.length > 0 && (
        <>
          <h2 className="font-display font-semibold text-[13px] text-white/60 uppercase tracking-widest mb-3">Grupos</h2>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {grupos.map(g => {
              const cor = COR_ICON[g.cor] ?? '#94A3B8'
              const total = equipsByGrupo(g.id).length
              return (
                <div key={g.id} className="card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: `${cor}18`, border: `1px solid ${cor}28` }}>
                      <div className="w-3 h-3 rounded-sm" style={{ background: cor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[13px] text-white truncate">{g.nome}</p>
                      <p className="text-[10px] text-white/35 font-mono">{total} equipamento{total !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.subgrupos.map(s => (
                      <span key={s.id} className="badge" style={{ background: `${cor}12`, color: cor, border: `1px solid ${cor}22`, fontSize: 9 }}>
                        {s.numero} {s.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <hr className="border-white/6 mb-8" />
        </>
      )}

      {/* Lista */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-[13px] text-white/60 uppercase tracking-widest">
          Todos os equipamentos
        </h2>
        <span className="text-[11px] text-white/30 font-mono">{equips.length} total</span>
      </div>

      {equips.length === 0 ? (
        <div className="card p-10 text-center text-white/25 text-sm">Nenhum equipamento cadastrado.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="tbl-head">
              <tr>
                <th>Tag</th>
                <th>Nome</th>
                <th>Subgrupo</th>
                <th>Próx. Calibração</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equips.map(e => (
                <tr key={e.id} className="tbl-row">
                  <td><span className="tag-chip">{e.tag}</span></td>
                  <td className="font-medium text-white/80">{e.nome}</td>
                  <td>
                    <span className="text-[10px] text-white/40 font-mono">{e.subgrupoId}</span>
                  </td>
                  <td className="font-mono text-[11px]">{fmt(e.proximaCalibracao)}</td>
                  <td><StatusPill status={e.status} /></td>
                  <td>
                    <Link href={`/equipamentos/${e.id}`}
                      className="text-white/25 hover:text-white transition-colors">
                      <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
