'use client'

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import type { Certificado } from '@/lib/certificados/tipos'

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Datas/campos administrativos não são grandeza (limpa lixo de OCR).
function ehGrandezaValida(nome: string): boolean {
  const x = norm(nome)
  if (x.length < 3) return false
  return !/^(data|emiss|emiti|validade|vencimento|respons|assinatura|protocolo|numero|n[º°]|local|cliente|endere|cnpj|equipamento|fabricante|modelo|tag|serie|recebi|realizada?|aprovad|pagina|certificad|periodo)/.test(x)
}

export default function GrandezasPage() {
  const [equips, setEquips] = useState<EquipamentoEMC[]>([])
  const [certs,  setCerts]  = useState<Certificado[]>([])
  const [busca,  setBusca]  = useState('')

  useEffect(() => {
    fetch('/api/equipamentos').then(r => r.json()).then(e => setEquips(Array.isArray(e) ? e : [])).catch(() => {})
    fetch('/api/certificados').then(r => r.json()).then(c => setCerts(Array.isArray(c) ? c : [])).catch(() => {})
  }, [])

  async function limparTodas() {
    if (!confirm('Limpar as grandezas de TODOS os equipamentos? Elas voltam quando você reimportar os certificados.')) return
    const r = await fetch('/api/equipamentos/limpar-grandezas', { method: 'POST' })
    if (r.ok) fetch('/api/equipamentos').then(x => x.json()).then(e => setEquips(Array.isArray(e) ? e : [])).catch(() => {})
    else alert('Falha ao limpar.')
  }

  // Catálogo ÚNICO de grandezas (não por equipamento/TAG): junta todas, deduplica
  // por nome e agrega a unidade + os parâmetros associados (vindos dos certificados).
  const catalogo = (() => {
    const map = new Map<string, { nome: string; unidade: string; params: Set<string> }>()
    for (const e of equips) for (const g of (e.grandezas ?? [])) {
      if (!ehGrandezaValida(g.nome)) continue
      const k = norm(g.nome)
      if (!map.has(k)) map.set(k, { nome: g.nome, unidade: g.unidade || '', params: new Set() })
      const a = map.get(k)!; if (!a.unidade && g.unidade) a.unidade = g.unidade
    }
    // parâmetros vêm dos pontos dos certificados (por grandeza)
    for (const c of certs) for (const p of ((c.grade2D?.pontos ?? []) as Array<{ grandeza?: string; tabela?: string; eixo2Unidade?: string }>)) {
      const gn = (p.grandeza || '').trim()
      if (!gn || !ehGrandezaValida(gn)) continue
      const k = norm(gn)
      if (!map.has(k)) map.set(k, { nome: gn, unidade: p.eixo2Unidade || '', params: new Set() })
      const a = map.get(k)!
      if (!a.unidade && p.eixo2Unidade) a.unidade = p.eixo2Unidade
      if ((p.tabela || '').trim()) a.params.add(p.tabela!.trim())
    }
    return [...map.values()]
      .map(g => ({ ...g, params: [...g.params] }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  })()

  const q = norm(busca)
  const filtrado = catalogo.filter(g => !q || norm(g.nome).includes(q) || g.params.some(p => norm(p).includes(q)))

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Laboratório · EMC</p>
          <h1 className="page-title">Grandezas metrológicas</h1>
          <p className="page-sub">Catálogo único · com os parâmetros associados (independente de equipamento)</p>
        </div>
        <div className="flex items-center gap-3 self-center">
          <span className="text-[11px] text-white/30 font-mono">{filtrado.length} grandeza(s)</span>
          {catalogo.length > 0 && (
            <button type="button" onClick={limparTodas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-red-300/80 border border-red-500/30 hover:bg-red-500/15 transition-all">
              <Trash2 size={13}/> Limpar todas
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input className="input max-w-sm text-[12px] py-1.5" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar grandeza ou parâmetro…"/>
      </div>

      {filtrado.length === 0 ? (
        <div className="card p-10 text-center text-white/25 text-sm">
          Nenhuma grandeza cadastrada ainda. Elas são preenchidas pelos certificados de calibração.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="tbl-head">
              <tr>
                <th className="w-72">Grandeza</th>
                <th className="w-24">Unidade</th>
                <th>Parâmetros associados</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map(g => (
                <tr key={g.nome} className="tbl-row align-top">
                  <td className="font-medium text-white/80">{g.nome}</td>
                  <td className="font-mono text-[11px]">{g.unidade || '—'}</td>
                  <td>
                    {g.params.length ? (
                      <div className="flex flex-wrap gap-1.5 py-1">
                        {g.params.map(p => (
                          <span key={p} className="text-[10px] font-mono px-2 py-0.5 rounded border border-teal/20 bg-teal/5 text-teal/80">{p}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-white/25">— nenhum parâmetro nos certificados</span>
                    )}
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
