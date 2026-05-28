'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, FileText } from 'lucide-react'
import type { Norma } from '@/lib/normas/tipos'

function TipoBadge({ tipo }: { tipo: string }) {
  if (tipo === 'emissao')   return <span className="badge-gold">Emissão</span>
  if (tipo === 'imunidade') return <span className="badge-accent">Imunidade</span>
  return <span className="badge">Geral</span>
}

export default function NormaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [norma, setNorma] = useState<Norma | null>(null)

  useEffect(() => {
    fetch(`/api/normas/${id}`).then(r => r.json()).then(n => {
      if (!n.error) setNorma(n)
    }).catch(() => {})
  }, [id])

  if (!norma) return (
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
              <span className="font-display font-bold text-[17px]" style={{ color: 'var(--accent,#E8B94B)' }}>
                {norma.codigo}
              </span>
              <TipoBadge tipo={norma.tipo} />
            </div>
            <h1 className="page-title">{norma.titulo}</h1>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="card p-5 mb-5 flex items-center gap-6">
        <div>
          <p className="text-[9px] font-mono tracking-[2px] uppercase text-white/30 mb-0.5">PDF disponível</p>
          <p className="text-sm text-white/70">{norma.pdfDisponivel ? 'Sim' : 'Não disponível'}</p>
        </div>
        {norma.pdfDisponivel && norma.pdfPath && (
          <a href={norma.pdfPath} target="_blank" rel="noreferrer" className="btn-secondary ml-auto">
            <FileText size={13} /> Abrir PDF
          </a>
        )}
      </div>

      {/* Tabelas de limites */}
      {norma.tabelasLimites && norma.tabelasLimites.length > 0 && (
        <div className="mb-5 space-y-4">
          <h2 className="font-display font-semibold text-[13px] text-white/60 uppercase tracking-widest">
            Tabelas de limites
          </h2>
          {norma.tabelasLimites.map(t => (
            <div key={t.id} className="card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5">
                <p className="font-semibold text-[13px] text-white">{t.titulo}</p>
              </div>
              <table className="w-full">
                <thead className="tbl-head">
                  <tr>
                    {t.linhas[0]?.nivel      !== undefined && <th>Nível</th>}
                    {t.linhas[0]?.frequencia !== undefined && <th>Frequência</th>}
                    <th>Valor</th>
                    {t.linhas[0]?.condicoes  !== undefined && <th>Condições</th>}
                  </tr>
                </thead>
                <tbody>
                  {t.linhas.map((linha, li) => (
                    <tr key={li} className="tbl-row">
                      {linha.nivel      !== undefined && <td>{linha.nivel}</td>}
                      {linha.frequencia !== undefined && <td className="font-mono text-[11px]">{linha.frequencia}</td>}
                      <td className="font-mono text-[11px]">{linha.valor}</td>
                      {linha.condicoes  !== undefined && <td className="text-white/50">{linha.condicoes}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Seções */}
      {norma.secoes && norma.secoes.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-[13px] text-white/60 uppercase tracking-widest mb-3">
            Seções relevantes
          </h2>
          <div className="space-y-2">
            {norma.secoes.map(s => (
              <div key={s.numero} className="card p-4 flex gap-4">
                <span className="font-mono font-bold text-[13px] flex-shrink-0" style={{ color: 'var(--accent,#E8B94B)' }}>
                  {s.numero}
                </span>
                <div>
                  <p className="font-semibold text-[13px] text-white mb-0.5">{s.titulo}</p>
                  <p className="text-[12px] text-white/50">{s.resumo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!norma.tabelasLimites || norma.tabelasLimites.length === 0) &&
       (!norma.secoes || norma.secoes.length === 0) && (
        <div className="card p-8 text-center text-white/25 text-sm">
          Detalhes completos desta norma ainda não foram cadastrados.
        </div>
      )}
    </div>
  )
}
