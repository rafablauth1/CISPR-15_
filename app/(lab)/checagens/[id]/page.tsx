'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, FileText } from 'lucide-react'
import { fmt } from '@/lib/utils'
import { gerarPDFChecagem } from '@/lib/relatorio/checagem-pdf'
import type { Checagem } from '@/lib/checagens/tipos'

function StatusBadge({ status }: { status: string }) {
  if (status === 'reprovado') return <span className="badge-danger">REPROVADA</span>
  if (status === 'atencao')   return <span className="badge-warning">ATENÇÃO</span>
  return <span className="badge-success">APROVADA</span>
}

function ResultadoBadge({ r }: { r: string }) {
  if (r === 'ok')  return <span className="badge-success text-[9px]">OK</span>
  if (r === 'nok') return <span className="badge-danger text-[9px]">NOK</span>
  return <span className="text-[9px] font-mono text-white/25">N/A</span>
}

export default function CheckagemDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [checagem, setChecagem] = useState<Checagem | null>(null)

  useEffect(() => {
    fetch(`/api/checagens/${id}`).then(r => r.json()).then(c => {
      if (!c.error) setChecagem(c)
    }).catch(() => {})
  }, [id])

  if (!checagem) return (
    <div className="flex items-center justify-center py-20 text-white/25 text-sm">Carregando...</div>
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
              <span className="tag-chip">{checagem.equipamentoTag}</span>
              <StatusBadge status={checagem.status} />
            </div>
            <h1 className="page-title">Checagem — {checagem.equipamentoTag}</h1>
          </div>
        </div>
        <button onClick={() => gerarPDFChecagem(checagem)} className="btn-secondary">
          <FileText size={13} /> Gerar PDF
        </button>
      </div>

      {/* Resumo */}
      <div className="card p-5 mb-5">
        <p className="form-section mb-4">Resumo</p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            ['Equipamento',   checagem.equipamentoTag],
            ['Data',          fmt(checagem.data)],
            ['Responsável',   checagem.responsavel],
            ['Fonte',         checagem.fonte.toUpperCase()],
            ['Próx. checagem', fmt(checagem.proximaChecagem)],
            ['Norma de ref.', checagem.normaReferencia ?? '—'],
          ].map(([label, valor]) => (
            <div key={label}>
              <p className="text-[9px] font-mono tracking-[2px] uppercase text-white/30 mb-0.5">{label}</p>
              <p className="text-white/75">{valor}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Itens */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5">
          <p className="form-section">Itens de verificação</p>
        </div>
        <table className="w-full">
          <thead className="tbl-head">
            <tr>
              <th>Descrição</th>
              <th>Valor medido</th>
              <th>Unidade</th>
              <th>Critério mín.</th>
              <th>Critério máx.</th>
              <th>Resultado</th>
              <th>Ref.</th>
            </tr>
          </thead>
          <tbody>
            {checagem.itens.map(item => (
              <tr key={item.id} className="tbl-row">
                <td className="font-medium text-white/80">{item.descricao}</td>
                <td className="font-mono text-[11px]">{item.valorMedido || '—'}</td>
                <td className="font-mono text-[10px] text-white/40">{item.unidade}</td>
                <td className="font-mono text-[11px] text-white/40">
                  {item.criterioMin !== undefined ? item.criterioMin : '—'}
                </td>
                <td className="font-mono text-[11px] text-white/40">
                  {item.criterioMax !== undefined ? item.criterioMax : '—'}
                </td>
                <td><ResultadoBadge r={item.resultado} /></td>
                <td className="text-[9px] text-white/30 font-mono">
                  {item.normaId ? `${item.normaId}${item.secao ? ` §${item.secao}` : ''}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
