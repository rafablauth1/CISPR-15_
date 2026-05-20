'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Plus, Search, X, CheckCircle2, Clock, Edit2,
  Trash2, ChevronDown, ChevronUp, FileText,
  Lightbulb, Lamp, Settings, Layers, RotateCcw, Link2, FileSearch,
  AlertTriangle, Wifi, BarChart2, Tag, TrendingUp, Printer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type AgendaItem, type RelatorioSalvo, type ClienteDB,
  type LoteAmostra, type LoteConfig, type Cispr15Config,
  AGENDA_KEY, RELATORIOS_KEY, CLIENTES_KEY, CFG_KEY, LOTE_KEY, today,
} from '@/app/cispr15/types'

/* ─── tags predefinidas ───────────────────────────────────────────────────── */
const PREDEFINED_TAGS = [
  { id: 'urgente',      label: 'Urgente',             cls: 'border-orange-400/40 bg-orange-400/8 text-orange-300' },
  { id: 'reensaio',     label: 'Reensaio',             cls: 'border-blue-400/40 bg-blue-400/8 text-blue-300' },
  { id: 'reprov_cond',  label: 'Reprov. Conduzida',    cls: 'border-red-400/40 bg-red-400/8 text-red-300' },
  { id: 'reprov_loop',  label: 'Reprov. Loop',         cls: 'border-red-400/40 bg-red-400/8 text-red-300' },
  { id: 'reprov_b',     label: 'Reprov. Anexo B',      cls: 'border-red-400/40 bg-red-400/8 text-red-300' },
] as const

type TagId = typeof PREDEFINED_TAGS[number]['id']

function tagInfo(id: string) {
  return PREDEFINED_TAGS.find(t => t.id === id)
}

function TagChip({ id, small }: { id: string; small?: boolean }) {
  const t = tagInfo(id)
  if (!t) return null
  return (
    <span className={cn(
      'inline-flex items-center rounded border font-semibold leading-none',
      t.cls,
      small ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5',
    )}>
      {t.label}
    </span>
  )
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

function fmtMonth(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 999
  const now = new Date(today() + 'T00:00:00')
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
}

function deadlineColor(item: AgendaItem): string {
  if (item.numRelatorio) return 'rgba(255,255,255,0.07)'
  const d = daysUntil(item.previsaoSaida)
  if (d < 0)   return 'rgba(239,68,68,0.55)'
  if (d <= 3)  return 'rgba(251,191,36,0.55)'
  return 'rgba(34,197,94,0.4)'
}

function addBusinessDays(dateStr: string, days: number): string {
  const date = new Date((dateStr || today()) + 'T12:00:00')
  let added = 0
  while (added < days) {
    date.setDate(date.getDate() + 1)
    const dow = date.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return date.toISOString().split('T')[0]
}

function newItem(): AgendaItem {
  const entrada = today()
  return {
    id: crypto.randomUUID(),
    tipo: 'lampada',
    protocolo: '', orcamento: '', cliente: '', produto: '',
    dataEntrada: entrada,
    previsaoSaida: addBusinessDays(entrada, 10),
    dataEmissao: '', numRelatorio: '', responsavel: '',
    statusConduzida: 'pendente', statusLoop: 'pendente', statusAnexoB: 'pendente',
    observacoes: '', pdfPath: '', tags: [],
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono">{children}</label>
}

/* ─── seletor de cliente ──────────────────────────────────────────────────── */
function ClientePicker({ clientes, onSelect }: {
  clientes: ClienteDB[]
  onSelect: (c: ClienteDB) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const filtrados = clientes.filter(c =>
    !q || c.nome?.toLowerCase().includes(q.toLowerCase()) || c.cnpj?.includes(q)
  )
  if (clientes.length === 0) return null
  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input
            className="input pl-7 text-xs"
            placeholder="Buscar cliente cadastrado…"
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        </div>
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl border border-white/10 bg-[#0d1017] shadow-xl max-h-[180px] overflow-y-auto">
          {filtrados.length === 0
            ? <p className="text-[11px] text-white/25 px-3 py-2">Nenhum cliente encontrado.</p>
            : filtrados.slice(0, 20).map(c => (
                <button key={c.id} type="button" onMouseDown={() => { onSelect(c); setQ(''); setOpen(false) }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/4 last:border-0">
                  <p className="text-xs text-white/80 font-semibold">{c.nome}</p>
                  {(c.cidade || c.cep) && (
                    <p className="text-[10px] text-white/35">{[c.cidade, c.cep].filter(Boolean).join(' · ')}</p>
                  )}
                </button>
              ))
          }
        </div>
      )}
    </div>
  )
}

/* ─── modal item único ────────────────────────────────────────────────────── */
function ItemModal({ item, onSave, onClose, clientes }: {
  item: AgendaItem; onSave: (i: AgendaItem) => void; onClose: () => void
  clientes: ClienteDB[]
}) {
  const [form, setForm] = useState<AgendaItem>({
    fabricante: '', modelo: '', identificador: '', potencia: '', tensaoAlim: '', frequencia: '50/60Hz',
    clienteRua: '', clienteCidade: '', clienteCep: '', documentacao: '', tags: [],
    ...item,
  })
  const [showDUT, setShowDUT] = useState(
    !!(item.fabricante || item.modelo || item.potencia || item.tensaoAlim)
  )

  const s = (k: keyof AgendaItem) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  function handleEntrada(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setForm(prev => ({
      ...prev,
      dataEntrada: v,
      previsaoSaida: prev.previsaoSaida === addBusinessDays(prev.dataEntrada, 10)
        ? addBusinessDays(v, 10)
        : prev.previsaoSaida,
    }))
  }

  function toggleTag(id: string) {
    setForm(p => {
      const tags = p.tags ?? []
      return { ...p, tags: tags.includes(id) ? tags.filter(t => t !== id) : [...tags, id] }
    })
  }

  const tags = form.tags ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-fade-in">

        <div className="flex items-center justify-between">
          <p className="text-white font-bold text-sm">{item.protocolo ? 'Editar Item' : 'Novo Item'}</p>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-3">
          {(['lampada', 'luminaria'] as const).map(t => (
            <button key={t} type="button" onClick={() => setForm(p => ({ ...p, tipo: t }))}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                form.tipo === t ? 'border-gold/40 bg-gold/8 text-gold' : 'border-white/8 text-white/40 hover:border-white/20',
              )}>
              {t === 'lampada' ? <Lightbulb size={15} /> : <Lamp size={15} />}
              {t === 'lampada' ? 'Lâmpada' : 'Luminária'}
            </button>
          ))}
        </div>

        {/* Protocolo / Orçamento / Datas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Protocolo LABELO</Label>
            <input className="input" value={form.protocolo} onChange={s('protocolo')} placeholder="Ex: 26041953" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Orçamento LABELO</Label>
            <input className="input" value={form.orcamento} onChange={s('orcamento')} placeholder="Ex: 0887" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Data de Entrada</Label>
            <input type="date" className="input" value={form.dataEntrada} onChange={handleEntrada} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Previsão de Saída</Label>
            <div className="flex gap-2">
              <input type="date"
                className={cn('input flex-1', form.previsaoSaida && form.dataEntrada && form.previsaoSaida < form.dataEntrada && 'border-red-500/50')}
                value={form.previsaoSaida} onChange={s('previsaoSaida')} />
              <button type="button" title="Recalcular: +10 dias úteis"
                onClick={() => setForm(p => ({ ...p, previsaoSaida: addBusinessDays(p.dataEntrada, 10) }))}
                className="w-9 shrink-0 rounded-lg border border-white/10 text-white/30 hover:text-teal hover:border-teal/30 flex items-center justify-center transition-all">
                <RotateCcw size={12} />
              </button>
            </div>
            {form.previsaoSaida && form.dataEntrada && form.previsaoSaida < form.dataEntrada && (
              <p className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertTriangle size={9} /> Previsão anterior à data de entrada
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Responsável</Label>
            <input className="input" value={form.responsavel} onChange={s('responsavel')} placeholder="Ex: João Silva" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>N° Relatório <span className="normal-case text-white/20">(quando emitido)</span></Label>
            <input className="input" value={form.numRelatorio} onChange={s('numRelatorio')} placeholder="Ex: EMC 1244/2026" />
          </div>
        </div>

        {/* Cliente */}
        <div className="space-y-2">
          <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Dados do Cliente</p>
          <ClientePicker clientes={clientes} onSelect={c => setForm(p => ({
            ...p, cliente: c.nome, clienteRua: c.rua, clienteCidade: c.cidade, clienteCep: c.cep,
          }))} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Nome</Label>
              <input className="input" value={form.cliente} onChange={s('cliente')} placeholder="Nome do cliente" />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Endereço <span className="normal-case text-white/20">(opcional)</span></Label>
              <input className="input" value={form.clienteRua ?? ''} onChange={s('clienteRua')} placeholder="Rua, número" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cidade <span className="normal-case text-white/20">(opcional)</span></Label>
              <input className="input" value={form.clienteCidade ?? ''} onChange={s('clienteCidade')} placeholder="Porto Alegre" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>CEP <span className="normal-case text-white/20">(opcional)</span></Label>
              <input className="input" value={form.clienteCep ?? ''} onChange={s('clienteCep')} placeholder="00000-000" />
            </div>
          </div>
        </div>

        {/* DUT / Amostra (expansível) */}
        <div className="space-y-2">
          <button type="button" onClick={() => setShowDUT(p => !p)}
            className="flex items-center gap-2 text-[10px] text-white/40 font-mono uppercase tracking-widest hover:text-white/60 transition-colors w-full text-left">
            <ChevronDown size={11} className={cn('transition-transform', showDUT && 'rotate-180')} />
            Dados da Amostra / DUT
            <span className="text-white/20 normal-case font-normal tracking-normal">(opcional — preencha para pré-carregar o relatório)</span>
          </button>
          {showDUT && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-white/6 bg-white/[0.015]">
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label>Produto / Descrição</Label>
                <input className="input" value={form.produto} onChange={s('produto')} placeholder="Ex: Luminária LED Pública 100W" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Fabricante</Label>
                <input className="input" value={form.fabricante ?? ''} onChange={s('fabricante')} placeholder="Ex: Philips" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Modelo</Label>
                <input className="input" value={form.modelo ?? ''} onChange={s('modelo')} placeholder="Ex: LD-LED-100W" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{form.tipo === 'lampada' ? 'Código de Barras' : 'N° de Série'}</Label>
                <input className="input" value={form.identificador ?? ''} onChange={s('identificador')} placeholder="Identificador" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Potência</Label>
                <input className="input" value={form.potencia ?? ''} onChange={s('potencia')} placeholder="Ex: 100W" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Tensão de Alimentação</Label>
                <input className="input" value={form.tensaoAlim ?? ''} onChange={s('tensaoAlim')} placeholder="Ex: 90 a 305 VAC" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Frequência</Label>
                <input className="input" value={form.frequencia ?? ''} onChange={s('frequencia')} placeholder="50/60Hz" />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label>Documentação</Label>
                <input className="input" value={form.documentacao ?? ''} onChange={s('documentacao')} placeholder="embalagem com especificações" />
              </div>
            </div>
          )}
          {!showDUT && (
            <input className="input" value={form.produto} onChange={s('produto')} placeholder="Produto / DUT (opcional)" />
          )}
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label>Marcadores</Label>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TAGS.map(t => (
              <button key={t.id} type="button" onClick={() => toggleTag(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                  tags.includes(t.id) ? t.cls + ' opacity-100' : 'border-white/8 text-white/30 hover:border-white/20',
                )}>
                <Tag size={10} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status dos ensaios */}
        <div className="space-y-2">
          <Label>Status dos Ensaios</Label>
          <div className="grid grid-cols-3 gap-3">
            {(['statusConduzida', 'statusLoop', 'statusAnexoB'] as const).map((k, i) => (
              <button key={k} type="button"
                onClick={() => setForm(p => ({ ...p, [k]: p[k] === 'pendente' ? 'realizado' : 'pendente' }))}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-all',
                  form[k] === 'realizado'
                    ? 'border-green/30 bg-green/8 text-green-400'
                    : 'border-white/10 text-white/35 hover:border-white/20',
                )}>
                {form[k] === 'realizado' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                {['Conduzida', 'Loop', 'Anexo B'][i]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Observações</Label>
          <textarea className="input min-h-[60px] resize-none" value={form.observacoes} onChange={s('observacoes')}
            placeholder="Anotações livres..." />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-sm transition-all">
            Cancelar
          </button>
          <button type="button" onClick={() => onSave(form)}
            className="btn-primary px-6 py-2 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 size={13} /> Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── modal lote ──────────────────────────────────────────────────────────── */
interface LoteForm {
  protocolos: string
  tipo: 'lampada' | 'luminaria'
  orcamento: string
  cliente: string
  clienteRua: string
  clienteCidade: string
  clienteCep: string
  produto: string
  responsavel: string
  dataEntrada: string
  previsaoSaida: string
}

function LoteModal({ onSave, onClose, clientes }: {
  onSave: (items: AgendaItem[]) => void; onClose: () => void; clientes: ClienteDB[]
}) {
  const entrada = today()
  const [form, setForm] = useState<LoteForm>({
    protocolos: '',
    tipo: 'lampada',
    orcamento: '', cliente: '', clienteRua: '', clienteCidade: '', clienteCep: '',
    produto: '', responsavel: '',
    dataEntrada: entrada,
    previsaoSaida: addBusinessDays(entrada, 10),
  })

  const s = (k: keyof LoteForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  function handleEntrada(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setForm(p => ({
      ...p,
      dataEntrada: v,
      previsaoSaida: p.previsaoSaida === addBusinessDays(p.dataEntrada, 10)
        ? addBusinessDays(v, 10)
        : p.previsaoSaida,
    }))
  }

  const parsed = useMemo(() => {
    return form.protocolos.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
  }, [form.protocolos])

  function handleSave() {
    if (parsed.length === 0) { alert('Informe ao menos um protocolo.'); return }
    const items: AgendaItem[] = parsed.map(proto => ({
      id: crypto.randomUUID(),
      tipo: form.tipo,
      protocolo: proto,
      orcamento: form.orcamento,
      cliente: form.cliente,
      clienteRua: form.clienteRua,
      clienteCidade: form.clienteCidade,
      clienteCep: form.clienteCep,
      produto: form.produto,
      dataEntrada: form.dataEntrada,
      previsaoSaida: form.previsaoSaida,
      dataEmissao: '', numRelatorio: '',
      responsavel: form.responsavel,
      statusConduzida: 'pendente', statusLoop: 'pendente', statusAnexoB: 'pendente',
      observacoes: '', pdfPath: '', tags: [],
    }))
    onSave(items)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-gold" />
            <p className="text-white font-bold text-sm">Cadastrar Lote</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Protocolos (um por linha, ou separados por vírgula)</Label>
          <textarea
            className="input min-h-[110px] resize-none font-mono text-sm"
            value={form.protocolos}
            onChange={s('protocolos')}
            placeholder={"26041953\n26041954\n26041955"}
            autoFocus
          />
          {parsed.length > 0 && (
            <p className="text-[11px] text-teal font-mono">
              {parsed.length} protocolo(s): {parsed.slice(0, 5).join(', ')}{parsed.length > 5 ? ` …+${parsed.length - 5}` : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(['lampada', 'luminaria'] as const).map(t => (
            <button key={t} type="button" onClick={() => setForm(p => ({ ...p, tipo: t }))}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                form.tipo === t ? 'border-gold/40 bg-gold/8 text-gold' : 'border-white/8 text-white/40 hover:border-white/20',
              )}>
              {t === 'lampada' ? <Lightbulb size={15} /> : <Lamp size={15} />}
              {t === 'lampada' ? 'Lâmpada' : 'Luminária'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Orçamento LABELO <span className="normal-case text-white/20">(opcional)</span></Label>
            <input className="input" value={form.orcamento} onChange={s('orcamento')} placeholder="Ex: 0887" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Responsável pelo Preenchimento</Label>
            <input className="input" value={form.responsavel} onChange={s('responsavel')} placeholder="Ex: João Silva" />
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label>Cliente <span className="normal-case text-white/20">(opcional)</span></Label>
            <ClientePicker clientes={clientes} onSelect={c => setForm(p => ({
              ...p, cliente: c.nome, clienteRua: c.rua, clienteCidade: c.cidade, clienteCep: c.cep,
            }))} />
            <input className="input mt-1" value={form.cliente} onChange={s('cliente')} placeholder="Nome do cliente" />
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label>Produto / DUT <span className="normal-case text-white/20">(opcional)</span></Label>
            <input className="input" value={form.produto} onChange={s('produto')} placeholder="Ex: Luminária LED 100W" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Data de Entrada</Label>
            <input type="date" className="input" value={form.dataEntrada} onChange={handleEntrada} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Previsão de Saída</Label>
            <div className="flex gap-2">
              <input type="date" className="input flex-1" value={form.previsaoSaida} onChange={s('previsaoSaida')} />
              <button type="button" title="Recalcular: +10 dias úteis"
                onClick={() => setForm(p => ({ ...p, previsaoSaida: addBusinessDays(p.dataEntrada, 10) }))}
                className="w-9 shrink-0 rounded-lg border border-white/10 text-white/30 hover:text-teal hover:border-teal/30 flex items-center justify-center transition-all">
                <RotateCcw size={12} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-sm transition-all">
            Cancelar
          </button>
          <button type="button" onClick={handleSave}
            className="btn-primary px-6 py-2 text-sm font-bold flex items-center gap-2">
            <Layers size={13} /> Cadastrar {parsed.length > 0 ? `${parsed.length} item(s)` : 'Lote'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── modal gerar lote ────────────────────────────────────────────────────── */
function GerarLoteModal({ agenda, onConfirm, onClose }: {
  agenda: AgendaItem[]
  onConfirm: (itens: AgendaItem[]) => void
  onClose: () => void
}) {
  const [numLote, setNumLote] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const itensAndamento = useMemo(() => {
    const q = numLote.trim().toLowerCase()
    if (!q) return []
    return agenda.filter(a => a.orcamento?.trim().toLowerCase() === q && !a.numRelatorio)
  }, [numLote, agenda])

  // Ao encontrar itens, selecionar todos por padrão
  const prevLen = useMemo(() => itensAndamento.length, [itensAndamento])
  useEffect(() => {
    setSelecionados(new Set(itensAndamento.map(a => a.id)))
  }, [prevLen])

  function toggleItem(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (selecionados.size === itensAndamento.length)
      setSelecionados(new Set())
    else
      setSelecionados(new Set(itensAndamento.map(a => a.id)))
  }

  const itensSelecionados = itensAndamento.filter(a => selecionados.has(a.id))

  function handleConfirm() {
    if (itensSelecionados.length === 0) return
    onConfirm(itensSelecionados)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col p-6 gap-5 animate-fade-in">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ArrowRight size={15} className="text-gold" />
            <p className="text-white font-bold text-sm">Gerar Lote</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono">
            Número do Lote (Orçamento LABELO)
          </label>
          <input
            className="input text-sm font-mono"
            placeholder="Ex: 0887"
            value={numLote}
            onChange={e => setNumLote(e.target.value)}
            autoFocus
          />
        </div>

        {numLote.trim() && itensAndamento.length === 0 && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/6 px-4 py-3 text-xs text-red-400/70 shrink-0">
            Nenhum item em andamento encontrado para o lote <span className="font-mono font-bold">"{numLote.trim()}"</span>.
          </div>
        )}

        {itensAndamento.length > 0 && (
          <>
            {/* cabeçalho da lista */}
            <div className="flex items-center justify-between shrink-0">
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-mono">
                {itensAndamento.length} em andamento
                {' · '}
                <span className="text-teal">{selecionados.size} selecionado(s)</span>
              </p>
              <button type="button" onClick={toggleTodos}
                className="text-[10px] text-white/40 hover:text-white/70 underline transition-colors">
                {selecionados.size === itensAndamento.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>

            {/* lista com scroll */}
            <div className="overflow-y-auto flex-1 space-y-1 min-h-0">
              {itensAndamento.map(a => {
                const sel = selecionados.has(a.id)
                return (
                  <button key={a.id} type="button" onClick={() => toggleItem(a.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all',
                      sel
                        ? 'border-teal/25 bg-teal/6'
                        : 'border-white/6 bg-white/[0.015] opacity-50 hover:opacity-75',
                    )}>
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all',
                      sel ? 'border-teal bg-teal/20' : 'border-white/20',
                    )}>
                      {sel && <CheckCircle2 size={10} className="text-teal" />}
                    </div>
                    <div className={cn('shrink-0', a.tipo === 'lampada' ? 'text-yellow-400/60' : 'text-blue-400/60')}>
                      {a.tipo === 'lampada' ? <Lightbulb size={11} /> : <Lamp size={11} />}
                    </div>
                    <span className="font-mono text-xs text-white/80 w-24 shrink-0 truncate">{a.protocolo || '—'}</span>
                    <span className="flex-1 text-xs text-white/45 truncate min-w-0">
                      {a.produto || a.cliente || '—'}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="text-[10px] text-white/25 shrink-0">
              Tipo: {itensAndamento[0].tipo === 'lampada' ? 'Lâmpada' : 'Luminária'}
              {' · '}Cliente: {itensAndamento[0].cliente || '—'}
            </p>
          </>
        )}

        <div className="flex gap-2 justify-end shrink-0 pt-1 border-t border-white/6">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-sm transition-all">
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm}
            disabled={itensSelecionados.length === 0}
            className="btn-primary px-6 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <ArrowRight size={13} /> Abrir Lote ({itensSelecionados.length})
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── página principal ─────────────────────────────────────────────────────── */
export default function AgendaPage() {
  const router = useRouter()
  const [tab,           setTab]           = useState<'agenda' | 'busca' | 'analise' | 'followup'>('agenda')
  const [agenda,        setAgenda]        = useState<AgendaItem[]>([])
  const [busca,         setBusca]         = useState('')
  const [editItem,      setEditItem]      = useState<AgendaItem | null>(null)
  const [showLote,      setShowLote]      = useState(false)
  const [showGerarLote, setShowGerarLote] = useState(false)
  const [filter,        setFilter]        = useState<'andamento' | 'concluidos' | 'todos'>('andamento')
  const [relatorios,    setRelatorios]    = useState<RelatorioSalvo[]>([])
  const [sortKey,       setSortKey]       = useState<'dataEntrada' | 'previsaoSaida' | 'protocolo'>('dataEntrada')
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc')
  const [search,        setSearch]        = useState('')
  const [filterCliente, setFilterCliente] = useState('')
  const [isElectron,    setIsElectron]    = useState(false)
  const [fromNetwork,   setFromNetwork]   = useState<boolean | null>(null)
  const [clientes,      setClientes]      = useState<ClienteDB[]>([])
  const [fuCliente,     setFuCliente]     = useState('')
  const [fuTipo,        setFuTipo]        = useState<'todos' | 'lampada' | 'luminaria'>('todos')
  const [fuEnsaio,      setFuEnsaio]      = useState<'todos' | 'c_pend' | 'l_pend' | 'b_pend' | 'algum_pend' | 'todos_ok'>('todos')

  useEffect(() => {
    setIsElectron(!!(window as any).electronAPI)
    loadAgenda()
    loadRelatorios()
    loadClientes()
  }, [])

  async function loadAgenda() {
    const api = (window as any).electronAPI
    if (api) {
      try {
        const res = await api.getAgenda()
        setFromNetwork(!!res.fromNetwork)
        if (res.ok && Array.isArray(res.agenda) && res.agenda.length > 0) {
          setAgenda(res.agenda); return
        }
        // Arquivo vazio — migra localStorage para disco
        try {
          const raw = localStorage.getItem(AGENDA_KEY)
          if (raw) {
            const migrated = JSON.parse(raw)
            if (Array.isArray(migrated) && migrated.length > 0) {
              await api.saveAgenda(migrated)
              setAgenda(migrated); return
            }
          }
        } catch {}
        if (res.ok) { setAgenda([]); return }
      } catch {}
    }
    try {
      const raw = localStorage.getItem(AGENDA_KEY)
      if (raw) setAgenda(JSON.parse(raw))
    } catch {}
  }

  async function saveAgenda(items: AgendaItem[]) {
    setAgenda(items)
    const api = (window as any).electronAPI
    if (api) {
      try {
        const res = await api.saveAgenda(items)
        if (res?.ok) return
      } catch {}
    }
    localStorage.setItem(AGENDA_KEY, JSON.stringify(items))
  }

  async function loadRelatorios() {
    const api = (window as any).electronAPI
    if (api) {
      try {
        const res = await api.getRelatorios()
        if (res.ok && Array.isArray(res.relatorios)) { setRelatorios(res.relatorios); return }
      } catch {}
    }
    try {
      const raw = localStorage.getItem(RELATORIOS_KEY)
      if (raw) setRelatorios(JSON.parse(raw))
    } catch {}
  }

  async function loadClientes() {
    const api = (window as any).electronAPI
    if (api) {
      try {
        const res = await api.getClientes()
        if (res.ok && res.fromNetwork && Array.isArray(res.clientes)) { setClientes(res.clientes); return }
      } catch {}
    }
    try {
      const raw = localStorage.getItem(CLIENTES_KEY)
      if (raw) setClientes(JSON.parse(raw))
    } catch {}
  }

  function handleSave(item: AgendaItem) {
    const exists = agenda.some(a => a.id === item.id)
    saveAgenda(exists ? agenda.map(a => a.id === item.id ? item : a) : [...agenda, item])
    setEditItem(null)
  }

  function handleSaveLote(items: AgendaItem[]) {
    saveAgenda([...agenda, ...items])
    setShowLote(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este item da agenda?')) return
    const item = agenda.find(a => a.id === id)
    saveAgenda(agenda.filter(a => a.id !== id))
    if (item?.pdfPath) {
      const api = (window as any).electronAPI
      if (api?.deletePdfCopy) await api.deletePdfCopy(item.pdfPath)
    }
  }

  function retornarParaAndamento(id: string) {
    saveAgenda(agenda.map(a => a.id !== id ? a : { ...a, numRelatorio: '', dataEmissao: '' }))
  }

  function toggleStatus(id: string, field: 'statusConduzida' | 'statusLoop' | 'statusAnexoB') {
    saveAgenda(agenda.map(a => a.id !== id ? a : {
      ...a, [field]: a[field] === 'pendente' ? 'realizado' : 'pendente',
    }))
  }

  function openPDF(pdfPath: string) {
    const api = (window as any).electronAPI
    if (api) api.openPath(pdfPath)
  }

  async function openPdfCopy(item: AgendaItem) {
    const api = (window as any).electronAPI
    if (!api) return
    // busca por numRelatorio primeiro (mais específico), fallback para protocolo
    const query = item.numRelatorio || item.protocolo
    if (!query) return
    const res = await api.findPdfCopy(query)
    if (res?.ok && res.filePaths?.length > 0) {
      if (res.filePaths.length === 1) {
        api.openPath(res.filePaths[0])
      } else {
        // múltiplos PDFs (original + emendas) — abre a pasta para o usuário escolher
        api.openPath(res.folder)
      }
    } else if (res?.folder) {
      api.openPath(res.folder)
    } else {
      alert('PDF não encontrado na pasta de cópias. Configure a pasta em Configurações.')
    }
  }

  function irParaProtocolo(item: AgendaItem) {
    const cfg: Cispr15Config = {
      tipo: item.tipo,
      tensaoConfig: '127_220',
      cliente: item.cliente,
      clienteRua: item.clienteRua ?? '',
      clienteCidade: item.clienteCidade ?? '',
      clienteCep: item.clienteCep ?? '',
      produto: item.produto,
      fabricante: item.fabricante ?? '',
      modelo: item.modelo ?? '',
      identificador: item.identificador ?? '',
      lacre: '',
      tensaoAlim: item.tensaoAlim ?? '',
      potencia: item.potencia ?? '',
      frequencia: item.frequencia ?? '50/60Hz',
      documentacao: item.documentacao ?? 'embalagem com especificações',
      numRelatorio: '',
      orcamento: item.orcamento,
      protocolo: item.protocolo,
      periodoInicio: today(),
      periodoFim: today(),
      dataEmissao: today(),
      responsavel: item.responsavel,
      resultadoConduzida: 'pass',
      resultadoLoop: 'pass',
      resultadoAnexoB: 'pass',
    }
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
    router.push('/cispr15')
  }

  function confirmarGerarLote(itens: AgendaItem[]) {
    const primeiro = itens[0]
    const amostras: LoteAmostra[] = itens.map(item => ({
      produto: item.produto,
      fabricante: item.fabricante ?? '',
      modelo: item.modelo ?? '',
      identificador: item.identificador ?? '',
      tensaoAlim: item.tensaoAlim ?? '',
      potencia: item.potencia ?? '',
      frequencia: item.frequencia ?? '50/60Hz',
      protocolo: item.protocolo,
      orcamento: item.orcamento,
      periodoInicio: today(),
      periodoFim: today(),
      dataEmissao: today(),
      conformidade: 'pendente',
      numRelatorio: '',
      photos: [],
      docxHtml: null,
      docxFilename: null,
    }))
    const lote: LoteConfig = {
      tipo: primeiro.tipo,
      qtd: amostras.length,
      cliente: primeiro.cliente,
      clienteRua: primeiro.clienteRua ?? '',
      clienteCidade: primeiro.clienteCidade ?? '',
      clienteCep: primeiro.clienteCep ?? '',
      responsavel: primeiro.responsavel,
      amostras,
    }
    localStorage.setItem(LOTE_KEY, JSON.stringify(lote))
    router.push('/cispr15/lote')
  }

  const clienteOptions = useMemo(
    () => [...new Set(agenda.map(a => a.cliente).filter(Boolean))].sort(),
    [agenda],
  )

  const filteredItems = useMemo(() => {
    let items = [...agenda]
    if (filter === 'andamento')   items = items.filter(a => !a.numRelatorio)
    else if (filter === 'concluidos') items = items.filter(a => !!a.numRelatorio)
    const q = search.trim().toLowerCase()
    if (q) items = items.filter(a =>
      [a.protocolo, a.orcamento, a.cliente, a.produto, a.numRelatorio, a.responsavel]
        .some(v => v?.toLowerCase().includes(q))
    )
    if (filterCliente) items = items.filter(a => a.cliente === filterCliente)
    items.sort((a, b) => {
      const va = a[sortKey] ?? ''; const vb = b[sortKey] ?? ''
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    return items
  }, [agenda, filter, search, filterCliente, sortKey, sortDir])

  const counts = useMemo(() => ({
    andamento: agenda.filter(a => !a.numRelatorio).length,
    concluidos: agenda.filter(a => !!a.numRelatorio).length,
    todos: agenda.length,
  }), [agenda])

  /* ── analytics ── */
  const analytics = useMemo(() => {
    const now = today()
    const andamento = agenda.filter(a => !a.numRelatorio)
    const concluidos = agenda.filter(a => !!a.numRelatorio)
    const vencidos   = andamento.filter(a => a.previsaoSaida && a.previsaoSaida < now)
    const urgentes   = andamento.filter(a => { const d = daysUntil(a.previsaoSaida); return d >= 0 && d <= 3 })
    const emDia      = andamento.filter(a => daysUntil(a.previsaoSaida) > 3)

    // entradas por mês (últimos 6 meses)
    const months: { key: string; label: string; count: number; concluidos: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
      const key = d.toISOString().substring(0, 7)
      months.push({
        key, label: fmtMonth(key),
        count:     agenda.filter(a => a.dataEntrada?.startsWith(key)).length,
        concluidos: concluidos.filter(a => a.dataEmissao?.startsWith(key)).length,
      })
    }

    // top clientes
    const clientMap: Record<string, number> = {}
    agenda.forEach(a => { if (a.cliente) clientMap[a.cliente] = (clientMap[a.cliente] ?? 0) + 1 })
    const topClientes = Object.entries(clientMap).sort((a, b) => b[1] - a[1]).slice(0, 6)

    // contagem de tags
    const tagMap: Record<string, number> = {}
    agenda.forEach(a => a.tags?.forEach(t => { tagMap[t] = (tagMap[t] ?? 0) + 1 }))

    return {
      total: agenda.length,
      andamento: andamento.length,
      concluidos: concluidos.length,
      vencidos: vencidos.length,
      urgentes: urgentes.length,
      emDia: emDia.length,
      vencidosList: vencidos.slice(0, 6),
      urgentesList: urgentes.slice(0, 6),
      months,
      topClientes,
      tagMap,
      maxMonth: Math.max(1, ...months.map(m => m.count)),
    }
  }, [agenda])

  /* ── follow-up comercial ── */
  const followup = useMemo(() => {
    function stats(items: AgendaItem[]) {
      const em = items.filter(a => !a.numRelatorio)
      return {
        total: items.length,
        concluidos: items.filter(a => !!a.numRelatorio).length,
        andamento: em.length,
        conduzida: em.filter(a => a.statusConduzida === 'realizado').length,
        loop:      em.filter(a => a.statusLoop      === 'realizado').length,
        anexoB:    em.filter(a => a.statusAnexoB    === 'realizado').length,
        list: em,
      }
    }
    return {
      lampadas:   stats(agenda.filter(a => a.tipo === 'lampada')),
      luminarias: stats(agenda.filter(a => a.tipo === 'luminaria')),
    }
  }, [agenda])

  function SortBtn({ k, label }: { k: typeof sortKey; label: string }) {
    const active = sortKey === k
    return (
      <button type="button"
        onClick={() => {
          if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
          else { setSortKey(k); setSortDir('desc') }
        }}
        className={cn(
          'flex items-center gap-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors',
          active ? 'text-gold' : 'text-white/30 hover:text-white/60',
        )}>
        {label}
        {active ? (sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />) : null}
      </button>
    )
  }

  const buscaResults = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return { agenda: [], relatorios: [] }
    return {
      agenda: agenda.filter(a =>
        [a.protocolo, a.orcamento, a.cliente, a.produto, a.numRelatorio, a.responsavel]
          .some(v => v?.toLowerCase().includes(q))
      ),
      relatorios: relatorios.filter(r =>
        [r.protocolo, r.numRelatorio, r.clienteNome, r.produto, r.cfg?.fabricante]
          .some(v => v?.toLowerCase().includes(q))
      ),
    }
  }, [busca, agenda, relatorios])

  /* ── stat card helper ── */
  function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
      <div className={cn('card p-4 flex flex-col gap-1', color)}>
        <span className="text-2xl font-bold font-mono">{value}</span>
        <span className="text-[10px] uppercase tracking-widest font-mono opacity-60">{label}</span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push('/cispr15')}
          className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> Voltar
        </button>
        <div className="flex-1" />
        <button onClick={() => router.push('/configuracoes')}
          className="w-8 h-8 rounded-xl border border-white/10 text-white/30 hover:text-gold hover:border-gold/30 flex items-center justify-center transition-all">
          <Settings size={14} />
        </button>
      </div>

      <div className="mb-5">
        <p className="text-[11px] text-white/30 font-mono uppercase tracking-widest mb-0.5">LABELO · PUCRS</p>
        <h1 className="text-xl font-bold text-white">Agenda de Execução</h1>
        <p className="text-white/35 text-xs mt-0.5">Acompanhamento de protocolos e ensaios</p>
      </div>

      {/* Aviso rede */}
      {isElectron && fromNetwork === false && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20 text-amber-400 text-xs mb-4">
          <AlertTriangle size={12} className="shrink-0" />
          <span>
            Pasta de rede não configurada — dados salvos apenas neste computador.{' '}
            <button onClick={() => router.push('/configuracoes')} className="underline hover:text-amber-300 transition-colors">
              Configurar agora
            </button>
          </span>
        </div>
      )}
      {isElectron && fromNetwork === true && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal/6 border border-teal/15 text-teal/70 text-[10px] font-mono mb-4">
          <Wifi size={11} className="shrink-0" /> Dados sincronizados via pasta de rede
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/4 border border-white/8 mb-4 w-fit">
        {([
          ['agenda',   'Agenda',    null],
          ['busca',    'Busca',     null],
          ['analise',  'Análise',   <BarChart2 size={11} />],
          ['followup', 'Follow-up', <TrendingUp size={11} />],
        ] as const).map(([t, label, icon]) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold transition-all',
              tab === t ? 'bg-gold/15 border border-gold/25 text-gold' : 'text-white/40 hover:text-white/70',
            )}>
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* ── ABA AGENDA ── */}
      {tab === 'agenda' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/4 border border-white/8">
              {([
                ['andamento',  'Em andamento', counts.andamento],
                ['concluidos', 'Concluídos',   counts.concluidos],
                ['todos',      'Todos',         counts.todos],
              ] as const).map(([f, label, count]) => (
                <button key={f} type="button" onClick={() => setFilter(f)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all',
                    filter === f ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/60',
                  )}>
                  {label}
                  <span className={cn('text-[9px] px-1 rounded-full font-mono', filter === f ? 'text-white/60' : 'text-white/20')}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[160px] max-w-[220px]">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                className="input pl-7 py-1 text-xs w-full"
                placeholder="Protocolo, cliente…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <X size={9} />
                </button>
              )}
            </div>

            {clienteOptions.length > 0 && (
              <select className="input py-1 text-xs max-w-[150px]" value={filterCliente} onChange={e => setFilterCliente(e.target.value)}>
                <option value="">Todos clientes</option>
                {clienteOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            <div className="flex items-center gap-1.5 font-mono ml-1">
              <span className="text-[9px] text-white/20 uppercase">ord</span>
              <SortBtn k="dataEntrada" label="Entrada" />
              <SortBtn k="previsaoSaida" label="Saída" />
              <SortBtn k="protocolo" label="Proto" />
            </div>

            <div className="flex-1" />
            <span className="text-[10px] text-white/25 font-mono">{filteredItems.length} item(s)</span>
            <button type="button" onClick={() => setShowGerarLote(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold/30 bg-gold/8 text-gold hover:bg-gold/14 text-xs font-semibold transition-all">
              <ArrowRight size={11} /> Gerar Lote
            </button>
            <button type="button" onClick={() => setShowLote(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal/30 bg-teal/8 text-teal hover:bg-teal/14 text-xs font-semibold transition-all">
              <Layers size={11} /> Lote
            </button>
            <button type="button" onClick={() => setEditItem(newItem())}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
              <Plus size={11} /> Novo
            </button>
          </div>

          {filter !== 'concluidos' && (
            <div className="flex items-center gap-4 text-[10px] font-mono text-white/25">
              <span className="flex items-center gap-1.5"><span className="w-2 h-3 rounded-sm inline-block" style={{ background: 'rgba(34,197,94,0.45)' }} />Em dia</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-3 rounded-sm inline-block" style={{ background: 'rgba(251,191,36,0.55)' }} />Vence em ≤ 3 dias</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-3 rounded-sm inline-block" style={{ background: 'rgba(239,68,68,0.55)' }} />Vencido</span>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="card p-8 text-center text-white/25 text-sm">
              {agenda.length === 0
                ? <>Nenhum item. Clique em <strong className="text-white/40">Novo</strong> ou <strong className="text-white/40">Lote</strong>.</>
                : 'Nenhum item corresponde aos filtros.'}
            </div>
          ) : (
            <div className="space-y-px">
              {filteredItems.map(item => {
                const isConcluido = !!item.numRelatorio
                const d = daysUntil(item.previsaoSaida)
                const color = deadlineColor(item)
                const itemTags = item.tags ?? []
                return (
                  <div key={item.id}
                    style={{ borderLeftColor: color }}
                    className="flex flex-col px-3 py-1.5 rounded-lg bg-white/[0.025] border border-white/[0.07] border-l-2 hover:bg-white/[0.04] transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      {/* tipo */}
                      <div className={cn('shrink-0', item.tipo === 'lampada' ? 'text-yellow-400/60' : 'text-blue-400/60')}>
                        {item.tipo === 'lampada' ? <Lightbulb size={11} /> : <Lamp size={11} />}
                      </div>

                      {/* protocolo */}
                      <span className="font-mono font-bold text-white text-xs w-[100px] shrink-0 truncate">
                        {item.protocolo || '—'}
                      </span>

                      {/* orcamento */}
                      {item.orcamento
                        ? <span className="text-[9px] text-white/22 font-mono w-14 shrink-0 truncate">{item.orcamento}</span>
                        : <span className="w-14 shrink-0" />
                      }

                      {/* cliente · produto */}
                      <span className="flex-1 text-white/50 text-xs truncate min-w-0">
                        {item.cliente || '—'}{item.produto ? ` · ${item.produto}` : ''}
                      </span>

                      {/* datas */}
                      <div className="hidden md:flex items-center gap-1 text-[10px] font-mono shrink-0">
                        <span className="text-white/22">{fmtDate(item.dataEntrada)}</span>
                        <span className="text-white/12">→</span>
                        <span className={cn(
                          !isConcluido && d < 0  ? 'text-red-400/80' :
                          !isConcluido && d <= 3 ? 'text-amber-400/80' : 'text-white/22',
                        )}>
                          {fmtDate(item.previsaoSaida)}
                        </span>
                      </div>

                      {/* concluído: numRelatorio link | andamento: badges C/L/B */}
                      {isConcluido ? (
                        <div className="shrink-0">
                          {item.pdfPath ? (
                            <button type="button" onClick={() => openPDF(item.pdfPath!)}
                              title="Abrir PDF do relatório"
                              className="flex items-center gap-1 text-[10px] font-mono text-teal hover:text-teal/70 bg-teal/8 border border-teal/20 px-2 py-0.5 rounded transition-all">
                              <Link2 size={8} /> {item.numRelatorio}
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-mono text-green-400/75 bg-green/8 border border-green/15 px-2 py-0.5 rounded">
                              <FileText size={8} /> {item.numRelatorio}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-0.5 shrink-0">
                          {(['statusConduzida', 'statusLoop', 'statusAnexoB'] as const).map((k, i) => (
                            <button key={k} type="button" onClick={() => toggleStatus(item.id, k)}
                              title={['Conduzida', 'Loop', 'Anexo B'][i]}
                              className={cn(
                                'w-5 h-5 rounded border text-[9px] font-bold flex items-center justify-center transition-all',
                                item[k] === 'realizado'
                                  ? 'border-green/30 bg-green/10 text-green-400'
                                  : 'border-white/10 text-white/22 hover:border-white/25 hover:text-white/50',
                              )}>
                              {['C', 'L', 'B'][i]}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* ações hover */}
                      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isConcluido && (
                          <button type="button" onClick={() => openPdfCopy(item)}
                            title="Abrir PDF do relatório"
                            className="w-6 h-6 rounded border border-white/8 text-white/28 hover:text-teal hover:border-teal/30 flex items-center justify-center transition-all">
                            <FileSearch size={10} />
                          </button>
                        )}
                        {isConcluido && (
                          <button type="button" onClick={() => retornarParaAndamento(item.id)}
                            title="Retornar para andamento"
                            className="w-6 h-6 rounded border border-white/8 text-white/28 hover:text-amber-400 hover:border-amber-400/30 flex items-center justify-center transition-all">
                            <RotateCcw size={10} />
                          </button>
                        )}
                        <button type="button" onClick={() => irParaProtocolo(item)}
                          title="Gerar protocolo"
                          className="w-6 h-6 rounded border border-white/8 text-white/28 hover:text-teal hover:border-teal/30 flex items-center justify-center transition-all">
                          <FileText size={10} />
                        </button>
                        <button type="button" onClick={() => setEditItem(item)}
                          className="w-6 h-6 rounded border border-white/8 text-white/28 hover:text-white/70 hover:border-white/20 flex items-center justify-center transition-all">
                          <Edit2 size={10} />
                        </button>
                        <button type="button" onClick={() => handleDelete(item.id)}
                          className="w-6 h-6 rounded border border-white/8 text-white/28 hover:text-red-400 hover:border-red-400/30 flex items-center justify-center transition-all">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>

                    {/* tags */}
                    {itemTags.length > 0 && (
                      <div className="flex gap-1 mt-1 ml-5 flex-wrap">
                        {itemTags.map(t => <TagChip key={t} id={t} small />)}
                        {item.observacoes && (
                          <span className="text-[9px] text-white/22 italic ml-1 truncate max-w-xs">{item.observacoes}</span>
                        )}
                      </div>
                    )}
                    {/* observação sem tags */}
                    {itemTags.length === 0 && item.observacoes && (
                      <p className="text-[9px] text-white/22 italic mt-0.5 ml-5 truncate">{item.observacoes}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA BUSCA ── */}
      {tab === 'busca' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              className="input pl-9 text-sm"
              placeholder="Protocolo, orçamento, cliente, produto, nº relatório…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              autoFocus
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          {!busca && <p className="text-center text-white/25 text-sm py-10">Digite para buscar na agenda e nos relatórios emitidos.</p>}
          {busca && buscaResults.agenda.length === 0 && buscaResults.relatorios.length === 0 && (
            <p className="text-center text-white/25 text-sm py-10">Nenhum resultado para <strong className="text-white/40">"{busca}"</strong>.</p>
          )}

          {buscaResults.agenda.length > 0 && (
            <div className="space-y-px">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-1">Agenda ({buscaResults.agenda.length})</p>
              {buscaResults.agenda.map(item => (
                <div key={item.id}
                  style={{ borderLeftColor: deadlineColor(item) }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.025] border border-white/[0.07] border-l-2 cursor-pointer hover:bg-white/[0.04] transition-all"
                  onClick={() => { setEditItem(item); setTab('agenda') }}>
                  <div className={cn('shrink-0', item.tipo === 'lampada' ? 'text-yellow-400/60' : 'text-blue-400/60')}>
                    {item.tipo === 'lampada' ? <Lightbulb size={11} /> : <Lamp size={11} />}
                  </div>
                  <span className="font-bold text-white text-xs font-mono w-[100px] shrink-0">{item.protocolo || '—'}</span>
                  <span className="flex-1 text-white/50 text-xs truncate min-w-0">{item.cliente || '—'}{item.produto ? ` · ${item.produto}` : ''}</span>
                  {item.numRelatorio && <span className="text-[10px] text-green-400/75 font-mono shrink-0">{item.numRelatorio}</span>}
                  <div className="flex gap-1 shrink-0">
                    {(item.tags ?? []).slice(0, 2).map(t => <TagChip key={t} id={t} small />)}
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    {(['statusConduzida', 'statusLoop', 'statusAnexoB'] as const).map((k, i) => (
                      <span key={k} className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center text-[8px] font-bold',
                        item[k] === 'realizado' ? 'border-green/25 bg-green/8 text-green-400' : 'border-white/8 text-white/18',
                      )}>
                        {['C', 'L', 'B'][i]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {buscaResults.relatorios.length > 0 && (
            <div className="space-y-px">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-1">Relatórios Emitidos ({buscaResults.relatorios.length})</p>
              {buscaResults.relatorios.map(rel => (
                <div key={rel.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.025] border border-white/[0.07]">
                  <FileText size={11} className="text-teal/60 shrink-0" />
                  <span className="font-bold text-white text-xs font-mono w-[100px] shrink-0">{rel.numRelatorio || '—'}</span>
                  <span className="flex-1 text-white/50 text-xs truncate min-w-0">{rel.clienteNome} · {rel.produto}</span>
                  <span className="text-[10px] text-white/25 font-mono shrink-0">{fmtDate(rel.dataEmissao)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA ANÁLISE ── */}
      {tab === 'analise' && (
        <div className="space-y-6">

          {/* cards de resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="card p-4 flex flex-col gap-1">
              <span className="text-2xl font-bold font-mono text-white">{analytics.total}</span>
              <span className="text-[10px] uppercase tracking-widest font-mono text-white/35">Total</span>
            </div>
            <div className="card p-4 flex flex-col gap-1">
              <span className="text-2xl font-bold font-mono text-white/70">{analytics.andamento}</span>
              <span className="text-[10px] uppercase tracking-widest font-mono text-white/35">Em andamento</span>
            </div>
            <div className="card p-4 flex flex-col gap-1 border-green/15">
              <span className="text-2xl font-bold font-mono text-green-400">{analytics.concluidos}</span>
              <span className="text-[10px] uppercase tracking-widest font-mono text-white/35">Concluídos</span>
            </div>
            <div className="card p-4 flex flex-col gap-1 border-amber-400/20">
              <span className="text-2xl font-bold font-mono text-amber-400">{analytics.urgentes}</span>
              <span className="text-[10px] uppercase tracking-widest font-mono text-white/35">Vence em 3 dias</span>
            </div>
            <div className="card p-4 flex flex-col gap-1 border-red-500/20">
              <span className="text-2xl font-bold font-mono text-red-400">{analytics.vencidos}</span>
              <span className="text-[10px] uppercase tracking-widest font-mono text-white/35">Vencidos</span>
            </div>
          </div>

          {/* Distribuição de status */}
          {analytics.andamento > 0 && (
            <div className="card p-4 space-y-3">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Distribuição — Em andamento</p>
              {[
                { label: 'Em dia',      value: analytics.emDia,    bg: 'rgba(34,197,94,0.5)' },
                { label: 'Urgente (≤3d)', value: analytics.urgentes, bg: 'rgba(251,191,36,0.55)' },
                { label: 'Vencido',     value: analytics.vencidos,  bg: 'rgba(239,68,68,0.55)' },
              ].map(({ label, value, bg }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[11px] text-white/40 font-mono w-28 shrink-0 text-right">{label}</span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${analytics.andamento > 0 ? (value / analytics.andamento) * 100 : 0}%`, background: bg }} />
                  </div>
                  <span className="text-[11px] font-mono text-white/50 w-5 text-right">{value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Entradas por mês */}
            <div className="card p-4 space-y-3">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Entradas por mês (últimos 6)</p>
              <div className="space-y-2">
                {analytics.months.map(m => (
                  <div key={m.key} className="flex items-center gap-3">
                    <span className="text-[10px] text-white/35 font-mono w-12 shrink-0 text-right">{m.label}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gold/50 transition-all duration-500"
                        style={{ width: `${(m.count / analytics.maxMonth) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-white/40 w-5 text-right">{m.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top clientes */}
            {analytics.topClientes.length > 0 && (
              <div className="card p-4 space-y-3">
                <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Top Clientes</p>
                <div className="space-y-2">
                  {analytics.topClientes.map(([cliente, count]) => (
                    <div key={cliente} className="flex items-center gap-3">
                      <span className="text-[10px] text-white/45 truncate flex-1">{cliente}</span>
                      <div className="w-24 h-2.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-teal/50 transition-all duration-500"
                          style={{ width: `${(count / (analytics.topClientes[0]?.[1] ?? 1)) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-white/40 w-5 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Atenção: vencidos + urgentes */}
          {(analytics.vencidosList.length > 0 || analytics.urgentesList.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {analytics.vencidosList.length > 0 && (
                <div className="card p-4 space-y-2 border-red-500/20">
                  <p className="text-[10px] text-red-400/70 font-mono uppercase tracking-widest flex items-center gap-1.5">
                    <AlertTriangle size={10} /> Vencidos ({analytics.vencidosList.length})
                  </p>
                  {analytics.vencidosList.map(item => (
                    <div key={item.id} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => { setEditItem(item); setTab('agenda') }}>
                      <span className="font-mono text-xs text-white/70">{item.protocolo || '—'}</span>
                      <span className="text-[10px] text-white/35 truncate flex-1">{item.cliente}</span>
                      <span className="text-[10px] text-red-400 font-mono shrink-0">{fmtDate(item.previsaoSaida)}</span>
                    </div>
                  ))}
                </div>
              )}
              {analytics.urgentesList.length > 0 && (
                <div className="card p-4 space-y-2 border-amber-400/20">
                  <p className="text-[10px] text-amber-400/70 font-mono uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={10} /> Vence em ≤ 3 dias ({analytics.urgentesList.length})
                  </p>
                  {analytics.urgentesList.map(item => (
                    <div key={item.id} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => { setEditItem(item); setTab('agenda') }}>
                      <span className="font-mono text-xs text-white/70">{item.protocolo || '—'}</span>
                      <span className="text-[10px] text-white/35 truncate flex-1">{item.cliente}</span>
                      <span className="text-[10px] text-amber-400 font-mono shrink-0">{fmtDate(item.previsaoSaida)} ({daysUntil(item.previsaoSaida)}d)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tags usadas */}
          {Object.keys(analytics.tagMap).length > 0 && (
            <div className="card p-4 space-y-3">
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Marcadores em uso</p>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_TAGS.filter(t => analytics.tagMap[t.id] > 0).map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    <TagChip id={t.id} />
                    <span className="text-[11px] text-white/40 font-mono">{analytics.tagMap[t.id]}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analytics.total === 0 && (
            <div className="card p-10 text-center text-white/25 text-sm">
              Nenhum dado na agenda para analisar.
            </div>
          )}
        </div>
      )}

      {/* ── ABA FOLLOW-UP ── */}
      {tab === 'followup' && (() => {
        const allEmBase = [...followup.lampadas.list, ...followup.luminarias.list]
          .sort((a, b) => (a.previsaoSaida || '').localeCompare(b.previsaoSaida || ''))

        const clientesEm = Array.from(new Set(allEmBase.map(a => a.cliente).filter(Boolean))).sort()

        const allEm = allEmBase
          .filter(a => fuTipo === 'todos' || a.tipo === fuTipo)
          .filter(a => !fuCliente || a.cliente === fuCliente)
          .filter(a => {
            if (fuEnsaio === 'c_pend')    return a.statusConduzida === 'pendente'
            if (fuEnsaio === 'l_pend')    return a.statusLoop      === 'pendente'
            if (fuEnsaio === 'b_pend')    return a.statusAnexoB    === 'pendente'
            if (fuEnsaio === 'algum_pend') return a.statusConduzida === 'pendente' || a.statusLoop === 'pendente' || a.statusAnexoB === 'pendente'
            if (fuEnsaio === 'todos_ok')  return a.statusConduzida === 'realizado' && a.statusLoop === 'realizado' && a.statusAnexoB === 'realizado'
            return true
          })

        const dateLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

        function handlePrint() {
          const style = document.createElement('style')
          style.id = '__fu_print'
          style.textContent = `
            @media print {
              body { background: #fff !important; color: #111 !important; font-family: Arial, sans-serif; }
              nav, header, [data-noprint], .no-print { display: none !important; }
              #fu-print-area { display: block !important; color: #111 !important; }
              #fu-print-area * { color: inherit !important; border-color: #ccc !important; background: transparent !important; }
              #fu-print-area table { border-collapse: collapse; width: 100%; }
              #fu-print-area th, #fu-print-area td { border: 1px solid #ccc; padding: 4px 8px; font-size: 11px; }
              #fu-print-area th { background: #eee !important; font-weight: bold; }
              #fu-print-area .bar-bg { background: #e5e7eb !important; }
              #fu-print-area .bar-fill { background: #16a34a !important; }
            }
          `
          document.head.appendChild(style)
          window.print()
          window.addEventListener('afterprint', () => document.getElementById('__fu_print')?.remove(), { once: true })
        }

        function EnsaioBar({ done, total, label }: { done: number; total: number; label: string }) {
          const pct = total > 0 ? (done / total) * 100 : 0
          const all = done === total && total > 0
          return (
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40 font-mono w-20 text-right shrink-0">{label}</span>
              <div className="bar-bg flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                <div className="bar-fill h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: all ? 'rgba(74,222,128,0.7)' : 'rgba(74,222,128,0.45)' }} />
              </div>
              <span className={cn('text-[11px] font-mono w-10 text-right shrink-0', all ? 'text-green-400' : 'text-white/40')}>
                {done}/{total}
              </span>
            </div>
          )
        }

        function TypeCard({ label, icon, stats }: { label: string; icon: React.ReactNode; stats: typeof followup.lampadas }) {
          return (
            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">{icon}<span className="text-sm font-bold text-white">{label}</span></div>
                <div className="flex gap-3 text-[11px] font-mono">
                  <span className="text-white/35">{stats.total} total</span>
                  <span className="text-gold/80">{stats.andamento} andamento</span>
                  <span className="text-green-400">{stats.concluidos} concluídos</span>
                </div>
              </div>
              {stats.andamento > 0 ? (
                <div className="space-y-2">
                  <EnsaioBar label="Conduzida" done={stats.conduzida} total={stats.andamento} />
                  <EnsaioBar label="Loop"      done={stats.loop}      total={stats.andamento} />
                  <EnsaioBar label="Anexo B"   done={stats.anexoB}    total={stats.andamento} />
                </div>
              ) : (
                <p className="text-[11px] text-white/25 text-center py-3">Nenhum em andamento</p>
              )}
            </div>
          )
        }

        return (
          <div id="fu-print-area" className="space-y-5">
            {/* Cabeçalho + ações */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-gold" /> Situação dos Ensaios — Follow-up Comercial
                </p>
                <p className="text-[10px] text-white/30 font-mono mt-0.5">{dateLabel}</p>
              </div>
              <button data-noprint type="button" onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8 text-xs font-semibold transition-all">
                <Printer size={12} /> Imprimir
              </button>
            </div>

            {/* Cards por tipo — sempre mostram totais globais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TypeCard label="Lâmpadas"  icon={<Lightbulb size={15} className="text-amber-400" />} stats={followup.lampadas} />
              <TypeCard label="Luminárias" icon={<Lamp size={15} className="text-teal-400" />}      stats={followup.luminarias} />
            </div>

            {/* Filtros */}
            {allEmBase.length > 0 && (
              <div data-noprint className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest shrink-0">Filtrar:</span>

                {/* Filtro tipo */}
                <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/4 border border-white/8">
                  {([['todos','Todos'],['lampada','Lâmpadas'],['luminaria','Luminárias']] as const).map(([v, lbl]) => (
                    <button key={v} type="button" onClick={() => setFuTipo(v)}
                      className={cn('px-2.5 py-1 rounded text-[10px] font-semibold transition-all',
                        fuTipo === v ? 'bg-gold/15 border border-gold/25 text-gold' : 'text-white/35 hover:text-white/60')}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {/* Filtro cliente */}
                <select value={fuCliente} onChange={e => setFuCliente(e.target.value)}
                  className="input text-xs py-1 pr-6 h-7 min-w-0 w-auto max-w-[180px]">
                  <option value="">Todos os clientes</option>
                  {clientesEm.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {/* Filtro ensaio */}
                <select value={fuEnsaio} onChange={e => setFuEnsaio(e.target.value as typeof fuEnsaio)}
                  className="input text-xs py-1 pr-6 h-7 min-w-0 w-auto max-w-[200px]">
                  <option value="todos">Todos os ensaios</option>
                  <option value="c_pend">Conduzida pendente</option>
                  <option value="l_pend">Loop pendente</option>
                  <option value="b_pend">Anexo B pendente</option>
                  <option value="algum_pend">Algum ensaio pendente</option>
                  <option value="todos_ok">Todos realizados</option>
                </select>

                {(fuCliente || fuTipo !== 'todos' || fuEnsaio !== 'todos') && (
                  <button type="button" onClick={() => { setFuCliente(''); setFuTipo('todos'); setFuEnsaio('todos') }}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors">
                    <X size={10} /> Limpar filtros
                  </button>
                )}

                <span className="text-[10px] text-white/25 font-mono ml-auto">
                  {allEm.length} de {allEmBase.length} itens
                </span>
              </div>
            )}

            {/* Tabela detalhada */}
            {allEm.length > 0 ? (
              <div className="card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/6 flex items-center justify-between">
                  <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">
                    Em andamento — {allEm.length} {allEm.length === 1 ? 'item' : 'itens'}
                  </p>
                  <div className="flex items-center gap-3 text-[9px] text-white/25 font-mono uppercase">
                    <span className="flex items-center gap-1"><CheckCircle2 size={9} className="text-green-400" /> Realizado</span>
                    <span>○ Pendente</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['', 'Protocolo', 'Cliente', 'Produto', 'Conduzida', 'Loop', 'Anexo B', 'Previsão'].map(h => (
                          <th key={h} className={cn(
                            'py-2 px-3 text-[10px] text-white/25 font-mono font-normal',
                            ['Conduzida','Loop','Anexo B'].includes(h) ? 'text-center' : h === 'Previsão' ? 'text-right' : 'text-left',
                          )}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allEm.map((item, i) => {
                        const d = daysUntil(item.previsaoSaida)
                        const prazoColor = d < 0 ? 'text-red-400' : d <= 3 ? 'text-amber-400' : 'text-white/35'
                        return (
                          <tr key={item.id}
                            className={cn('border-b border-white/4 hover:bg-white/3 cursor-pointer transition-colors', i % 2 === 1 && 'bg-white/1')}
                            onClick={() => { setEditItem(item); setTab('agenda') }}>
                            <td className="px-3 py-2">
                              {item.tipo === 'lampada'
                                ? <Lightbulb size={11} className="text-amber-400/70" />
                                : <Lamp      size={11} className="text-teal-400/70" />}
                            </td>
                            <td className="px-3 py-2 font-mono text-white/70 whitespace-nowrap">{item.protocolo || '—'}</td>
                            <td className="px-3 py-2 text-white/50 max-w-[130px] truncate">{item.cliente || '—'}</td>
                            <td className="px-3 py-2 text-white/40 max-w-[130px] truncate">{item.produto || '—'}</td>
                            {([
                              item.statusConduzida,
                              item.statusLoop,
                              item.statusAnexoB,
                            ] as const).map((s, j) => (
                              <td key={j} className="px-3 py-2 text-center">
                                {s === 'realizado'
                                  ? <CheckCircle2 size={12} className="text-green-400 mx-auto" />
                                  : <span className="text-white/20 font-mono leading-none">○</span>}
                              </td>
                            ))}
                            <td className={cn('px-3 py-2 text-right font-mono text-[11px] whitespace-nowrap', prazoColor)}>
                              {fmtDate(item.previsaoSaida)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card p-8 text-center text-white/25 text-sm">
                {allEmBase.length === 0 ? 'Nenhum item em andamento no momento.' : 'Nenhum item corresponde aos filtros aplicados.'}
              </div>
            )}
          </div>
        )
      })()}

      {editItem && <ItemModal item={editItem} onSave={handleSave} onClose={() => setEditItem(null)} clientes={clientes} />}
      {showLote && <LoteModal onSave={handleSaveLote} onClose={() => setShowLote(false)} clientes={clientes} />}
      {showGerarLote && (
        <GerarLoteModal
          agenda={agenda}
          onConfirm={itens => { setShowGerarLote(false); confirmarGerarLote(itens) }}
          onClose={() => setShowGerarLote(false)}
        />
      )}
    </div>
  )
}
