'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { fmt } from '@/lib/utils'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import type { Checagem } from '@/lib/checagens/tipos'

function StatusPill({ status }: { status: string }) {
  if (status === 'ativo')    return <span className="badge-success">Ativo</span>
  if (status === 'calibrar') return <span className="badge-warning">Calibrar</span>
  return <span className="badge-danger">Fora</span>
}

function StatusChecBadge({ status }: { status: string }) {
  if (status === 'reprovado') return <span className="badge-danger">Reprovada</span>
  if (status === 'atencao')   return <span className="badge-warning">Atenção</span>
  return <span className="badge-success">Aprovada</span>
}

export default function EquipamentoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [equip,     setEquip]     = useState<EquipamentoEMC | null>(null)
  const [checagens, setChecagens] = useState<Checagem[]>([])

  useEffect(() => {
    fetch(`/api/equipamentos/${id}`).then(r => r.json()).then(e => {
      if (!e.error) setEquip(e)
    }).catch(() => {})
    fetch('/api/checagens').then(r => r.json()).then((cs: Checagem[]) => {
      setChecagens(cs.filter(c => c.equipamentoId === id))
    }).catch(() => {})
  }, [id])

  if (!equip) return (
    <div className="flex items-center justify-center py-20 text-white/25 text-sm">
      Carregando...
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2">
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="tag-chip">{equip.tag}</span>
              <StatusPill status={equip.status} />
            </div>
            <h1 className="page-title">{equip.nome}</h1>
          </div>
        </div>
      </div>

      {/* Dados gerais */}
      <div className="card p-5 mb-5">
        <p className="form-section mb-4">Dados gerais</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ['Fabricante',         equip.fabricante   ?? '—'],
            ['Modelo',             equip.modelo       ?? '—'],
            ['Nº de série',        equip.serie        ?? '—'],
            ['Lab. de calibração', equip.labCalibracao ?? '—'],
            ['Nº certificado',     equip.numeroCertificado ?? '—'],
            ['Última calibração',  fmt(equip.ultimaCalibracao)],
            ['Próx. calibração',   fmt(equip.proximaCalibracao)],
            ['Intervalo',          `${equip.intervaloCalibracao} meses`],
          ].map(([label, valor]) => (
            <div key={label}>
              <p className="text-[9px] font-mono tracking-[2px] uppercase text-white/30 mb-0.5">{label}</p>
              <p className="text-white/75">{valor}</p>
            </div>
          ))}
        </div>
        {equip.obs && (
          <div className="mt-4 pt-4 border-t border-white/6">
            <p className="text-[9px] font-mono tracking-[2px] uppercase text-white/30 mb-1">Observações</p>
            <p className="text-white/60 text-sm">{equip.obs}</p>
          </div>
        )}
      </div>

      {/* Grandezas */}
      {equip.grandezas.length > 0 && (
        <div className="card p-5 mb-5">
          <p className="form-section mb-4">Grandezas metrológicas</p>
          <table className="w-full">
            <thead className="tbl-head">
              <tr>
                <th>Nome</th>
                <th>Símbolo</th>
                <th>Unidade</th>
                <th>Faixa</th>
                <th>Resolução</th>
                <th>Incerteza exp.</th>
              </tr>
            </thead>
            <tbody>
              {equip.grandezas.map(g => (
                <tr key={g.id} className="tbl-row">
                  <td className="font-medium text-white/80">{g.nome}</td>
                  <td className="font-mono text-[11px]">{g.simbolo}</td>
                  <td className="font-mono text-[11px]">{g.unidade}</td>
                  <td className="font-mono text-[11px]">{g.faixaMin} — {g.faixaMax}</td>
                  <td className="font-mono text-[11px]">{g.resolucao}</td>
                  <td className="font-mono text-[11px]">{g.incertezaExpandida}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Histórico de checagens */}
      <div className="card p-5">
        <p className="form-section mb-4">Histórico de checagens</p>
        {checagens.length === 0 ? (
          <p className="text-white/25 text-sm py-4 text-center">Nenhuma checagem registrada.</p>
        ) : (
          <table className="w-full">
            <thead className="tbl-head">
              <tr>
                <th>Data</th>
                <th>Responsável</th>
                <th>Fonte</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {checagens.map(c => (
                <tr key={c.id} className="tbl-row">
                  <td className="font-mono text-[11px]">{fmt(c.data)}</td>
                  <td className="text-white/70">{c.responsavel}</td>
                  <td className="font-mono text-[10px] uppercase text-white/40">{c.fonte}</td>
                  <td><StatusChecBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
