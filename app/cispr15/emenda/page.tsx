'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, History, CheckCircle2, AlertCircle, ChevronDown, Upload, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type Cispr15Config, type RelatorioSalvo, type AmendmentChange, type EmendaDraft,
  DEFAULTS, CFG_KEY, PHOTOS_KEY, DOCX_HTML_KEY, DOCX_NAME_KEY,
  RELATORIOS_KEY, EMENDA_DRAFT_KEY, RELATORIO_DOCX_PFX, today, formatEmendaNumero,
} from '../types'

/* ─── diff engine ─────────────────────────────────────────────────────────── */
function detectChanges(
  original: Cispr15Config,
  amended: Cispr15Config,
  photosAlteradas: boolean[],
  docxAlterado: boolean,
): AmendmentChange[] {
  const changes: AmendmentChange[] = []
  let m = 1
  const diff = (keys: (keyof Cispr15Config)[]) =>
    keys.some(k => String(original[k] ?? '') !== String(amended[k] ?? ''))

  if (diff(['cliente', 'clienteRua', 'clienteCidade', 'clienteCep']))
    changes.push({ marker: m++, campo: 'cliente', descricao: 'Alteração nos dados do cliente' })
  if (diff(['produto', 'fabricante', 'modelo', 'identificador']))
    changes.push({ marker: m++, campo: 'amostra', descricao: 'Alteração nos dados da amostra' })
  if (diff(['tensaoAlim', 'potencia', 'frequencia']))
    changes.push({ marker: m++, campo: 'tecnico', descricao: 'Alteração nos dados técnicos da amostra' })
  if (diff(['periodoInicio', 'periodoFim', 'dataEmissao']))
    changes.push({ marker: m++, campo: 'periodo', descricao: 'Alteração no período de realização dos ensaios' })
  if (diff(['documentacao']))
    changes.push({ marker: m++, campo: 'documentacao', descricao: 'Alteração na documentação que acompanha a amostra' })
  if (diff(['protocolo', 'orcamento']))
    changes.push({ marker: m++, campo: 'protocolo', descricao: 'Alteração nos dados de protocolo' })
  if (docxAlterado)
    changes.push({ marker: m++, campo: 'resultados', descricao: 'Alteração nos resultados dos ensaios' })
  photosAlteradas.forEach((changed, i) => {
    if (changed)
      changes.push({ marker: m++, campo: `foto_${i + 1}`, descricao: `Substituição da Figura ${i + 1} – Amostra ensaiada` })
  })
  return changes
}

/* ─── helpers de campo ────────────────────────────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono">{children}</label>
}

function Field({
  label, value, original, onChange, type = 'text',
}: {
  label: string; value: string; original: string
  onChange: (v: string) => void; type?: string
}) {
  const changed = value !== original
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {changed && (
          <span className="text-[9px] font-mono text-amber-400 border border-amber-500/30 rounded px-1 py-0.5">alterado</span>
        )}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'input text-sm',
          changed && 'border-amber-500/50 focus:border-amber-400 ring-amber-400/20',
        )}
      />
      {changed && (
        <p className="text-[9px] text-white/25 font-mono">Original: {original || '—'}</p>
      )}
    </div>
  )
}

/* ─── página ──────────────────────────────────────────────────────────────── */
export default function EmendaPage() {
  const router = useRouter()
  const [relatorios,      setRelatorios]      = useState<RelatorioSalvo[]>([])
  const [selectedId,      setSelectedId]      = useState<string>('')
  const [cfg,             setCfg]             = useState<Cispr15Config>(DEFAULTS)
  const [dataEmenda,      setDataEmenda]       = useState(today())
  const [photosAlteradas, setPhotosAlteradas] = useState<boolean[]>([false, false, false, false])
  const [docxAlterado,    setDocxAlterado]    = useState(false)
  const [novoDocxHtml,    setNovoDocxHtml]    = useState<string | null>(null)
  const [novoDocxName,    setNovoDocxName]    = useState<string | null>(null)
  const [docxLoading,     setDocxLoading]     = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RELATORIOS_KEY)
      if (raw) {
        const lista: RelatorioSalvo[] = JSON.parse(raw)
        setRelatorios(lista)
        if (lista.length > 0) {
          setSelectedId(lista[lista.length - 1].id)
          setCfg({ ...lista[lista.length - 1].cfg })
        }
      }
    } catch {}
  }, [])

  const selected = useMemo(
    () => relatorios.find(r => r.id === selectedId) ?? null,
    [relatorios, selectedId],
  )

  function selectReport(id: string) {
    setSelectedId(id)
    const r = relatorios.find(r => r.id === id)
    if (r) {
      setCfg({ ...r.cfg })
      setPhotosAlteradas(Array(Math.max(r.photos.length, 4)).fill(false))
      setDocxAlterado(false)
      setNovoDocxHtml(null)
      setNovoDocxName(null)
    }
  }

  async function handleNovoDocx(file: File) {
    setDocxLoading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res  = await fetch('/api/parse-docx', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setNovoDocxHtml(data.html)
      setNovoDocxName(file.name)
    } catch (err: any) {
      alert(`Erro ao processar .docx: ${err.message}`)
    } finally {
      setDocxLoading(false)
    }
  }

  const set = (k: keyof Cispr15Config) => (v: string) =>
    setCfg(prev => ({ ...prev, [k]: v }))

  const alteracoes = useMemo(
    () => selected ? detectChanges(selected.cfg, cfg, photosAlteradas, docxAlterado) : [],
    [selected, cfg, photosAlteradas, docxAlterado],
  )

  function gerarEmenda() {
    if (!selected) return
    if (alteracoes.length === 0) {
      alert('Nenhuma alteração detectada. Edite pelo menos um campo.')
      return
    }
    const emendaNum = (selected.emendas.length || 0) + 1
    const draft: EmendaDraft = {
      relatorioId: selected.id,
      numRelatorioOriginal: selected.numRelatorio,
      emendaNum,
      dataEmenda,
      alteracoes,
      cfgOriginal: selected.cfg,
      photoNamesOriginal: selected.photos.map(p => p.name),
      docxFilenameOriginal: selected.docxFilename,
    }
    localStorage.setItem(EMENDA_DRAFT_KEY, JSON.stringify(draft))
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg))

    // Restaurar fotos e docx do relatório original para os storages de trabalho
    try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(selected.photos)) } catch {}
    // Se houve upload de novo docx para a emenda, usar ele; senão, restaurar o original
    if (novoDocxHtml) {
      sessionStorage.setItem(DOCX_HTML_KEY, novoDocxHtml)
      sessionStorage.setItem(DOCX_NAME_KEY, novoDocxName ?? '')
    } else {
      const docxHtml = localStorage.getItem(RELATORIO_DOCX_PFX + selected.id)
      if (docxHtml) sessionStorage.setItem(DOCX_HTML_KEY, docxHtml)
      else sessionStorage.removeItem(DOCX_HTML_KEY)
      sessionStorage.setItem(DOCX_NAME_KEY, selected.docxFilename ?? '')
    }

    router.push('/cispr15/relatorio')
  }

  if (relatorios.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-8">
          <ArrowLeft size={14} /> Voltar
        </button>
        <div className="card p-8 text-center">
          <History size={36} className="text-white/15 mx-auto mb-4" />
          <p className="text-white/50 text-sm mb-2">Nenhum relatório salvo</p>
          <p className="text-white/25 text-xs">
            Gere e baixe um PDF primeiro para criar uma emenda.
          </p>
        </div>
      </div>
    )
  }

  const numFotos = Math.max(selected?.photos.length ?? 2, 4)

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-6">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="mb-6">
        <p className="form-section mb-1">Formulários de Ensaio · EMC · CISPR 15</p>
        <h1 className="text-2xl font-display font-bold text-white">Gerar Emenda</h1>
        <p className="text-white/40 text-sm mt-1">Edite os campos alterados — diferenças são detectadas automaticamente</p>
      </div>

      {/* Seleção do relatório */}
      <div className="card p-5 mb-4">
        <p className="form-section mb-3">Relatório original</p>
        <div className="relative">
          <select
            value={selectedId}
            onChange={e => selectReport(e.target.value)}
            className="input w-full appearance-none pr-8 text-sm"
          >
            {relatorios.map(r => (
              <option key={r.id} value={r.id}>
                {r.numRelatorio} — {r.clienteNome} — {r.dataEmissao}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        </div>
        {selected && (
          <p className="text-[10px] text-white/25 font-mono mt-2">
            Emendas anteriores: {selected.emendas.length === 0 ? 'nenhuma' : selected.emendas.map(e => formatEmendaNumero(selected.numRelatorio, e.numero)).join(', ')} ·
            Próxima: {formatEmendaNumero(selected.numRelatorio, (selected.emendas.length || 0) + 1)}
          </p>
        )}
      </div>

      {/* Data da emenda */}
      <div className="card p-5 mb-4">
        <p className="form-section mb-3">Data da Emenda</p>
        <input
          type="date" value={dataEmenda}
          onChange={e => setDataEmenda(e.target.value)}
          className="input w-48 text-sm"
        />
      </div>

      {/* ── Cliente ── */}
      <div className="card p-5 mb-4">
        <p className="form-section mb-4">Cliente</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2">
            <Field label="Nome do Cliente" value={cfg.cliente} original={selected?.cfg.cliente ?? ''} onChange={set('cliente')} />
          </div>
          <div className="col-span-2">
            <Field label="Rua – Número – Bairro" value={cfg.clienteRua} original={selected?.cfg.clienteRua ?? ''} onChange={set('clienteRua')} />
          </div>
          <Field label="Cidade – Estado" value={cfg.clienteCidade} original={selected?.cfg.clienteCidade ?? ''} onChange={set('clienteCidade')} />
          <Field label="CEP" value={cfg.clienteCep} original={selected?.cfg.clienteCep ?? ''} onChange={set('clienteCep')} />
        </div>
      </div>

      {/* ── Objeto Ensaiado ── */}
      <div className="card p-5 mb-4">
        <p className="form-section mb-4">Objeto Ensaiado</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2">
            <Field label="Produto / Descrição" value={cfg.produto} original={selected?.cfg.produto ?? ''} onChange={set('produto')} />
          </div>
          <Field label="Fabricante" value={cfg.fabricante} original={selected?.cfg.fabricante ?? ''} onChange={set('fabricante')} />
          <Field label="Modelo" value={cfg.modelo} original={selected?.cfg.modelo ?? ''} onChange={set('modelo')} />
          <Field label="Código de Barras / N° Série" value={cfg.identificador} original={selected?.cfg.identificador ?? ''} onChange={set('identificador')} />
          <Field label="Potência Nominal" value={cfg.potencia} original={selected?.cfg.potencia ?? ''} onChange={set('potencia')} />
          <Field label="Tensão de Alimentação" value={cfg.tensaoAlim} original={selected?.cfg.tensaoAlim ?? ''} onChange={set('tensaoAlim')} />
          <Field label="Frequência de Rede" value={cfg.frequencia} original={selected?.cfg.frequencia ?? ''} onChange={set('frequencia')} />
        </div>
      </div>

      {/* ── Documentação ── */}
      <div className="card p-5 mb-4">
        <p className="form-section mb-4">Documentação / Período</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2">
            <Field label="Documentação que acompanha a amostra" value={cfg.documentacao} original={selected?.cfg.documentacao ?? ''} onChange={set('documentacao')} />
          </div>
          <Field label="Protocolo LABELO" value={cfg.protocolo} original={selected?.cfg.protocolo ?? ''} onChange={set('protocolo')} />
          <Field label="Orçamento LABELO" value={cfg.orcamento} original={selected?.cfg.orcamento ?? ''} onChange={set('orcamento')} />
          <Field label="Período — Início" value={cfg.periodoInicio} original={selected?.cfg.periodoInicio ?? ''} onChange={set('periodoInicio')} type="date" />
          <Field label="Período — Fim" value={cfg.periodoFim} original={selected?.cfg.periodoFim ?? ''} onChange={set('periodoFim')} type="date" />
          <div className="col-span-2">
            <Field label="Data de Emissão" value={cfg.dataEmissao} original={selected?.cfg.dataEmissao ?? ''} onChange={set('dataEmissao')} type="date" />
          </div>
        </div>
      </div>

      {/* ── Fotos e Resultados ── */}
      <div className="card p-5 mb-4">
        <p className="form-section mb-3">Fotos e Resultados dos Ensaios</p>
        <p className="text-[10px] text-white/30 font-mono mb-4">
          Marque os itens que serão substituídos no relatório
        </p>
        <div className="space-y-2 mb-4">
          {Array.from({ length: numFotos }, (_, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={photosAlteradas[i] ?? false}
                onChange={e => {
                  const next = [...photosAlteradas]
                  while (next.length <= i) next.push(false)
                  next[i] = e.target.checked
                  setPhotosAlteradas(next)
                }}
                className="w-4 h-4 rounded accent-amber-400 cursor-pointer"
              />
              <span className="text-sm text-white/60 group-hover:text-white/80">
                Figura {i + 1} – Amostra ensaiada
                {selected?.photos[i] && (
                  <span className="text-white/25 text-xs ml-2 font-mono">{selected.photos[i].name}</span>
                )}
              </span>
            </label>
          ))}
        </div>
        <div className="border-t border-white/5 pt-3 space-y-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={docxAlterado}
              onChange={e => { setDocxAlterado(e.target.checked); if (!e.target.checked) { setNovoDocxHtml(null); setNovoDocxName(null) } }}
              className="w-4 h-4 rounded accent-amber-400 cursor-pointer"
            />
            <span className="text-sm text-white/60 group-hover:text-white/80">
              Resultados dos ensaios (arquivo Radimation .docx)
              {selected?.docxFilename && (
                <span className="text-white/25 text-xs ml-2 font-mono">{selected.docxFilename}</span>
              )}
            </span>
          </label>

          {/* Upload do novo .docx */}
          {docxAlterado && (
            <div className="ml-7">
              {novoDocxHtml ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                  <CheckCircle2 size={12} className="text-amber-400 flex-shrink-0" />
                  <span className="text-amber-300 text-[11px] font-mono truncate flex-1">{novoDocxName}</span>
                  <button type="button" onClick={() => { setNovoDocxHtml(null); setNovoDocxName(null) }}
                    className="text-white/25 hover:text-red-400 transition-colors flex-shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ) : docxLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-blue-400">
                  <Loader2 size={11} className="animate-spin" /> Processando…
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-500/30 text-amber-400/70 hover:border-amber-400/50 hover:text-amber-400 cursor-pointer transition-all text-[11px]">
                  <Upload size={11} /> Carregar novo .docx de substituição
                  <input type="file" accept=".docx" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleNovoDocx(f) }} />
                </label>
              )}
              <p className="text-[9px] text-white/20 font-mono mt-1">
                Se não carregar um novo arquivo, o .docx original será mantido no relatório.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Resumo das alterações ── */}
      <div className={cn(
        'card p-5 mb-6 border',
        alteracoes.length > 0
          ? 'border-amber-500/25 bg-amber-500/5'
          : 'border-white/5',
      )}>
        <div className="flex items-center gap-2 mb-3">
          {alteracoes.length > 0
            ? <AlertCircle size={14} className="text-amber-400" />
            : <CheckCircle2 size={14} className="text-white/20" />}
          <p className="text-sm font-medium text-white/70">
            {alteracoes.length === 0
              ? 'Nenhuma alteração detectada'
              : `${alteracoes.length} alteração(ões) detectada(s)`}
          </p>
        </div>
        {alteracoes.length > 0 && (
          <ul className="space-y-1.5">
            {alteracoes.map(a => (
              <li key={a.campo} className="flex items-center gap-2 text-xs text-amber-300/80">
                <span className="font-mono font-bold text-amber-400 w-4 text-center">{a.marker}</span>
                {a.descricao}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm">
          Cancelar
        </button>
        <div className="flex-1" />
        <button
          onClick={gerarEmenda}
          disabled={alteracoes.length === 0}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-bold disabled:opacity-40">
          <History size={14} /> Gerar {selected ? formatEmendaNumero(selected.numRelatorio, (selected.emendas.length || 0) + 1) : 'Emenda'}
        </button>
      </div>
    </div>
  )
}
