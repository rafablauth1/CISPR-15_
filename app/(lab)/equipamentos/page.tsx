'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight, Zap, Gauge, Waves, Radio, SlidersHorizontal, Thermometer } from 'lucide-react'
import { fmt } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { EquipamentoEMC, GrupoId } from '@/lib/equipamentos/tipos'
import { GRUPO_CORES } from '@/lib/grupos-icons'

interface Grupo {
  id: GrupoId
  nome: string
  cor: string
  subgrupos: { id: string; nome: string; numero: string }[]
}

const ICONES: Record<string, React.ElementType> = {
  'geradores':            Zap,
  'medidores':            Gauge,
  'redes-impedancia':     Waves,
  'antenas':              Radio,
  'atenuacao':            SlidersHorizontal,
  'grandezas-ambientais': Thermometer,
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
            <Plus size={13}/> Novo Equipamento
          </Link>
          <Link href="/checagens/nova" className="btn-secondary">
            <Plus size={13}/> Nova Checagem
          </Link>
        </div>
      </div>

      {/* Grupos */}
      {grupos.length > 0 && (
        <>
          <h2 className="font-display font-semibold text-[13px] text-white/60 uppercase tracking-widest mb-3">Grupos</h2>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {grupos.map(g => {
              const cor   = GRUPO_CORES[g.cor] ?? '#94A3B8'
              const Icon  = ICONES[g.id] ?? Gauge
              const total = equipsByGrupo(g.id).length
              return (
                <div key={g.id} className="card p-4 hover:border-white/15 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: `${cor}18`, border: `1px solid ${cor}28` }}>
                      <Icon size={18} style={{ color: cor }}/>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[13px] text-white truncate">{g.nome}</p>
                      <p className="text-[10px] text-white/35 font-mono">{total} equipamento{total !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.subgrupos.map(s => (
                      <span key={s.id} className="badge font-mono"
                        style={{ background: `${cor}12`, color: cor, border: `1px solid ${cor}22`, fontSize: 9 }}>
                        {s.numero} {s.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <hr className="border-white/6 mb-8"/>
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
                <th>Grupo</th>
                <th>Subgrupo</th>
                <th>Próx. Calibração</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equips.map(e => {
                const Icon = ICONES[e.grupoId] ?? Gauge
                const g    = grupos.find(g => g.id === e.grupoId)
                const cor  = GRUPO_CORES[g?.cor ?? 'gray']
                return (
                  <tr key={e.id} className="tbl-row">
                    <td><span className="tag-chip">{e.tag}</span></td>
                    <td className="font-medium text-white/80">{e.nome}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={12} style={{ color: cor }}/>
                        <span className="text-[11px] text-white/50">{g?.nome ?? e.grupoId}</span>
                      </span>
                    </td>
                    <td><span className="text-[10px] text-white/40 font-mono">{e.subgrupoId}</span></td>
                    <td className="font-mono text-[11px]">{fmt(e.proximaCalibracao)}</td>
                    <td><StatusPill status={e.status}/></td>
                    <td>
                      <Link href={`/equipamentos/${e.id}`} className="text-white/25 hover:text-white transition-colors">
                        <ChevronRight size={14}/>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
