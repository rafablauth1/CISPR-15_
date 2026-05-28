'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cpu, BookOpen, ClipboardCheck, AlertTriangle, ChevronRight } from 'lucide-react'
import { fmt, diasAte } from '@/lib/utils'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import type { Checagem } from '@/lib/checagens/tipos'
import type { Norma } from '@/lib/normas/tipos'

function StatusBadge({ status }: { status: string }) {
  if (status === 'reprovado') return <span className="badge-danger">VENCIDA</span>
  if (status === 'atencao')   return <span className="badge-warning">VENCENDO</span>
  return <span className="badge-success">EM DIA</span>
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="stat-card">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[8.5px] tracking-[2px] uppercase text-white/35">{label}</p>
        <p className="font-display font-bold text-2xl text-white leading-tight">{value}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [equips,    setEquips]    = useState<EquipamentoEMC[]>([])
  const [checagens, setChecagens] = useState<Checagem[]>([])
  const [normas,    setNormas]    = useState<Norma[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/equipamentos').then(r => r.json()),
      fetch('/api/checagens').then(r => r.json()),
      fetch('/api/normas').then(r => r.json()),
    ]).then(([e, c, n]) => {
      setEquips(Array.isArray(e) ? e : [])
      setChecagens(Array.isArray(c) ? c : [])
      setNormas(Array.isArray(n) ? n : [])
    }).catch(() => {})
  }, [])

  const vencidas  = checagens.filter(c => c.status === 'reprovado').length
  const pendentes = checagens.filter(c => c.status === 'atencao').length

  const proximas = [...checagens]
    .sort((a, b) => {
      const da = diasAte(a.proximaChecagem)
      const db = diasAte(b.proximaChecagem)
      return (typeof da === 'number' ? da : 9999) - (typeof db === 'number' ? db : 9999)
    })
    .slice(0, 5)

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">LABELO · EMC</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Visão geral do laboratório</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Cpu size={18} />}           label="Equipamentos"         value={equips.length}      color="#4F8EF7" />
        <StatCard icon={<BookOpen size={18} />}       label="Normas ativas"        value={normas.length}      color="#E8B94B" />
        <StatCard icon={<ClipboardCheck size={18} />} label="Checagens pendentes"  value={pendentes}          color="#F59E0B" />
        <StatCard icon={<AlertTriangle size={18} />}  label="Vencidas"             value={vencidas}           color="#F87171" />
      </div>

      {/* Próximas checagens */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-[15px] text-white">Próximas checagens</h2>
          <Link href="/checagens" className="text-[11px] text-white/35 hover:text-white flex items-center gap-1 transition-colors">
            Ver todas <ChevronRight size={11} />
          </Link>
        </div>

        {proximas.length === 0 ? (
          <p className="text-white/25 text-sm py-6 text-center">Nenhuma checagem registrada.</p>
        ) : (
          <table className="w-full">
            <thead className="tbl-head">
              <tr>
                <th>Equipamento</th>
                <th>Data</th>
                <th>Próxima</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {proximas.map(c => (
                <tr key={c.id} className="tbl-row">
                  <td>
                    <span className="tag-chip mr-2">{c.equipamentoTag}</span>
                  </td>
                  <td>{fmt(c.data)}</td>
                  <td>{fmt(c.proximaChecagem)}</td>
                  <td><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
