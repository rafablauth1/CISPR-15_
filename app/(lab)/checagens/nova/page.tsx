'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Upload, ScanText, Save, FileSearch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addM, fileToBase64 } from '@/lib/utils'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import type { ItemChecagem, TipoComparacao, ResultadoGeral } from '@/lib/checagens/tipos'
import { TEMPLATES } from '@/lib/checagens/templates'

type Tab = 'manual' | 'excel' | 'ocr'

const LABORATORIOS = [
  { grupo: 'Calibração', items: ['Alta Frequência e Telecomunicações','Eletricidade','Eletroacústica','Força, Torque e Dureza','Fotometria','Instrumentos Ópticos','Temperatura e Umidade Relativa','Tempo e Frequência','Volume'] },
  { grupo: 'Ensaios',    items: ['Alta Tecnologia','ATX','Eletrodomésticos','Equip. de Uso Prof. e Infra','Iluminação e Componentes','LAIF','Química'] },
]

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function emptyItem(ponto: number): ItemChecagem {
  return { id: uid(), ponto, grandeza: '', unidade: '', valorReferencia: '', valorMedido: '', resultado: 'na' }
}

/* ── Helpers de cálculo ───────────────────────────────────────────── */
function parseNum(s: string | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : n
}

function calcCorrigido(vr: string, correcao: string | undefined): number | null {
  const v = parseNum(vr)
  const c = parseNum(correcao)
  if (v === null || c === null) return null
  return v + c
}

function calcErro(item: ItemChecagem, indireta: boolean): number | null {
  const mm = parseNum(item.valorMedido)
  if (mm === null) return null
  if (indireta) {
    const vc = parseNum(item.valorCorrigido) ?? calcCorrigido(item.valorReferencia, item.correcaoPadrao)
    return vc !== null ? mm - vc : null
  }
  const vr = parseNum(item.valorReferencia)
  return vr !== null ? mm - vr : null
}

function fmtErro(e: number | null, criterioMax?: number): { text: string; ok: boolean | null } {
  if (e === null) return { text: '—', ok: null }
  const text = (e >= 0 ? '+' : '') + e.toPrecision(4)
  if (criterioMax !== undefined) return { text, ok: Math.abs(e) <= criterioMax }
  return { text, ok: null }
}

/* ── Linha da tabela de medição ───────────────────────────────────── */
function ItemRow({ item, indireta, onChange, onDelete }: {
  item: ItemChecagem
  indireta: boolean
  onChange: (i: ItemChecagem) => void
  onDelete: () => void
}) {
  const set = (k: keyof ItemChecagem, v: string | number) => {
    const next = { ...item, [k]: v }
    // Auto-calcular valorCorrigido ao mudar VR ou correção
    if (indireta && (k === 'valorReferencia' || k === 'correcaoPadrao')) {
      const vc = calcCorrigido(
        k === 'valorReferencia' ? String(v) : next.valorReferencia,
        k === 'correcaoPadrao'  ? String(v) : next.correcaoPadrao,
      )
      if (vc !== null) next.valorCorrigido = vc.toPrecision(6).replace(/\.?0+$/, '')
    }
    onChange(next)
  }

  const erro = calcErro(item, indireta)
  const { text: erroTxt, ok: erroOk } = fmtErro(erro, item.criterioMax)
  const inp = 'input text-[11px] py-1 px-2 h-7'
  const rowCls = item.resultado === 'nok' ? 'tbl-row bg-red-500/5' : item.resultado === 'ok' ? 'tbl-row bg-green-500/4' : 'tbl-row'

  return (
    <tr className={cn(rowCls, 'group/row')}>
      <td className="w-10 text-center font-mono text-[11px] text-white/40">{item.ponto}</td>
      <td><input className={inp} value={item.grandeza} onChange={e => set('grandeza', e.target.value)} placeholder="ex: Tensão DC"/></td>
      <td className="w-20"><input className={inp+' font-mono'} value={item.unidade} onChange={e => set('unidade', e.target.value)} placeholder="V"/></td>
      <td className="w-28"><input className={inp+' font-mono'} value={item.valorReferencia} onChange={e => set('valorReferencia', e.target.value)} placeholder="VR"/></td>
      {indireta && <>
        <td className="w-28"><input className={inp+' font-mono'} value={item.valorTransferencia??''} onChange={e => set('valorTransferencia', e.target.value)} placeholder="Transfer."/></td>
        <td className="w-24">
          <input className={inp+' font-mono'} value={item.correcaoPadrao??''} onChange={e => set('correcaoPadrao', e.target.value)} placeholder="Corr."/>
        </td>
        <td className="w-28">
          {/* Valor corrigido: auto-calc mostrado em cinza se veio do cálculo */}
          <input className={cn(inp, 'font-mono', item.valorCorrigido && !item.correcaoPadrao ? 'text-white/40' : '')}
            value={item.valorCorrigido??''} onChange={e => set('valorCorrigido', e.target.value)}
            placeholder="auto"/>
        </td>
      </>}
      <td className="w-28"><input className={inp+' font-mono'} value={item.valorMedido} onChange={e => set('valorMedido', e.target.value)} placeholder="MM"/></td>
      {/* Erro calculado (somente leitura) */}
      <td className="w-24 text-center">
        <span className={cn('font-mono text-[11px] px-1.5 py-0.5 rounded',
          erroOk === true  && 'text-green-400 bg-green-500/8',
          erroOk === false && 'text-red-400 bg-red-500/8',
          erroOk === null  && 'text-white/25',
        )}>
          {erroTxt}
        </span>
      </td>
      {/* Critério máx */}
      <td className="w-24">
        <input className={inp+' font-mono'} type="number" value={item.criterioMax??''} placeholder="±"
          onChange={e => set('criterioMax', e.target.value ? Number(e.target.value) : '')}/>
      </td>
      <td className="w-28">
        <select className={inp+' cursor-pointer'} value={item.resultado} onChange={e => set('resultado', e.target.value)}>
          <option value="na">—</option>
          <option value="ok">Satisfatório</option>
          <option value="nok">Insatisfatório</option>
        </select>
      </td>
      <td><input className={inp} value={item.observacoes??''} onChange={e => set('observacoes', e.target.value)} placeholder="Obs."/></td>
      <td className="w-8">
        <button type="button" onClick={onDelete} className="opacity-0 group-hover/row:opacity-100 text-white/25 hover:text-red-400 transition-all p-0.5">
          <Trash2 size={12}/>
        </button>
      </td>
    </tr>
  )
}

/* ── Parser de correções de certificado de calibração ────────────── */
function parsearCorrecoesDeCertificado(texto: string): number[] {
  const corrections: number[] = []
  // Padrões típicos em certificados RNBC/LABELO:
  // "Correção: +0,005 V" ou tabela "ponto | valor | correção | incerteza"
  // Busca por sequências numéricas com sinal opcional
  const linhas = texto.split(/\r?\n/)
  for (const linha of linhas) {
    const normalizada = linha.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    // Linha que menciona "corre" (correção, correction)
    if (normalizada.includes('corre')) {
      const nums = linha.match(/([+-]?\s*\d+[,.]?\d*(?:[eE][+-]?\d+)?)/g)
      if (nums && nums.length > 0) {
        const val = parseFloat(nums[nums.length - 1].replace(',', '.').replace(/\s/g, ''))
        if (!isNaN(val)) corrections.push(val)
      }
    }
  }
  // Fallback: busca coluna de correção em tabelas numéricas
  if (corrections.length === 0) {
    for (const linha of linhas) {
      const celulas = linha.split(/\s{2,}|\t/).map(s => s.trim()).filter(Boolean)
      if (celulas.length >= 3) {
        const nums = celulas.map(c => parseFloat(c.replace(',', '.'))).filter(n => !isNaN(n))
        // Assume que a penúltima coluna numérica é a correção (padrão comum em certificados)
        if (nums.length >= 3) corrections.push(nums[nums.length - 2])
      }
    }
  }
  return corrections
}

/* ── Página ───────────────────────────────────────────────────────── */
export default function NovaChecagemPage() {
  const router    = useRouter()
  const excelRef  = useRef<HTMLInputElement>(null)
  const ocrRef    = useRef<HTMLInputElement>(null)
  const certRef   = useRef<HTMLInputElement>(null)

  const [tab,            setTab]           = useState<Tab>('manual')
  const [equips,         setEquips]        = useState<EquipamentoEMC[]>([])
  const [equipId,        setEquipId]       = useState('')
  // FOR 6405
  const [nomeInstrumento, setNomeInstrumento] = useState('')
  const [laboratorio,    setLaboratorio]   = useState('')
  const [numeroCert,     setNumeroCert]    = useState('')
  const [dataCalibRef,   setDataCalibRef]  = useState('')
  const [padraoTag,      setPadraoTag]     = useState('')
  const [tipoComp,       setTipoComp]      = useState<TipoComparacao>('direta')
  const [resultadoGeral, setResultadoGeral] = useState<ResultadoGeral>('pendente')
  // Execução
  const [data,           setData]          = useState(new Date().toISOString().slice(0, 10))
  const [responsavel,    setResponsavel]   = useState('')
  const [periodicidade,  setPeriodicidade] = useState(90)
  const [normaRef,       setNormaRef]      = useState('')
  const [obs,            setObs]           = useState('')
  // Itens
  const [itens,          setItens]         = useState<ItemChecagem[]>(Array.from({ length: 10 }, (_, i) => emptyItem(i + 1)))
  // Import
  const [excelItens,     setExcelItens]    = useState<ItemChecagem[]>([])
  const [ocrTexto,       setOcrTexto]      = useState('')
  const [certOCR,        setCertOCR]       = useState('')  // texto do certificado PDF
  const [certLoading,    setCertLoading]   = useState(false)
  const [loading,        setLoading]       = useState(false)
  const [salvando,       setSalvando]      = useState(false)

  useEffect(() => {
    fetch('/api/equipamentos').then(r => r.json()).then(e => setEquips(Array.isArray(e) ? e : [])).catch(() => {})
  }, [])

  function handleEquipChange(id: string) {
    setEquipId(id)
    const eq = equips.find(e => e.id === id)
    if (!eq) return
    setNomeInstrumento(eq.nome)
    const tpl = TEMPLATES[eq.subgrupoId]
    if (tpl) {
      setPeriodicidade(tpl.periodicidadePadrao)
      setItens(tpl.itens.map((t, i) => ({
        ...emptyItem(i + 1),
        grandeza: t.descricao,
        unidade: t.unidade,
        criterioMin: t.criterioMin,
        criterioMax: t.criterioMax,
      })))
    }
  }

  function addItem() { setItens(p => [...p, emptyItem(p.length + 1)]) }
  function removeItem(id: string) { setItens(p => p.filter(i => i.id !== id).map((i, idx) => ({ ...i, ponto: idx + 1 }))) }
  function updateItem(id: string, item: ItemChecagem) { setItens(p => p.map(i => i.id === id ? item : i)) }

  /* Aplicar correções extraídas do certificado PDF */
  const aplicarCorrecoesDoCert = useCallback(() => {
    if (!certOCR) return
    const correcoes = parsearCorrecoesDeCertificado(certOCR)
    if (correcoes.length === 0) { alert('Nenhuma correção identificada no texto do certificado. Verifique o OCR.'); return }
    setItens(prev => prev.map((item, i) => {
      const c = correcoes[i]
      if (c === undefined) return item
      const correcaoPadrao = (c >= 0 ? '+' : '') + c
      const vr = parseNum(item.valorReferencia)
      const valorCorrigido = vr !== null ? String((vr + c).toPrecision(6).replace(/\.?0+$/, '')) : undefined
      return { ...item, correcaoPadrao, valorCorrigido }
    }))
    alert(`${Math.min(correcoes.length, itens.length)} correções aplicadas aos pontos.`)
  }, [certOCR, itens.length])

  async function handleCertPDF(file: File) {
    setCertLoading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/importacao/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagemBase64: base64 }) })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setCertOCR(d.texto ?? '')
    } catch (e: unknown) { alert('Erro no OCR do certificado: ' + String(e)) }
    finally { setCertLoading(false) }
  }

  async function salvar(itensFinal: ItemChecagem[]) {
    const eq = equips.find(e => e.id === equipId)
    if (!eq) { alert('Selecione um equipamento.'); return }
    setSalvando(true)
    const proximaChecagem = addM(data, Math.round(periodicidade / 30))
    const { validarChecagem } = await import('@/lib/checagens/validacao')
    const status = validarChecagem(itensFinal, proximaChecagem, resultadoGeral)
    try {
      const res = await fetch('/api/checagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipamentoId: eq.id, equipamentoTag: eq.tag,
          nomeInstrumento, laboratorio,
          numeroCertificado: numeroCert, dataCalibracaoRef: dataCalibRef,
          padraoTag, grupoId: eq.grupoId, subgrupoId: eq.subgrupoId,
          data, responsavel, tipoComparacao: tipoComp, resultadoGeral,
          periodicidade, proximaChecagem, fonte: tab,
          normaReferencia: normaRef || undefined, status,
          itens: itensFinal, obs: obs || undefined,
        }),
      })
      const saved = await res.json()
      if (saved.error) throw new Error(saved.error)
      router.push(`/checagens/${saved.id}`)
    } catch (e: unknown) {
      alert('Erro ao salvar: ' + String(e))
    } finally { setSalvando(false) }
  }

  async function handleExcel(file: File) {
    setLoading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/importacao/excel', { method: 'POST', body: fd })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setExcelItens((d.itens ?? []).map((item: ItemChecagem, i: number) => ({ ...item, ponto: i + 1, valorReferencia: item.valorReferencia ?? '', valorMedido: item.valorMedido ?? '' })))
    } catch (e: unknown) { alert('Erro ao ler Excel: ' + String(e)) }
    finally { setLoading(false) }
  }

  async function handleOCR(file: File) {
    setLoading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/importacao/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagemBase64: base64 }) })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setOcrTexto(d.texto ?? '')
    } catch (e: unknown) { alert('Erro no OCR: ' + String(e)) }
    finally { setLoading(false) }
  }

  const indireta = tipoComp === 'indireta'
  const equip    = equips.find(e => e.id === equipId)

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">FOR 6405 · Rev 01</p>
          <h1 className="page-title">Registro de Checagem Intermediária</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/30">Fonte:</span>
          {(['manual', 'excel', 'ocr'] as Tab[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={cn('px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                tab === t ? 'bg-[#141B28] text-white border border-white/10' : 'text-white/35 hover:text-white/60')}>
              {t === 'manual' ? 'Manual' : t === 'excel' ? 'Excel' : 'OCR'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cabeçalho FOR 6405 ── */}
      <div className="card p-5 mb-4">
        <p className="form-section mb-4">Identificação do instrumento</p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2">
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Equipamento *</label>
            <select className="input" value={equipId} onChange={e => handleEquipChange(e.target.value)}>
              <option value="">Selecione…</option>
              {equips.map(e => <option key={e.id} value={e.id}>{e.tag} — {e.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">TAG</label>
            <input className="input font-mono" value={equip?.tag ?? ''} readOnly placeholder="Auto"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Instrumento de medição</label>
            <input className="input" value={nomeInstrumento} onChange={e => setNomeInstrumento(e.target.value)} placeholder="Nome / descrição"/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Laboratório</label>
            <select className="input" value={laboratorio} onChange={e => setLaboratorio(e.target.value)}>
              <option value="">Selecione…</option>
              {LABORATORIOS.map(g => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.items.map(lab => <option key={lab} value={lab}>{lab}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Certificado de calibração n°</label>
            <input className="input font-mono" value={numeroCert} onChange={e => setNumeroCert(e.target.value)} placeholder="ex: R0042-2025"/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Data da calibração (padrão)</label>
            <input type="date" className="input" value={dataCalibRef} onChange={e => setDataCalibRef(e.target.value)}/>
          </div>
        </div>

        <p className="form-section mb-4">Identificação do(s) padrão(ões)</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">TAG do padrão</label>
            <input className="input font-mono" value={padraoTag} onChange={e => setPadraoTag(e.target.value)} placeholder="ex: 1528EMC"/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Data da checagem</label>
            <input type="date" className="input" value={data} onChange={e => setData(e.target.value)}/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Responsável</label>
            <input className="input" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do técnico"/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Periodicidade (dias)</label>
            <input type="number" className="input" value={periodicidade} onChange={e => setPeriodicidade(Number(e.target.value))}/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Norma de referência</label>
            <input className="input" value={normaRef} onChange={e => setNormaRef(e.target.value)} placeholder="ex: CISPR 15"/>
          </div>
        </div>

        {/* Tipo de comparação + resultado */}
        <div className="grid grid-cols-2 gap-6 mt-5 pt-5 border-t border-white/6">
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-2">Tipo de comparação</label>
            <div className="flex gap-4">
              {(['direta', 'indireta'] as TipoComparacao[]).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tipoComp" value={t} checked={tipoComp === t} onChange={() => setTipoComp(t)} className="accent-gold"/>
                  <span className="text-sm text-white/70">{t === 'direta' ? 'Direta' : 'Indireta'}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-2">Resultado da checagem</label>
            <div className="flex gap-4">
              {([['satisfatorio', 'Satisfatório', 'text-green-400'], ['insatisfatorio', 'Insatisfatório', 'text-red-400'], ['pendente', 'Pendente', 'text-white/50']] as [ResultadoGeral, string, string][]).map(([v, l, cls]) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="resultGeral" value={v} checked={resultadoGeral === v} onChange={() => setResultadoGeral(v)} className="accent-gold"/>
                  <span className={cn('text-sm', cls)}>{l}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Leitor de certificado de calibração (PDF → correções) ── */}
        <div className="mt-5 pt-5 border-t border-white/6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-mono tracking-[2px] uppercase text-white/40">
                Certificado de calibração — extração de correções
              </p>
              <p className="text-[11px] text-white/25 mt-0.5">
                Carregue o PDF do certificado para extrair automaticamente as correções do padrão por ponto
              </p>
            </div>
            {certOCR && (
              <button type="button" onClick={aplicarCorrecoesDoCert}
                className="btn-primary text-xs">
                <FileSearch size={12}/> Aplicar correções
              </button>
            )}
          </div>
          <input ref={certRef} type="file" accept=".pdf,image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleCertPDF(e.target.files[0])}/>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => certRef.current?.click()} className="btn-secondary text-xs">
              {certLoading ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>}
              {certLoading ? 'Lendo certificado…' : 'Carregar PDF do certificado'}
            </button>
            {certOCR && (
              <span className="text-[11px] text-green-400">
                ✓ Texto extraído — {parsearCorrecoesDeCertificado(certOCR).length} correção(ões) identificada(s)
              </span>
            )}
          </div>
          {certOCR && (
            <details className="mt-2">
              <summary className="text-[10px] text-white/25 cursor-pointer hover:text-white/50">Ver texto extraído</summary>
              <pre className="mt-1 p-2 rounded-lg bg-black/20 text-[9px] text-white/35 font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">{certOCR}</pre>
            </details>
          )}
        </div>
      </div>

      {/* ── Tab Manual ── */}
      {tab === 'manual' && (
        <div className="card overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="form-section">Pontos de medição</p>
            <button type="button" onClick={addItem} className="btn-ghost text-xs"><Plus size={12}/> Linha</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: indireta ? 1060 : 780 }}>
              <thead className="tbl-head">
                <tr>
                  <th className="w-10 text-center">Pt.</th>
                  <th>Grandeza verificada</th>
                  <th className="w-20">Unid.</th>
                  <th className="w-28">VR (padrão)</th>
                  {indireta && <>
                    <th className="w-28">Transferência</th>
                    <th className="w-24">Correção</th>
                    <th className="w-28">Val. corrigido</th>
                  </>}
                  <th className="w-28">MM (instrumento)</th>
                  <th className="w-24 text-center">
                    Erro {indireta ? '(MM−Vcorr)' : '(MM−VR)'}
                  </th>
                  <th className="w-24">Critério ±</th>
                  <th className="w-28">Resultado</th>
                  <th>Obs.</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map(item => (
                  <ItemRow key={item.id} item={item} indireta={indireta}
                    onChange={i => updateItem(item.id, i)}
                    onDelete={() => removeItem(item.id)}/>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-white/5 flex items-center gap-3">
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 flex-shrink-0">Obs. gerais</label>
            <input className="input flex-1 text-sm" value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações da checagem…"/>
          </div>
          <div className="px-4 py-3 border-t border-white/5 flex justify-end">
            <button type="button" onClick={() => salvar(itens)} disabled={salvando} className="btn-primary">
              {salvando && <Loader2 size={13} className="animate-spin"/>}
              <Save size={13}/> Registrar checagem
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Excel ── */}
      {tab === 'excel' && (
        <div className="card p-5 mb-4 space-y-4">
          <p className="form-section">Importar planilha .xlsx</p>
          <p className="text-[11px] text-white/40">Colunas esperadas: A=Grandeza, B=Unidade, C=VR, D=MM, E=Resultado, F=Observações</p>
          <div className="flex items-center gap-3">
            <input ref={excelRef} type="file" accept=".xlsx,.xls,.xltm" className="hidden"
              onChange={e => e.target.files?.[0] && handleExcel(e.target.files[0])}/>
            <button type="button" onClick={() => excelRef.current?.click()} className="btn-secondary">
              {loading ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13}/>} Selecionar arquivo
            </button>
          </div>
          {excelItens.length > 0 && (
            <>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full">
                  <thead className="tbl-head"><tr><th>#</th><th>Grandeza</th><th>Unidade</th><th>VR</th><th>MM</th><th>Resultado</th></tr></thead>
                  <tbody>
                    {excelItens.map(i => (
                      <tr key={i.id} className="tbl-row">
                        <td className="font-mono text-[11px] text-white/40">{i.ponto}</td>
                        <td>{i.grandeza}</td>
                        <td className="font-mono text-[11px]">{i.unidade}</td>
                        <td className="font-mono text-[11px]">{i.valorReferencia}</td>
                        <td className="font-mono text-[11px]">{i.valorMedido}</td>
                        <td>{i.resultado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => salvar(excelItens)} disabled={salvando} className="btn-primary">
                  {salvando && <Loader2 size={13} className="animate-spin"/>} Confirmar e registrar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab OCR ── */}
      {tab === 'ocr' && (
        <div className="card p-5 mb-4 space-y-4">
          <p className="form-section">Importar via OCR</p>
          <div className="flex items-center gap-3">
            <input ref={ocrRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={e => e.target.files?.[0] && handleOCR(e.target.files[0])}/>
            <button type="button" onClick={() => ocrRef.current?.click()} className="btn-secondary">
              {loading ? <Loader2 size={13} className="animate-spin"/> : <ScanText size={13}/>} Selecionar imagem / PDF
            </button>
          </div>
          {ocrTexto && (
            <>
              <textarea className="input h-48 resize-none font-mono text-xs" value={ocrTexto} onChange={e => setOcrTexto(e.target.value)}/>
              <div className="flex justify-end">
                <button type="button" className="btn-primary" disabled={salvando}
                  onClick={() => salvar([{ id: uid(), ponto: 1, grandeza: 'Resultado OCR', unidade: '—', valorReferencia: '', valorMedido: ocrTexto, resultado: 'na' }])}>
                  {salvando && <Loader2 size={13} className="animate-spin"/>} Confirmar e registrar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
