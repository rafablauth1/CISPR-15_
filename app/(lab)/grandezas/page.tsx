'use client'

import { useState, useEffect } from 'react'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'

export default function GrandezasPage() {
  const [equips, setEquips] = useState<EquipamentoEMC[]>([])

  useEffect(() => {
    fetch('/api/equipamentos').then(r => r.json()).then(e => {
      setEquips(Array.isArray(e) ? e : [])
    }).catch(() => {})
  }, [])

  const comGrandezas = equips.filter(e => e.grandezas.length > 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Laboratório · EMC</p>
          <h1 className="page-title">Grandezas metrológicas</h1>
          <p className="page-sub">Por equipamento cadastrado</p>
        </div>
      </div>

      {comGrandezas.length === 0 ? (
        <div className="card p-10 text-center text-white/25 text-sm">
          Nenhum equipamento possui grandezas cadastradas ainda.
          Acesse o detalhe de um equipamento para adicionar grandezas.
        </div>
      ) : (
        <div className="space-y-4">
          {comGrandezas.map(eq => (
            <div key={eq.id} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <span className="tag-chip mr-2">{eq.tag}</span>
                <span className="text-[13px] font-semibold text-white">{eq.nome}</span>
              </div>
              <table className="w-full">
                <thead className="tbl-head">
                  <tr>
                    <th>Grandeza</th>
                    <th>Símbolo</th>
                    <th>Unidade</th>
                    <th>Faixa</th>
                    <th>Resolução</th>
                    <th>Incerteza exp. (k=2)</th>
                  </tr>
                </thead>
                <tbody>
                  {eq.grandezas.map(g => (
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
          ))}
        </div>
      )}
    </div>
  )
}
