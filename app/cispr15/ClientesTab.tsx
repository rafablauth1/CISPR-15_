'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Check, X, UserCheck, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ClienteDB, CLIENTES_KEY } from './types'

function emptyCliente(): ClienteDB {
  return { id: Date.now().toString(), nome: '', rua: '', cidade: '', cep: '', cnpj: '' }
}

function Field({ label, value, onChange, placeholder, span2 }: {
  label: string; value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string; span2?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', span2 && 'col-span-2')}>
      <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono">{label}</label>
      <input className="input text-sm" value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  )
}

export function ClientesTab({ onUsar }: { onUsar: (c: ClienteDB) => void }) {
  const [clientes,    setClientes]    = useState<ClienteDB[]>([])
  const [fromNetwork, setFromNetwork] = useState(false)
  const [editando,    setEditando]    = useState<string | null>(null)
  const [adding,      setAdding]      = useState(false)
  const [draft,       setDraft]       = useState<ClienteDB>(emptyCliente())
  const [busca,       setBusca]       = useState('')
  const isElectron = useRef(false)

  useEffect(() => {
    async function load() {
      const api = (window as any).electronAPI
      if (api) {
        isElectron.current = true
        try {
          const res = await api.getClientes()
          if (res.ok && res.fromNetwork && Array.isArray(res.clientes)) {
            setClientes(res.clientes)
            setFromNetwork(true)
            return
          }
        } catch {}
      }
      // fallback localStorage
      try {
        const raw = localStorage.getItem(CLIENTES_KEY)
        if (raw) setClientes(JSON.parse(raw))
      } catch {}
    }
    load()
  }, [])

  async function persist(list: ClienteDB[]) {
    setClientes(list)
    localStorage.setItem(CLIENTES_KEY, JSON.stringify(list))
    const api = (window as any).electronAPI
    if (api && fromNetwork) {
      try { await api.saveClientes(list) } catch {}
    }
  }

  function startAdd() { setDraft(emptyCliente()); setAdding(true); setEditando(null) }
  function startEdit(c: ClienteDB) { setDraft({ ...c }); setEditando(c.id); setAdding(false) }
  function cancelForm() { setAdding(false); setEditando(null) }

  async function confirmSave() {
    if (!draft.nome.trim()) return
    if (adding) {
      await persist([...clientes, { ...draft, id: Date.now().toString() }])
    } else if (editando) {
      await persist(clientes.map(c => c.id === editando ? draft : c))
    }
    cancelForm()
  }

  async function remove(id: string) {
    if (!confirm('Remover este cliente?')) return
    await persist(clientes.filter(c => c.id !== id))
    if (editando === id) cancelForm()
  }

  const sd = (k: keyof ClienteDB) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft(prev => ({ ...prev, [k]: e.target.value }))

  const filtrados = busca.trim()
    ? clientes.filter(c =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj.includes(busca) ||
        c.cidade.toLowerCase().includes(busca.toLowerCase())
      )
    : clientes

  return (
    <div className="space-y-4">

      {/* Indicador de fonte */}
      <div className={cn(
        'flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg w-fit',
        fromNetwork
          ? 'text-teal/70 bg-teal/6 border border-teal/15'
          : 'text-white/25 bg-white/3 border border-white/8'
      )}>
        {fromNetwork ? <Wifi size={10} /> : <WifiOff size={10} />}
        {fromNetwork ? 'Dados da rede compartilhada' : 'Dados locais (configure a pasta de rede em Configurações)'}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <input
          className="input text-sm flex-1"
          placeholder="Buscar por nome, CNPJ ou cidade…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <button type="button" onClick={startAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold/10 border border-gold/20 text-gold text-xs font-semibold hover:bg-gold/20 transition-all shrink-0">
          <Plus size={12} /> Novo
        </button>
      </div>

      {/* Formulário adicionar/editar */}
      {(adding || editando !== null) && (
        <div className="card p-4 space-y-3 border-gold/20 bg-gold/2">
          <p className="text-[10px] font-mono text-gold/60 uppercase tracking-wider">
            {adding ? 'Novo cliente' : 'Editar cliente'}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Nome / Razão Social" value={draft.nome} onChange={sd('nome')}
              placeholder="Ex: CEB Iluminação Pública" span2 />
            <Field label="CNPJ" value={draft.cnpj} onChange={sd('cnpj')}
              placeholder="Ex: 00.000.000/0001-00" span2 />
            <Field label="Rua – Número – Bairro" value={draft.rua} onChange={sd('rua')}
              placeholder="Ex: SGAN Quadra 601, Bloco H, Asa Norte" span2 />
            <Field label="Cidade – Estado" value={draft.cidade} onChange={sd('cidade')}
              placeholder="Ex: Brasília - DF" />
            <Field label="CEP" value={draft.cep} onChange={sd('cep')}
              placeholder="Ex: 70.830-010" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={confirmSave} disabled={!draft.nome.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green/10 border border-green/20 text-green-400 text-xs font-semibold hover:bg-green/20 disabled:opacity-30 transition-all">
              <Check size={12} /> Salvar
            </button>
            <button type="button" onClick={cancelForm}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs hover:border-white/20 transition-all">
              <X size={12} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-white/20 text-sm">
          {busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente salvo ainda.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => (
            <div key={c.id}
              className={cn(
                'card px-4 py-3 flex items-start gap-4 transition-opacity',
                editando === c.id && 'opacity-30 pointer-events-none'
              )}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{c.nome}</p>
                {c.cnpj && (
                  <p className="text-[11px] font-mono text-white/30 mt-0.5">{c.cnpj}</p>
                )}
                {c.rua && (
                  <p className="text-[11px] text-white/40 mt-1 truncate">{c.rua}</p>
                )}
                {(c.cidade || c.cep) && (
                  <p className="text-[11px] text-white/40">
                    {[c.cidade, c.cep].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                <button type="button" onClick={() => onUsar(c)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal/8 border border-teal/20 text-teal text-[11px] font-semibold hover:bg-teal/15 transition-all">
                  <UserCheck size={11} /> Usar
                </button>
                <button type="button" onClick={() => startEdit(c)}
                  className="w-7 h-7 rounded-lg border border-white/10 text-white/30 hover:text-gold hover:border-gold/30 flex items-center justify-center transition-all">
                  <Pencil size={11} />
                </button>
                <button type="button" onClick={() => remove(c.id)}
                  className="w-7 h-7 rounded-lg border border-white/10 text-white/30 hover:text-red-400 hover:border-red/30 flex items-center justify-center transition-all">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
