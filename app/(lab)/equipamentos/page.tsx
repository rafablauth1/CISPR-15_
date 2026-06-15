'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight, Zap, Gauge, Waves, Radio, SlidersHorizontal, Thermometer, FolderInput, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
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

function StatusPill({ status }: { status: string }) {
  if (status === 'ativo')    return <span className="badge-success">Ativo</span>
  if (status === 'calibrar') return <span className="badge-warning">Calibrar</span>
  return <span className="badge-danger">Fora</span>
}

export default function EquipamentosPage() {
  const [equips, setEquips] = useState<EquipamentoEMC[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [tax, setTax] = useState<Taxonomia>({ areas: [], siglas: [], tipos: [] })
  // Filtro ativo: por grupo (card), subgrupo (badge) ou sigla (3 letras da TAG)
  const [filtro, setFiltro] = useState<{ tipo: 'grupo' | 'subgrupo' | 'sigla'; id: string; label: string } | null>(null)
  // Importação em lote (pasta-mãe → 1 pasta por TAG → …Certificado.pdf)
  const [impProgresso, setImpProgresso] = useState<string | null>(null)
  const [impRelatorio, setImpRelatorio] = useState<RelatorioImport | null>(null)

  async function importarPastaMae() {
    const api = (window as unknown as { electronAPI?: LabAPI }).electronAPI
    if (!api?.scanCertificados || !api?.browseFolder) {
      alert('Disponível apenas no aplicativo (Electron).')
      return
    }
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
      // Recarrega a lista de equipamentos
      fetch('/api/equipamentos').then(x => x.json()).then(e => setEquips(Array.isArray(e) ? e : [])).catch(() => {})
    } catch (e) {
      alert('Erro: ' + String(e))
    } finally {
      setImpProgresso(null)
    }
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
  }, [])

  const equipsByGrupo = (grupoId: string) => equips.filter(e => e.grupoId === grupoId)

  // Clica no card → filtra por grupo; clica de novo no mesmo → limpa
  function toggleGrupo(id: string, label: string) {
    setFiltro(f => (f?.tipo === 'grupo' && f.id === id) ? null : { tipo: 'grupo', id, label })
  }
  // Clica na badge → filtra por subgrupo
  function toggleSubgrupo(id: string, label: string) {
    setFiltro(f => (f?.tipo === 'subgrupo' && f.id === id) ? null : { tipo: 'subgrupo', id, label })
  }

  const equipsFiltrados = !filtro
    ? equips
    : filtro.tipo === 'grupo'
      ? equips.filter(e => e.grupoId === filtro.id)
      : filtro.tipo === 'sigla'
        ? equips.filter(e => siglaDaTag(e.tag) === filtro.id)
        : equips.filter(e => e.subgrupoId === filtro.id)

  // Siglas presentes nas TAGs (3 letras finais) + significado/área da taxonomia
  const siglasPresentes = (() => {
    const cont = new Map<string, number>()
    for (const e of equips) { const s = siglaDaTag(e.tag); if (s) cont.set(s, (cont.get(s) ?? 0) + 1) }
    return [...cont.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([sigla, n]) => {
      const def = tax.siglas.find(x => x.sigla === sigla)
      const area = def ? tax.areas.find(a => a.id === def.areaId) : undefined
      return { sigla, n, significado: def?.significado, cor: area ? GRUPO_CORES[area.cor] : '#94A3B8' }
    })
  })()
  function toggleSigla(id: string, label: string) {
    setFiltro(f => (f?.tipo === 'sigla' && f.id === id) ? null : { tipo: 'sigla', id, label })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Laboratório · EMC</p>
          <h1 className="page-title">Equipamentos</h1>
          <p className="page-sub">Por grupo e subgrupo</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/equipamentos/novo" className="btn-primary">
            <Plus size={13}/> Novo Equipamento
          </Link>
          <button type="button" onClick={importarPastaMae} disabled={!!impProgresso} className="btn-secondary">
            {impProgresso ? <Loader2 size={13} className="animate-spin"/> : <FolderInput size={13}/>}
            {impProgresso ? 'Importando…' : 'Importar pasta-mãe'}
          </button>
          <Link href="/checagens/nova" className="btn-secondary">
            <Plus size={13}/> Nova Checagem
          </Link>
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
                  <p className="flex items-center gap-1.5 text-amber-400 font-medium mb-1"><AlertTriangle size={14}/> Cadastrar manualmente — não-LABELO ({impRelatorio.pulados.length})</p>
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
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setImpRelatorio(null)} className="btn-primary">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Siglas das TAGs (laboratórios) — filtro rápido */}
      {siglasPresentes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/30 mr-1">Siglas:</span>
          {siglasPresentes.map(s => {
            const ativo = filtro?.tipo === 'sigla' && filtro.id === s.sigla
            return (
              <button key={s.sigla} type="button"
                onClick={() => toggleSigla(s.sigla, s.significado ? `${s.sigla} · ${s.significado}` : s.sigla)}
                title={s.significado || 'Sigla não cadastrada em Áreas & Siglas'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all"
                style={{
                  background: ativo ? `${s.cor}22` : 'rgba(255,255,255,0.03)',
                  color: ativo ? s.cor : 'rgba(255,255,255,0.55)',
                  border: `1px solid ${ativo ? s.cor + '66' : 'rgba(255,255,255,0.08)'}`,
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.cor }}/>
                {s.sigla}
                <span className="opacity-50">{s.n}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Grupos */}
      {grupos.length > 0 && (
        <>
          <h2 className="font-display font-semibold text-[13px] text-white/60 uppercase tracking-widest mb-3">Grupos</h2>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {grupos.map(g => {
              const cor       = GRUPO_CORES[g.cor] ?? '#94A3B8'
              const Icon      = ICONES[g.id] ?? Gauge
              const total     = equipsByGrupo(g.id).length
              const grupoAtivo = filtro?.tipo === 'grupo' && filtro.id === g.id
              return (
                <div key={g.id}
                  className={cn('card p-4 transition-all', grupoAtivo ? 'ring-1' : 'hover:border-white/15')}
                  style={grupoAtivo ? { borderColor: `${cor}66`, boxShadow: `0 0 0 1px ${cor}66`, background: `${cor}0A` } : undefined}>
                  {/* Cabeçalho clicável → filtra por grupo */}
                  <button type="button" onClick={() => toggleGrupo(g.id, g.nome)}
                    className="w-full flex items-center gap-3 mb-3 text-left">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: `${cor}18`, border: `1px solid ${cor}28` }}>
                      <Icon size={18} style={{ color: cor }}/>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[13px] text-white truncate">{g.nome}</p>
                      <p className="text-[10px] text-white/35 font-mono">{total} equipamento{total !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                  {/* Badges de subgrupo clicáveis → filtram por subgrupo */}
                  <div className="flex flex-wrap gap-1">
                    {g.subgrupos.map(s => {
                      const subAtivo = filtro?.tipo === 'subgrupo' && filtro.id === s.id
                      return (
                        <button key={s.id} type="button"
                          onClick={() => toggleSubgrupo(s.id, `${g.nome} · ${s.nome}`)}
                          className="badge font-mono transition-all hover:brightness-125"
                          style={{
                            background: subAtivo ? `${cor}30` : `${cor}12`,
                            color: cor,
                            border: `1px solid ${cor}${subAtivo ? '66' : '22'}`,
                            fontSize: 9,
                          }}>
                          {s.numero} {s.nome}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <hr className="border-white/6 mb-8"/>
        </>
      )}

      {/* Lista */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold text-[13px] text-white/60 uppercase tracking-widest">
            {filtro ? 'Filtrado' : 'Todos os equipamentos'}
          </h2>
          {filtro && (
            <button type="button" onClick={() => setFiltro(null)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-white/50 hover:text-white px-2 py-0.5 rounded-lg border border-white/10 hover:border-white/25 transition-all">
              {filtro.label}
              <span className="text-white/40">✕</span>
            </button>
          )}
        </div>
        <span className="text-[11px] text-white/30 font-mono">
          {filtro ? `${equipsFiltrados.length} de ${equips.length}` : `${equips.length} total`}
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
                <th>Tag</th>
                <th>Nome</th>
                <th>Grupo</th>
                <th>Subgrupo</th>
                <th>Próx. Calibração</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equipsFiltrados.map(e => {
                const Icon = ICONES[e.grupoId] ?? Gauge
                const g    = grupos.find(g => g.id === e.grupoId)
                const cor  = GRUPO_CORES[g?.cor ?? 'gray']
                return (
                  <tr key={e.id} className="tbl-row">
                    <td><span className="tag-chip">{e.tag}</span></td>
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
