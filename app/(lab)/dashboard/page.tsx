'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Cpu, BookOpen, ClipboardCheck, AlertTriangle, ChevronRight, ArrowRight,
  Calendar, FileText, Settings, ShieldCheck,
} from 'lucide-react'
import { fmt, diasAte } from '@/lib/utils'
import { RELATORIOS_KEY, AGENDA_KEY } from '@/app/cispr15/types'
import { DonutChart, BarChart, HBarChart, ChartCard } from '@/components/Charts'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import type { Checagem } from '@/lib/checagens/tipos'
import type { Norma } from '@/lib/normas/tipos'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/* Extrai ano de uma data em dd/mm/yyyy ou yyyy-mm-dd */
function getAno(s?: string): number | null {
  if (!s) return null
  const m = s.match(/(\d{4})/)
  return m ? parseInt(m[1]) : null
}
/* Extrai mês (1-12) */
function getMes(s?: string): number | null {
  if (!s) return null
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return parseInt(m[2])
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return parseInt(m[2])
  return null
}

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

function AreaCard({ href, icon, title, desc, color }: {
  href: string; icon: React.ReactNode; title: string; desc: string; color: string
}) {
  return (
    <Link href={href} className="card p-4 group flex items-start gap-3 hover:border-white/15 transition-colors">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display font-semibold text-[13px] text-white">{title}</h3>
          <ArrowRight size={13} className="text-white/20 group-hover:text-white/60 transition-colors" />
        </div>
        <p className="text-[10.5px] text-white/40 mt-0.5 leading-snug">{desc}</p>
      </div>
    </Link>
  )
}

async function loadList(method: 'getAgenda' | 'getRelatorios', prop: 'agenda' | 'relatorios', key: string): Promise<any[]> {
  const api = (window as any).electronAPI
  if (api?.[method]) {
    try {
      const res = await api[method]()
      if (res?.ok && Array.isArray(res[prop])) return res[prop]
    } catch {}
  }
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw) } catch {}
  return []
}

export default function DashboardPage() {
  const [equips,    setEquips]    = useState<EquipamentoEMC[]>([])
  const [checagens, setChecagens] = useState<Checagem[]>([])
  const [normas,    setNormas]    = useState<Norma[]>([])
  const [relatorios, setRelatorios] = useState<any[]>([])
  const [agenda,     setAgenda]     = useState<any[]>([])
  const [ano,        setAno]        = useState<number>(new Date().getFullYear())

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

    loadList('getRelatorios', 'relatorios', RELATORIOS_KEY).then(setRelatorios)
    loadList('getAgenda',     'agenda',     AGENDA_KEY).then(setAgenda)
  }, [])

  // Anos disponíveis (dos relatórios) + ano atual, ordenados desc
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()])
    for (const r of relatorios) { const a = getAno(r.dataEmissao); if (a) set.add(a) }
    return [...set].sort((a, b) => b - a)
  }, [relatorios])

  const relatoriosAno = useMemo(
    () => relatorios.filter(r => getAno(r.dataEmissao) === ano),
    [relatorios, ano],
  )

  // Relatórios por mês do ano selecionado
  const porMes = useMemo(() => {
    const counts = Array(12).fill(0)
    for (const r of relatoriosAno) { const m = getMes(r.dataEmissao); if (m) counts[m - 1]++ }
    return MESES.map((label, i) => ({ label, value: counts[i] }))
  }, [relatoriosAno])

  // Conformidade dos relatórios do ano
  const conf = useMemo(() => {
    let conforme = 0, reprovado = 0, pendente = 0
    for (const r of relatoriosAno) {
      const c = r.currentCfg?.conformidade ?? r.cfg?.conformidade ?? 'pendente'
      if (c === 'conforme') conforme++
      else if (c === 'reprovado') reprovado++
      else pendente++
    }
    return { conforme, reprovado, pendente }
  }, [relatoriosAno])

  const vencidas  = checagens.filter(c => c.status === 'reprovado').length
  const pendentes = checagens.filter(c => c.status === 'atencao').length
  const emDia     = checagens.length - vencidas - pendentes
  const agendaPendentes = agenda.filter((a: any) => !a?.numRelatorio).length

  // Equipamentos por grupo
  const porGrupo = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of equips) { const g = (e as any).grupoId || 'outros'; map[g] = (map[g] ?? 0) + 1 }
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [equips])

  const proximas = [...checagens]
    .sort((a, b) => {
      const da = diasAte(a.proximaChecagem)
      const db = diasAte(b.proximaChecagem)
      return (typeof da === 'number' ? da : 9999) - (typeof db === 'number' ? db : 9999)
    })
    .slice(0, 5)

  return (
    <div>
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">LABELO · EMC</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Visão geral da gestão de EMC</p>
        </div>
        {/* Seletor de ano */}
        <div className="flex items-center gap-1.5 bg-navy border border-white/8 rounded-xl p-1 flex-wrap">
          {anosDisponiveis.map(a => (
            <button key={a} type="button" onClick={() => setAno(a)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-mono transition-all ${
                ano === a ? 'bg-[#141B28] text-white border border-white/10' : 'text-white/35 hover:text-white/60'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards — um pouco de cada área */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<FileText size={18} />}       label={`Relatórios ${ano}`}  value={relatoriosAno.length} color="#9B8CFF" />
        <StatCard icon={<Calendar size={18} />}       label="Agenda pendente"      value={agendaPendentes}      color="#4F8EF7" />
        <StatCard icon={<ClipboardCheck size={18} />} label="Checagens vencendo"   value={pendentes}            color="#F59E0B" />
        <StatCard icon={<AlertTriangle size={18} />}  label="Checagens vencidas"   value={vencidas}             color="#F87171" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title={`Relatórios por mês · ${ano}`}>
          <BarChart data={porMes} color="#9B8CFF" />
        </ChartCard>

        <ChartCard title={`Conformidade · ${ano}`}>
          <DonutChart
            centerTop={relatoriosAno.length}
            centerSub="relatórios"
            segments={[
              { label: 'Conforme',  value: conf.conforme,  color: '#34D399' },
              { label: 'Reprovado', value: conf.reprovado, color: '#F87171' },
              { label: 'Pendente',  value: conf.pendente,  color: '#94A3B8' },
            ]}
          />
        </ChartCard>

        <ChartCard title="Checagens por status">
          <DonutChart
            centerTop={checagens.length}
            centerSub="checagens"
            segments={[
              { label: 'Em dia',   value: emDia,     color: '#34D399' },
              { label: 'Vencendo', value: pendentes, color: '#F59E0B' },
              { label: 'Vencidas', value: vencidas,  color: '#F87171' },
            ]}
          />
        </ChartCard>

        <ChartCard title="Equipamentos por grupo">
          <HBarChart data={porGrupo} color="#4F8EF7" />
        </ChartCard>
      </div>

      {/* Áreas — acesso rápido */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <AreaCard href="/agenda"        icon={<Calendar size={18} />}    title="Agenda"        desc="Ensaios agendados e protocolos"             color="#4F8EF7" />
        <AreaCard href="/cispr15"       icon={<FileText size={18} />}    title="Formulários"   desc="Emissão de relatórios CISPR 15"             color="#9B8CFF" />
        <AreaCard href="/checagens"     icon={<ShieldCheck size={18} />} title="Qualidade"     desc="Checagens, equipamentos e normas"           color="#34D399" />
        <AreaCard href="/configuracoes" icon={<Settings size={18} />}    title="Configurações" desc="Pastas, senhas e parâmetros"                color="#94A3B8" />
      </div>

      {/* Resumo Qualidade */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard icon={<Cpu size={18} />}      label="Equipamentos"  value={equips.length} color="#4F8EF7" />
        <StatCard icon={<BookOpen size={18} />} label="Normas ativas" value={normas.length} color="#E8B94B" />
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
                  <td><span className="tag-chip mr-2">{c.equipamentoTag}</span></td>
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
