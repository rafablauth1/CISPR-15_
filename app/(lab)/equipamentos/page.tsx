'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight, Zap, Gauge, Waves, Radio, SlidersHorizontal, Thermometer, FolderInput, Loader2, CheckCircle2, AlertTriangle, XCircle, ArrowUpDown, ArrowUp, ArrowDown, FileWarning, X, Search } from 'lucide-react'
import { FilterDropdown } from '@/components/FilterDropdown'
import { fmt } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { EquipamentoEMC, GrupoId } from '@/lib/equipamentos/tipos'
import { GRUPO_CORES } from '@/lib/grupos-icons'
import type { Taxonomia } from '@/lib/taxonomia/tipos'
import { siglaDaTag } from '@/lib/taxonomia/tipos'

interface Grupo {
  id: GrupoId
  nome: string
  cor: string
  subgrupos: { id: string; nome: string; numero: string }[]
}

interface RelatorioImport {
  total: number
  sucessos: string[]
  atualizados: string[]
  pulados: { tag: string; motivo: string }[]
  erros: { folder: string; motivo: string }[]
}
interface RascunhoItem { tag: string; folder: string; motivo: string; certPath?: string; em: string }

interface ScanResult {
  ok: boolean
  error?: string
  resultados?: { folder: string; certPath: string | null; text?: string; items?: unknown[]; error?: string }[]
}
type LabAPI = { scanCertificados?: (p: string) => Promise<ScanResult>; browseFolder?: (t: string) => Promise<{ canceled?: boolean; folderPath?: string }> }

const ICONES: Record<string, React.ElementType> = {
  'geradores':            Zap,
  'medidores':            Gauge,
  'redes-impedancia':     Waves,
  'antenas':              Radio,
  'atenuacao':            SlidersHorizontal,
  'grandezas-ambientais': Thermometer,
}

type SortKey = 'tag' | 'nome' | 'grupo' | 'sub' | 'prox' | 'status'
const FILTROS_KEY = 'equip_filtros_v1'

function StatusPill({ status }: { status: string }) {
  if (status === 'ativo')    return <span className="badge-success">Ativo</span>
  if (status === 'calibrar') return <span className="badge-warning">Calibrar</span>
  return <span className="badge-danger">Fora</span>
}

// Campos que faltam no cadastro (marca pendência na lista).
function pendenciasEquip(e: EquipamentoEMC): string[] {
  const p: string[] = []
  if (!e.fabricante)         p.push('fabricante')
  if (!e.modelo)             p.push('modelo')
  if (!e.serie)              p.push('série')
  if (!e.ultimaCalibracao)   p.push('última calibração')
  if (!e.proximaCalibracao)  p.push('próxima calibração')
  if (!e.grandezas?.length)  p.push('grandezas')
  return p
}

export default function EquipamentosPage() {
  const [equips, setEquips] = useState<EquipamentoEMC[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [tax, setTax] = useState<Taxonomia>({ areas: [], siglas: [], tipos: [] })

  // Filtros MÚLTIPLOS (combináveis) + ordenação — persistidos entre navegações.
  const [fAreas,  setFAreas]  = useState<string[]>([])
  const [fSiglas, setFSiglas] = useState<string[]>([])
  const [fGrupos, setFGrupos] = useState<string[]>([])
  const [fSubs,   setFSubs]   = useState<string[]>([])
  const [busca,   setBusca]   = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('tag')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [soPendentes, setSoPendentes] = useState(false)
  const [pronto,  setPronto]  = useState(false)

  // Importação em lote
  const [impProgresso, setImpProgresso] = useState<string | null>(null)
  const [impRelatorio, setImpRelatorio] = useState<RelatorioImport | null>(null)
  const [rascunho, setRascunho] = useState<RascunhoItem[]>([])
  const [verRascunho, setVerRascunho] = useState(false)

  // Carrega filtros salvos (1×, no mount)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTROS_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        setFAreas(s.fAreas ?? [])
        setFSiglas(s.fSiglas ?? []); setFGrupos(s.fGrupos ?? []); setFSubs(s.fSubs ?? [])
        setSoPendentes(!!s.soPendentes)
        if (s.sortKey) setSortKey(s.sortKey); if (s.sortDir) setSortDir(s.sortDir)
      }
    } catch {}
    setPronto(true)
  }, [])

  // Salva filtros sempre que mudam (após o carregamento inicial)
  useEffect(() => {
    if (!pronto) return
    try { localStorage.setItem(FILTROS_KEY, JSON.stringify({ fAreas, fSiglas, fGrupos, fSubs, sortKey, sortDir, soPendentes })) } catch {}
  }, [pronto, fAreas, fSiglas, fGrupos, fSubs, sortKey, sortDir, soPendentes])

  function carregarRascunho() {
    fetch('/api/equipamentos/importar-lote').then(r => r.json()).then(d => setRascunho(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/equipamentos').then(r => r.json()),
      fetch('/api/grupos').then(r => r.json()),
      fetch('/api/taxonomia').then(r => r.json()),
    ]).then(([e, g, t]) => {
      setEquips(Array.isArray(e) ? e : [])
      setGrupos(Array.isArray(g) ? g : [])
      if (t && !t.error) setTax({ areas: t.areas ?? [], siglas: t.siglas ?? [], tipos: t.tipos ?? [] })
    }).catch(() => {})
    carregarRascunho()
  }, [])

  async function importarPastaMae() {
    const api = (window as unknown as { electronAPI?: LabAPI }).electronAPI
    if (!api?.scanCertificados || !api?.browseFolder) { alert('Disponível apenas no aplicativo (Electron).'); return }
    const sel = await api.browseFolder('Pasta-mãe — uma subpasta por TAG, cada uma com o …Certificado.pdf')
    if (!sel || sel.canceled || !sel.folderPath) return
    try {
      setImpProgresso('Lendo os certificados das pastas…')
      const scan = await api.scanCertificados(sel.folderPath)
      if (!scan.ok || !scan.resultados) { setImpProgresso(null); alert(scan.error || 'Falha ao ler a pasta-mãe.'); return }
      setImpProgresso(`Cadastrando ${scan.resultados.length} TAG(s)…`)
      const r = await fetch('/api/equipamentos/importar-lote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: scan.resultados }),
      })
      const rel = await r.json()
      if (!r.ok) { setImpProgresso(null); alert(rel.error || 'Falha na importação.'); return }
      setImpRelatorio(rel as RelatorioImport)
      fetch('/api/equipamentos').then(x => x.json()).then(e => setEquips(Array.isArray(e) ? e : [])).catch(() => {})
      carregarRascunho()
    } catch (e) { alert('Erro: ' + String(e)) }
    finally { setImpProgresso(null) }
  }

  const temFiltro = fAreas.length + fSiglas.length + fGrupos.length + fSubs.length > 0 || soPendentes || !!busca.trim()
  const limpar = () => { setFAreas([]); setFSiglas([]); setFGrupos([]); setFSubs([]); setSoPendentes(false); setBusca('') }
  const totalPendentes = equips.filter(e => pendenciasEquip(e).length > 0).length

  // Área de um equipamento = área da sigla da sua TAG (via taxonomia)
  const areaDoEquip = (e: EquipamentoEMC) =>
    tax.siglas.find(x => x.sigla === siglaDaTag(e.tag))?.areaId ?? ''
  // Áreas presentes (com pelo menos 1 equipamento)
  const areasPresentes = (() => {
    const cont = new Map<string, number>()
    for (const e of equips) { const a = areaDoEquip(e); if (a) cont.set(a, (cont.get(a) ?? 0) + 1) }
    return tax.areas.filter(a => cont.has(a.id)).map(a => ({ id: a.id, nome: a.nome, n: cont.get(a.id)!, cor: GRUPO_CORES[a.cor] ?? '#94A3B8' }))
  })()

  function clicarSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  // Siglas presentes nas TAGs + significado/área da taxonomia
  const siglasPresentes = (() => {
    const cont = new Map<string, number>()
    for (const e of equips) { const s = siglaDaTag(e.tag); if (s) cont.set(s, (cont.get(s) ?? 0) + 1) }
    return [...cont.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([sigla, n]) => {
      const def = tax.siglas.find(x => x.sigla === sigla)
      const area = def ? tax.areas.find(a => a.id === def.areaId) : undefined
      return { sigla, n, significado: def?.significado, cor: area ? GRUPO_CORES[area.cor] : '#94A3B8' }
    })
  })()

  // Aplica filtros (AND entre dimensões, OR dentro de cada uma) + ordenação
  const grupoNome = (id: string) => grupos.find(g => g.id === id)?.nome ?? id
  const equipsFiltrados = (() => {
    const q = busca.trim().toLowerCase()
    let lista = equips.filter(e =>
      (fAreas.length  === 0 || fAreas.includes(areaDoEquip(e))) &&
      (fSiglas.length === 0 || fSiglas.includes(siglaDaTag(e.tag))) &&
      (fGrupos.length === 0 || fGrupos.includes(e.grupoId)) &&
      (fSubs.length   === 0 || fSubs.includes(e.subgrupoId)) &&
      (!soPendentes || pendenciasEquip(e).length > 0) &&
      (!q || e.tag.toLowerCase().includes(q) || e.nome.toLowerCase().includes(q)),
    )
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (e: EquipamentoEMC): string =>
      sortKey === 'tag'   ? e.tag :
      sortKey === 'nome'  ? e.nome :
      sortKey === 'grupo' ? grupoNome(e.grupoId) :
      sortKey === 'sub'   ? e.subgrupoId :
      sortKey === 'prox'  ? (e.proximaCalibracao || '') :
                            e.status
    lista = [...lista].sort((a, b) => val(a).localeCompare(val(b), 'pt', { numeric: true }) * dir)
    return lista
  })()

  const SortTh = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th className={cn('cursor-pointer select-none hover:text-white/80', className)} onClick={() => clicarSort(k)}>
      <span className="inline-flex items-center gap-1">{label}
        {sortKey === k ? (sortDir === 'asc' ? <ArrowUp size={11}/> : <ArrowDown size={11}/>) : <ArrowUpDown size={11} className="opacity-30"/>}
      </span>
    </th>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Laboratório · EMC</p>
          <h1 className="page-title">Equipamentos</h1>
          <p className="page-sub">Filtros combináveis · ordenável</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/equipamentos/novo" className="btn-primary"><Plus size={13}/> Novo Equipamento</Link>
          <button type="button" onClick={importarPastaMae} disabled={!!impProgresso} className="btn-secondary">
            {impProgresso ? <Loader2 size={13} className="animate-spin"/> : <FolderInput size={13}/>}
            {impProgresso ? 'Importando…' : 'Importar pasta-mãe'}
          </button>
          <Link href="/checagens/nova" className="btn-secondary"><Plus size={13}/> Nova Checagem</Link>
        </div>
      </div>

      {impProgresso && (
        <div className="mb-4 card px-4 py-2.5 flex items-center gap-2 text-[12px] text-white/70">
          <Loader2 size={14} className="animate-spin text-teal"/> {impProgresso}
        </div>
      )}

      {impRelatorio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setImpRelatorio(null)}>
          <div className="card w-full max-w-lg max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-[15px] text-white mb-1">Importação concluída</h3>
            <p className="text-[11px] text-white/40 mb-4">{impRelatorio.total} pasta(s) processada(s)</p>
            <div className="space-y-3 text-[12px]">
              {impRelatorio.sucessos.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-green-400 font-medium mb-1"><CheckCircle2 size={14}/> Cadastrados ({impRelatorio.sucessos.length})</p>
                  <div className="flex flex-wrap gap-1">{impRelatorio.sucessos.map(t => <span key={t} className="tag-chip">{t}</span>)}</div>
                </div>
              )}
              {impRelatorio.atualizados.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-teal font-medium mb-1"><CheckCircle2 size={14}/> Já existiam — certificado anexado ({impRelatorio.atualizados.length})</p>
                  <div className="flex flex-wrap gap-1">{impRelatorio.atualizados.map(t => <span key={t} className="tag-chip">{t}</span>)}</div>
                </div>
              )}
              {impRelatorio.pulados.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-amber-400 font-medium mb-1"><AlertTriangle size={14}/> Não cadastrados — vão pro rascunho ({impRelatorio.pulados.length})</p>
                  <ul className="space-y-0.5">{impRelatorio.pulados.map((p, i) => <li key={i} className="text-white/60"><b className="text-amber-300/80">{p.tag}</b> — {p.motivo}</li>)}</ul>
                </div>
              )}
              {impRelatorio.erros.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-red-400 font-medium mb-1"><XCircle size={14}/> Falhas ({impRelatorio.erros.length})</p>
                  <ul className="space-y-0.5">{impRelatorio.erros.map((e, i) => <li key={i} className="text-white/60"><b className="text-red-300/80">{e.folder}</b> — {e.motivo}</li>)}</ul>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-5"><button type="button" onClick={() => setImpRelatorio(null)} className="btn-primary">Fechar</button></div>
          </div>
        </div>
      )}

      {/* ── Busca + filtros (dropdowns) ─────────────────────────────────── */}
      <div className="card p-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Busca inline */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"/>
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por TAG ou nome…"
              className="input text-[12px] py-1.5 pl-8 w-full" />
          </div>
          {/* Dropdowns de filtro */}
          <FilterDropdown label="Áreas" selected={fAreas} onChange={setFAreas}
            options={areasPresentes.map(a => ({ id: a.id, label: a.nome, count: a.n, color: a.cor }))} />
          <FilterDropdown label="Siglas" selected={fSiglas} onChange={setFSiglas}
            options={siglasPresentes.map(s => ({ id: s.sigla, label: s.significado ? `${s.sigla} · ${s.significado}` : s.sigla, count: s.n, color: s.cor }))} />
          <FilterDropdown label="Grupos" selected={fGrupos} onChange={setFGrupos}
            options={grupos.map(g => ({ id: g.id, label: g.nome, count: equips.filter(e => e.grupoId === g.id).length, color: GRUPO_CORES[g.cor] ?? '#94A3B8' }))} />
          <FilterDropdown label="Subgrupos" selected={fSubs} onChange={setFSubs}
            options={grupos.flatMap(g => g.subgrupos.map(s => ({ id: s.id, label: s.nome, count: equips.filter(e => e.subgrupoId === s.id).length, color: GRUPO_CORES[g.cor] ?? '#94A3B8' }))).filter(o => o.count > 0 || fSubs.includes(o.id))} />
          {totalPendentes > 0 && (
            <button type="button" onClick={() => setSoPendentes(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border transition-all"
              style={{ background: soPendentes ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)', color: soPendentes ? '#F59E0B' : 'rgba(255,255,255,0.6)', borderColor: soPendentes ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)' }}>
              <AlertTriangle size={12}/> Pendência <span className="opacity-60 font-mono">{totalPendentes}</span>
            </button>
          )}
          {temFiltro && (
            <button type="button" onClick={limpar} className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white px-2 py-1.5 rounded-lg border border-white/10 hover:border-white/25 transition-all">
              <X size={11}/> Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Rascunho (não cadastrados) ──────────────────────────────────── */}
      {rascunho.length > 0 && (
        <div className="card mb-6 overflow-hidden">
          <button type="button" onClick={() => setVerRascunho(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/3 transition-colors">
            <FileWarning size={15} className="text-amber-400"/>
            <span className="text-[12px] font-medium text-amber-300/90">Rascunho — não cadastrados ({rascunho.length})</span>
            <span className="text-[10px] text-white/30 ml-1">cadastre estes manualmente</span>
            <ChevronRight size={14} className={cn('ml-auto text-white/30 transition-transform', verRascunho && 'rotate-90')}/>
          </button>
          {verRascunho && (
            <div className="border-t border-white/5 max-h-60 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="tbl-head"><tr><th className="w-28">TAG/Pasta</th><th>Motivo</th></tr></thead>
                <tbody>
                  {rascunho.map((r, i) => (
                    <tr key={i} className="tbl-row">
                      <td><span className="font-mono text-amber-300/80">{r.tag || r.folder}</span></td>
                      <td className="text-white/55">{r.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Lista ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="font-display font-semibold text-[13px] text-white/60 uppercase tracking-widest">
          {temFiltro ? 'Filtrado' : 'Todos os equipamentos'}
        </h2>
        <span className="text-[11px] text-white/30 font-mono">
          {temFiltro ? `${equipsFiltrados.length} de ${equips.length}` : `${equips.length} total`}
        </span>
      </div>

      {equips.length === 0 ? (
        <div className="card p-10 text-center text-white/25 text-sm">Nenhum equipamento cadastrado.</div>
      ) : equipsFiltrados.length === 0 ? (
        <div className="card p-10 text-center text-white/25 text-sm">Nenhum equipamento neste filtro.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="tbl-head">
              <tr>
                <SortTh k="tag" label="Tag"/>
                <SortTh k="nome" label="Nome"/>
                <SortTh k="grupo" label="Grupo"/>
                <SortTh k="sub" label="Subgrupo"/>
                <SortTh k="prox" label="Próx. Calibração"/>
                <SortTh k="status" label="Status"/>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equipsFiltrados.map(e => {
                const Icon = ICONES[e.grupoId] ?? Gauge
                const g    = grupos.find(g => g.id === e.grupoId)
                const cor  = GRUPO_CORES[g?.cor ?? 'gray']
                const pend = pendenciasEquip(e)
                return (
                  <tr key={e.id} className="tbl-row">
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="tag-chip">{e.tag}</span>
                        {pend.length > 0 && (
                          <span title={`Cadastro incompleto — falta: ${pend.join(', ')}`}
                            className="inline-flex items-center text-amber-400">
                            <AlertTriangle size={13}/>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="font-medium text-white/80">{e.nome}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={12} style={{ color: cor }}/>
                        <span className="text-[11px] text-white/50">{g?.nome ?? e.grupoId}</span>
                      </span>
                    </td>
                    <td><span className="text-[10px] text-white/40 font-mono">{e.subgrupoId}</span></td>
                    <td className="font-mono text-[11px]">{fmt(e.proximaCalibracao)}</td>
                    <td><StatusPill status={e.status}/></td>
                    <td>
                      <Link href={`/equipamentos/${e.id}`} className="text-white/25 hover:text-white transition-colors">
                        <ChevronRight size={14}/>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
