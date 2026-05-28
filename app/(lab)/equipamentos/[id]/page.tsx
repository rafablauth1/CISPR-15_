'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, X, Save } from 'lucide-react'
import { fmt } from '@/lib/utils'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import type { GrandezaMetrologica } from '@/lib/metrologia/tipos'
import type { Checagem } from '@/lib/checagens/tipos'

/* ── Helpers ──────────────────────────────────────────────────── */

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

/* ── Estado do modal de grandeza ──────────────────────────────── */

interface GrandezaForm {
  nome: string
  simbolo: string
  unidade: string
  faixaMin: number | ''
  faixaMax: number | ''
  resolucao: string
  incertezaExpandida: string
  fatorCobertura: number
}

const GRANDEZA_EMPTY: GrandezaForm = {
  nome: '',
  simbolo: '',
  unidade: '',
  faixaMin: '',
  faixaMax: '',
  resolucao: '',
  incertezaExpandida: '',
  fatorCobertura: 2,
}

/* ── Modal ────────────────────────────────────────────────────── */

function GrandezaModal({
  inicial,
  onSalvar,
  onFechar,
}: {
  inicial?: GrandezaMetrologica
  onSalvar: (g: GrandezaForm) => void
  onFechar: () => void
}) {
  const [form, setForm] = useState<GrandezaForm>(
    inicial
      ? { ...inicial, faixaMin: inicial.faixaMin, faixaMax: inicial.faixaMax }
      : GRANDEZA_EMPTY
  )
  const [erro, setErro] = useState('')

  function set<K extends keyof GrandezaForm>(key: K, value: GrandezaForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim())   { setErro('Nome é obrigatório.'); return }
    if (!form.unidade.trim()) { setErro('Unidade é obrigatória.'); return }
    onSalvar(form)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onFechar}
    >
      <div
        className="card p-6"
        style={{ width: 520, maxWidth: '95vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-display font-bold text-[15px] text-white">
            {inicial ? 'Editar grandeza' : 'Nova grandeza'}
          </p>
          <button type="button" onClick={onFechar} className="btn-ghost p-1.5">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">
                Nome *
              </label>
              <input
                className="input"
                placeholder="ex: Tensão DC"
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">
                Símbolo
              </label>
              <input
                className="input"
                placeholder="ex: V"
                value={form.simbolo}
                onChange={e => set('simbolo', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">
                Unidade *
              </label>
              <input
                className="input"
                placeholder="ex: V, dBµV, MHz"
                value={form.unidade}
                onChange={e => set('unidade', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">
                Fator de cobertura (k)
              </label>
              <input
                type="number"
                min={1}
                max={3}
                step={0.5}
                className="input"
                value={form.fatorCobertura}
                onChange={e => set('fatorCobertura', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">
                Faixa mínima
              </label>
              <input
                type="number"
                className="input"
                placeholder="0"
                value={form.faixaMin}
                onChange={e => set('faixaMin', e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">
                Faixa máxima
              </label>
              <input
                type="number"
                className="input"
                placeholder="100"
                value={form.faixaMax}
                onChange={e => set('faixaMax', e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">
                Resolução
              </label>
              <input
                className="input"
                placeholder="ex: 0,001"
                value={form.resolucao}
                onChange={e => set('resolucao', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">
                Incerteza expandida
              </label>
              <input
                className="input"
                placeholder="ex: ± 0,05 V"
                value={form.incertezaExpandida}
                onChange={e => set('incertezaExpandida', e.target.value)}
              />
            </div>
          </div>

          {erro && (
            <p className="text-[12px] mb-3" style={{ color: '#F87171' }}>{erro}</p>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onFechar} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Save size={12} /> Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Página principal ─────────────────────────────────────────── */

export default function EquipamentoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [equip,     setEquip]     = useState<EquipamentoEMC | null>(null)
  const [checagens, setChecagens] = useState<Checagem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [salvando,  setSalvando]  = useState(false)

  useEffect(() => {
    fetch(`/api/equipamentos/${id}`).then(r => r.json()).then((e: EquipamentoEMC & { error?: string }) => {
      if (!e.error) setEquip(e)
    }).catch(() => {})
    fetch('/api/checagens').then(r => r.json()).then((cs: Checagem[]) => {
      setChecagens(Array.isArray(cs) ? cs.filter(c => c.equipamentoId === id) : [])
    }).catch(() => {})
  }, [id])

  /* ── Salva o equipamento com grandezas atualizadas ── */
  async function salvarGrandezas(grandezas: GrandezaMetrologica[]) {
    if (!equip) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/equipamentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...equip, grandezas }),
      })
      if (res.ok) {
        const updated: EquipamentoEMC = await res.json()
        setEquip(updated)
      }
    } catch {}
    setSalvando(false)
  }

  /* ── Handlers do modal ── */
  function handleSalvarGrandeza(form: GrandezaForm) {
    if (!equip) return
    const grandeza: GrandezaMetrologica = {
      id:                 editIndex !== null ? equip.grandezas[editIndex].id : Date.now().toString(),
      nome:               form.nome.trim(),
      simbolo:            form.simbolo.trim(),
      unidade:            form.unidade.trim(),
      faixaMin:           form.faixaMin === '' ? 0 : form.faixaMin,
      faixaMax:           form.faixaMax === '' ? 0 : form.faixaMax,
      resolucao:          form.resolucao.trim(),
      incertezaExpandida: form.incertezaExpandida.trim(),
      fatorCobertura:     form.fatorCobertura,
    }
    const novas =
      editIndex !== null
        ? equip.grandezas.map((g, i) => (i === editIndex ? grandeza : g))
        : [...equip.grandezas, grandeza]

    setModalOpen(false)
    setEditIndex(null)
    salvarGrandezas(novas)
  }

  function handleDeletarGrandeza(index: number) {
    if (!equip) return
    const novas = equip.grandezas.filter((_, i) => i !== index)
    salvarGrandezas(novas)
  }

  function abrirEditar(index: number) {
    setEditIndex(index)
    setModalOpen(true)
  }

  function abrirNova() {
    setEditIndex(null)
    setModalOpen(true)
  }

  if (!equip) return (
    <div className="flex items-center justify-center py-20 text-white/25 text-sm">
      Carregando...
    </div>
  )

  const grandezaEmEdicao = editIndex !== null ? equip.grandezas[editIndex] : undefined

  return (
    <div>
      {/* Modal */}
      {modalOpen && (
        <GrandezaModal
          inicial={grandezaEmEdicao}
          onSalvar={handleSalvarGrandeza}
          onFechar={() => { setModalOpen(false); setEditIndex(null) }}
        />
      )}

      {/* Header */}
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
            ['Fabricante',         equip.fabricante        ?? '—'],
            ['Modelo',             equip.modelo            ?? '—'],
            ['Nº de série',        equip.serie             ?? '—'],
            ['Lab. de calibração', equip.labCalibracao     ?? '—'],
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

      {/* Grandezas metrológicas */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="form-section" style={{ marginTop: 0, paddingTop: 0, border: 'none' }}>
            Grandezas metrológicas
          </p>
          <button
            type="button"
            onClick={abrirNova}
            className="btn-secondary"
            style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}
            disabled={salvando}
          >
            <Plus size={11} /> Adicionar grandeza
          </button>
        </div>

        {equip.grandezas.length === 0 ? (
          <p className="text-white/25 text-sm py-4 text-center">
            Nenhuma grandeza cadastrada. Clique em "+ Adicionar grandeza".
          </p>
        ) : (
          <table className="w-full">
            <thead className="tbl-head">
              <tr>
                <th>Nome</th>
                <th>Símbolo</th>
                <th>Unidade</th>
                <th>Faixa</th>
                <th>Resolução</th>
                <th>Incerteza exp.</th>
                <th>k</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equip.grandezas.map((g, i) => (
                <tr
                  key={g.id}
                  className="tbl-row cursor-pointer"
                  onClick={() => abrirEditar(i)}
                >
                  <td className="font-medium text-white/80">{g.nome}</td>
                  <td className="font-mono text-[11px]">{g.simbolo}</td>
                  <td className="font-mono text-[11px]">{g.unidade}</td>
                  <td className="font-mono text-[11px]">{g.faixaMin} — {g.faixaMax}</td>
                  <td className="font-mono text-[11px]">{g.resolucao}</td>
                  <td className="font-mono text-[11px]">{g.incertezaExpandida}</td>
                  <td className="font-mono text-[11px]">{g.fatorCobertura}</td>
                  <td>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleDeletarGrandeza(i) }}
                      className="btn-ghost p-1"
                      style={{ color: 'rgba(248,113,113,0.5)' }}
                      disabled={salvando}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {salvando && (
          <p className="text-[11px] text-white/30 font-mono mt-2 text-right">Salvando…</p>
        )}
      </div>

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
