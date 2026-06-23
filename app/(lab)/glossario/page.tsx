'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Check, Loader2, Search, BookText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { chaveSigla, type ItemGlossario } from '@/lib/glossario'

// Página central do glossário de siglas/definições usado nas Instruções de
// Trabalho (bloco "Definições / Siglas"). Lê e grava em /api/glossario.
export default function GlossarioPage() {
  const [itens, setItens] = useState<ItemGlossario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    fetch('/api/glossario')
      .then(r => r.json())
      .then((g: ItemGlossario[]) => setItens(Array.isArray(g) ? g : []))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const marcarAlterado = () => setSalvo(false)
  const add = () => { setItens(p => [{ sigla: '', definicao: '' }, ...p]); marcarAlterado() }
  const set = (idx: number, campo: keyof ItemGlossario, val: string) => {
    setItens(p => p.map((it, i) => i === idx ? { ...it, [campo]: campo === 'sigla' ? val.toUpperCase() : val } : it))
    marcarAlterado()
  }
  const del = (idx: number) => { setItens(p => p.filter((_, i) => i !== idx)); marcarAlterado() }

  async function salvar() {
    setSalvando(true)
    try {
      // Normaliza (sigla em maiúsculas, trim) e descarta linhas incompletas.
      const limpos = itens
        .map(it => ({ sigla: chaveSigla(it.sigla), definicao: it.definicao.trim() }))
        .filter(it => it.sigla && it.definicao)
      const r = await fetch('/api/glossario', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limpos),
      })
      if (r.ok) { setItens(limpos); setSalvo(true); setTimeout(() => setSalvo(false), 2500) }
      else alert('Falha ao salvar.')
    } finally { setSalvando(false) }
  }

  // Siglas duplicadas (marca em vermelho) — útil pra evitar conflito no auto-preenchimento.
  const cont = new Map<string, number>()
  for (const it of itens) { const s = chaveSigla(it.sigla); if (s) cont.set(s, (cont.get(s) ?? 0) + 1) }

  const q = busca.trim().toLowerCase()
  const visiveis = itens
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => !q || it.sigla.toLowerCase().includes(q) || it.definicao.toLowerCase().includes(q))

  if (carregando) return (
    <div className="card p-10 text-center text-white/30 text-sm">
      <Loader2 className="animate-spin inline mr-2" size={16} /> Carregando…
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Laboratório · EMC</p>
          <h1 className="page-title">Glossário de Siglas</h1>
          <p className="page-sub">Siglas e definições compartilhadas — usadas no bloco “Definições / Siglas” das Instruções de Trabalho</p>
        </div>
        <button type="button" onClick={salvar} disabled={salvando} className="btn-primary">
          {salvando ? <Loader2 size={13} className="animate-spin" /> : salvo ? <Check size={13} /> : <Save size={13} />}
          {salvando ? 'Salvando…' : salvo ? 'Salvo' : 'Salvar tudo'}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input className="input pl-9 text-[12px] py-1.5" placeholder="Buscar sigla ou definição…"
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <span className="text-[11px] font-mono text-white/30">{itens.length} sigla{itens.length !== 1 ? 's' : ''}</span>
        <button type="button" onClick={add} className="btn-ghost text-xs py-1"><Plus size={12} /> Sigla</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="tbl-head"><tr><th className="w-32">Sigla</th><th>Definição</th><th className="w-10"></th></tr></thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-white/25 text-sm">
                Nenhuma sigla ainda. Adicione uma, ou cadastre direto pelo bloco “Definições / Siglas” de uma IT.
              </td></tr>
            )}
            {itens.length > 0 && visiveis.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-white/25 text-sm">Nada encontrado para “{busca}”.</td></tr>
            )}
            {visiveis.map(({ it, idx }) => {
              const dup = chaveSigla(it.sigla) !== '' && (cont.get(chaveSigla(it.sigla)) ?? 0) > 1
              return (
                <tr key={idx} className="tbl-row">
                  <td>
                    <input
                      className={cn('input font-mono font-semibold text-[12px] py-1 w-28 uppercase', dup && 'border-red-500/50 text-red-300')}
                      placeholder="SIGLA" value={it.sigla}
                      title={dup ? 'Sigla duplicada' : undefined}
                      onChange={e => set(idx, 'sigla', e.target.value)} />
                  </td>
                  <td>
                    <input className="input text-[12px] py-1 w-full" placeholder="Definição completa"
                      value={it.definicao} onChange={e => set(idx, 'definicao', e.target.value)} />
                  </td>
                  <td>
                    <button type="button" onClick={() => del(idx)} className="text-white/25 hover:text-red-400 p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-white/30 mt-3 flex items-center gap-1.5">
        <BookText size={12} /> Lembre de clicar em <b className="text-white/50">Salvar tudo</b> — as alterações só valem depois de salvar.
      </p>
    </div>
  )
}
