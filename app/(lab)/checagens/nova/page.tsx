'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Upload, ScanText, Save, FileSearch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addM, fileToBase64 } from '@/lib/utils'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import type { ItemChecagem, TipoComparacao, PapelReferencia, ResultadoGeral } from '@/lib/checagens/tipos'
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

/* ── Helpers numéricos ── */
function parseN(s: string | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : n
}

type Modo = 'direta-gera' | 'direta-mede' | 'indireta'

function getModo(tipo: TipoComparacao, papel: PapelReferencia): Modo {
  if (tipo === 'indireta') return 'indireta'
  return papel === 'gerador' ? 'direta-gera' : 'direta-mede'
}

function calcErro(item: ItemChecagem, modo: Modo): number | null {
  if (modo === 'direta-gera') {
    // Ref gera VR, instrumento lê MM → Erro = MM − VR
    const vr = parseN(item.valorReferencia), mm = parseN(item.valorMedido)
    return vr !== null && mm !== null ? mm - vr : null
  }
  if (modo === 'direta-mede') {
    // Instrumento gera VN, ref mede VR → Erro = VN − VR
    const vn = parseN(item.valorNominal), vr = parseN(item.valorReferencia)
    return vn !== null && vr !== null ? vn - vr : null
  }
  // Indireta: caixa preta gera, ref e instrumento lêem
  // Valor verdadeiro = VR + Correção; Erro = MM − VCorrigido
  const mm = parseN(item.valorMedido)
  const vc = parseN(item.valorCorrigido)
  const vr = parseN(item.valorReferencia)
  const base = vc ?? vr
  return mm !== null && base !== null ? mm - base : null
}

function fmtErro(e: number | null, criterioMax?: number) {
  if (e === null) return { text: '—', ok: null as boolean | null }
  const text = (e >= 0 ? '+' : '') + (Math.abs(e) < 0.001 ? e.toExponential(2) : e.toPrecision(4))
  const ok: boolean | null = criterioMax !== undefined ? Math.abs(e) <= criterioMax : null
  return { text, ok }
}

/* ── Linha da tabela ── */
function ItemRow({ item, modo, onChange, onDelete }: {
  item: ItemChecagem; modo: Modo
  onChange: (i: ItemChecagem) => void; onDelete: () => void
}) {
  function set(k: keyof ItemChecagem, v: string | number) {
    const next = { ...item, [k]: v }
    // Auto-calcular valorCorrigido no modo indireta
    if (modo === 'indireta' && (k === 'valorReferencia' || k === 'correcaoPadrao')) {
      const vr = parseN(k === 'valorReferencia' ? String(v) : next.valorReferencia)
      const c  = parseN(k === 'correcaoPadrao'  ? String(v) : next.correcaoPadrao)
      if (vr !== null && c !== null)
        next.valorCorrigido = (vr + c).toPrecision(6).replace(/\.?0+$/, '')
    }
    onChange(next)
  }

  const erro = calcErro(item, modo)
  const { text: erroTxt, ok: erroOk } = fmtErro(erro, item.criterioMax)
  const inp = 'input text-[11px] py-1 px-2 h-7'
  const rowCls = item.resultado === 'nok' ? 'bg-red-500/5' : item.resultado === 'ok' ? 'bg-green-500/4' : ''

  return (
    <tr className={cn('tbl-row group/row', rowCls)}>
      <td className="w-10 text-center font-mono text-[11px] text-white/40">{item.ponto}</td>
      <td><input className={inp} value={item.grandeza} onChange={e => set('grandeza', e.target.value)} placeholder="ex: Tensão DC"/></td>
      <td className="w-20"><input className={cn(inp,'font-mono')} value={item.unidade} onChange={e => set('unidade', e.target.value)} placeholder="V"/></td>

      {modo === 'direta-gera' && <>
        {/* Ref gera → VR = valor ajustado na ref, MM = leitura do instrumento */}
        <td className="w-32"><input className={cn(inp,'font-mono')} value={item.valorReferencia} onChange={e => set('valorReferencia', e.target.value)} placeholder="VR (ref gera)"/></td>
        <td className="w-32"><input className={cn(inp,'font-mono')} value={item.valorMedido} onChange={e => set('valorMedido', e.target.value)} placeholder="MM (instrumento lê)"/></td>
      </>}

      {modo === 'direta-mede' && <>
        {/* Instrumento gera → VN = nominal ajustado, VR = o que ref mede */}
        <td className="w-32"><input className={cn(inp,'font-mono')} value={item.valorNominal??''} onChange={e => set('valorNominal', e.target.value)} placeholder="VN (ajustado no inst.)"/></td>
        <td className="w-32"><input className={cn(inp,'font-mono')} value={item.valorReferencia} onChange={e => set('valorReferencia', e.target.value)} placeholder="VR (ref mede)"/></td>
      </>}

      {modo === 'indireta' && <>
        {/* Caixa preta gera → ref lê VR, instrumento lê MM */}
        <td className="w-28"><input className={cn(inp,'font-mono')} value={item.valorReferencia} onChange={e => set('valorReferencia', e.target.value)} placeholder="Leit. Ref."/></td>
        <td className="w-24"><input className={cn(inp,'font-mono')} value={item.correcaoPadrao??''} onChange={e => set('correcaoPadrao', e.target.value)} placeholder="Corr. cert."/></td>
        <td className="w-28">
          <input className={cn(inp,'font-mono text-white/50')} value={item.valorCorrigido??''} onChange={e => set('valorCorrigido', e.target.value)} placeholder="auto"/>
        </td>
        <td className="w-28"><input className={cn(inp,'font-mono')} value={item.valorMedido} onChange={e => set('valorMedido', e.target.value)} placeholder="Leit. Instrumento"/></td>
      </>}

      {/* Erro calculado */}
      <td className="w-24 text-center">
        <span className={cn('font-mono text-[11px] px-1.5 py-0.5 rounded',
          erroOk === true  && 'text-green-400 bg-green-500/8',
          erroOk === false && 'text-red-400 bg-red-500/8',
          erroOk === null  && 'text-white/25')}>
          {erroTxt}
        </span>
      </td>
      <td className="w-20">
        <input className={cn(inp,'font-mono')} type="number" value={item.criterioMax??''} placeholder="±"
          onChange={e => set('criterioMax', e.target.value ? Number(e.target.value) : '')}/>
      </td>
      <td className="w-28">
        <select className={cn(inp,'cursor-pointer')} value={item.resultado} onChange={e => set('resultado', e.target.value)}>
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

/* ── Cabeçalho dinâmico da tabela ── */
function TblHeader({ modo }: { modo: Modo }) {
  return (
    <thead className="tbl-head">
      <tr>
        <th className="w-10 text-center">Pt.</th>
        <th>Grandeza</th>
        <th className="w-20">Unid.</th>
        {modo === 'direta-gera' && <>
          <th className="w-32">VR — Ref. gera</th>
          <th className="w-32">MM — Instrumento lê</th>
        </>}
        {modo === 'direta-mede' && <>
          <th className="w-32">VN — Ajustado no inst.</th>
          <th className="w-32">VR — Ref. mede</th>
        </>}
        {modo === 'indireta' && <>
          <th className="w-28">Leit. Referência</th>
          <th className="w-24">Corr. cert.</th>
          <th className="w-28">Val. corrigido</th>
          <th className="w-28">Leit. Instrumento</th>
        </>}
        <th className="w-24 text-center">
          {modo === 'direta-gera'  && 'Erro (MM−VR)'}
          {modo === 'direta-mede'  && 'Erro (VN−VR)'}
          {modo === 'indireta'     && 'Erro (MM−Vcorr)'}
        </th>
        <th className="w-20">Critério ±</th>
        <th className="w-28">Resultado</th>
        <th>Obs.</th>
        <th className="w-8"></th>
      </tr>
    </thead>
  )
}

/* ── Parser de correções de certificado ── */
function parsearCorrecoesDeCertificado(texto: string): number[] {
  const corrections: number[] = []
  const linhas = texto.split(/\r?\n/)
  for (const linha of linhas) {
    const norm = linha.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
    if (norm.includes('corre')) {
      const nums = linha.match(/([+-]?\s*\d+[,.]?\d*(?:[eE][+-]?\d+)?)/g)
      if (nums) {
        const val = parseFloat(nums[nums.length-1].replace(',','.').replace(/\s/g,''))
        if (!isNaN(val)) corrections.push(val)
      }
    }
  }
  if (corrections.length === 0) {
    for (const linha of linhas) {
      const celulas = linha.split(/\s{2,}|\t/).map(s=>s.trim()).filter(Boolean)
      if (celulas.length >= 3) {
        const nums = celulas.map(c=>parseFloat(c.replace(',','.'))).filter(n=>!isNaN(n))
        if (nums.length >= 3) corrections.push(nums[nums.length-2])
      }
    }
  }
  return corrections
}

/* ── Página ── */
export default function NovaChecagemPage() {
  const router   = useRouter()
  const excelRef = useRef<HTMLInputElement>(null)
  const ocrRef   = useRef<HTMLInputElement>(null)
  const certRef  = useRef<HTMLInputElement>(null)

  const [tab,            setTab]           = useState<Tab>('manual')
  const [equips,         setEquips]        = useState<EquipamentoEMC[]>([])
  const [equipId,        setEquipId]       = useState('')
  const [nomeInstrumento, setNomeInstrumento] = useState('')
  const [laboratorio,    setLaboratorio]   = useState('')
  const [numeroCert,     setNumeroCert]    = useState('')
  const [dataCalibRef,   setDataCalibRef]  = useState('')
  const [padraoTag,      setPadraoTag]     = useState('')
  const [tipoComp,       setTipoComp]      = useState<TipoComparacao>('direta')
  const [papelRef,       setPapelRef]      = useState<PapelReferencia>('gerador')
  const [resultadoGeral, setResultadoGeral] = useState<ResultadoGeral>('pendente')
  const [data,           setData]          = useState(new Date().toISOString().slice(0,10))
  const [responsavel,    setResponsavel]   = useState('')
  const [periodicidade,  setPeriodicidade] = useState(3)   // em meses
  const [normaRef,       setNormaRef]      = useState('')
  const [obs,            setObs]           = useState('')
  const [itens,          setItens]         = useState<ItemChecagem[]>(Array.from({length:10},(_,i)=>emptyItem(i+1)))
  const [excelItens,     setExcelItens]    = useState<ItemChecagem[]>([])
  const [ocrTexto,       setOcrTexto]      = useState('')
  const [certOCR,        setCertOCR]       = useState('')
  const [certLoading,    setCertLoading]   = useState(false)
  const [certPadrao,     setCertPadrao]    = useState<import('@/lib/certificados/tipos').Certificado|null>(null)
  const [certPadraoMsg,  setCertPadraoMsg] = useState('')
  const [loading,        setLoading]       = useState(false)
  const [salvando,       setSalvando]      = useState(false)

  useEffect(() => {
    fetch('/api/equipamentos').then(r=>r.json()).then(e=>setEquips(Array.isArray(e)?e:[])).catch(()=>{})
  }, [])

  function handleEquipChange(id: string) {
    setEquipId(id)
    const eq = equips.find(e=>e.id===id)
    if (!eq) return
    setNomeInstrumento(eq.nome)
    const tpl = TEMPLATES[eq.subgrupoId]
    if (tpl) {
      setPeriodicidade(Math.round(tpl.periodicidadePadrao / 30))
      setItens(tpl.itens.map((t,i) => ({ ...emptyItem(i+1), grandeza:t.descricao, unidade:t.unidade, criterioMin:t.criterioMin, criterioMax:t.criterioMax })))
    }
  }

  const modo = getModo(tipoComp, papelRef)

  function addItem() { setItens(p=>[...p, emptyItem(p.length+1)]) }
  function removeItem(id: string) { setItens(p=>p.filter(i=>i.id!==id).map((i,idx)=>({...i,ponto:idx+1}))) }
  function updateItem(id: string, item: ItemChecagem) { setItens(p=>p.map(i=>i.id===id?item:i)) }

  // Ao informar TAG do padrão, busca o certificado mais recente válido
  async function handlePadraoTagChange(tag: string) {
    setPadraoTag(tag)
    setCertPadrao(null); setCertPadraoMsg('')
    if (!tag.trim()) return
    try {
      const certs = await fetch(`/api/certificados?tag=${encodeURIComponent(tag)}`).then(r=>r.json())
      if (!Array.isArray(certs) || certs.length === 0) { setCertPadraoMsg('Nenhum certificado encontrado para este TAG.'); return }
      // Pega o mais recente
      const mais = certs.sort((a: {dataEmissao:string}, b: {dataEmissao:string}) => b.dataEmissao.localeCompare(a.dataEmissao))[0]
      setCertPadrao(mais)
      setCertPadraoMsg(`✓ Certificado ${mais.numero} (${mais.laboratorio}) — ${mais.itens.length} ponto(s)`)
    } catch { setCertPadraoMsg('Erro ao buscar certificado.') }
  }

  // Aplica correções do certificado do padrão à tabela de itens
  function aplicarCorrecoesDoCertPadrao() {
    if (!certPadrao?.itens?.length) return
    setItens(prev => prev.map((item, i) => {
      const linha = certPadrao.itens[i]
      if (!linha) return item
      const correcaoPadrao = linha.correcao
      const vr = parseN(item.valorReferencia)
      const c  = parseN(correcaoPadrao)
      const valorCorrigido = vr !== null && c !== null ? String((vr+c).toPrecision(6).replace(/\.?0+$/,'')) : undefined
      return { ...item, correcaoPadrao, valorCorrigido }
    }))
  }

  const aplicarCorrecoes = useCallback(() => {
    if (!certOCR) return
    const correcoes = parsearCorrecoesDeCertificado(certOCR)
    if (!correcoes.length) { alert('Nenhuma correção identificada.'); return }
    setItens(prev => prev.map((item,i) => {
      const c = correcoes[i]
      if (c === undefined) return item
      const correcaoPadrao = (c>=0?'+':'')+c
      const vr = parseN(item.valorReferencia)
      const valorCorrigido = vr !== null ? String((vr+c).toPrecision(6).replace(/\.?0+$/,'')) : undefined
      return { ...item, correcaoPadrao, valorCorrigido }
    }))
    alert(`${Math.min(correcoes.length,itens.length)} correções aplicadas.`)
  }, [certOCR, itens.length])

  async function handleCertPDF(file: File) {
    setCertLoading(true)
    try {
      const b64 = await fileToBase64(file)
      const res = await fetch('/api/importacao/ocr', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ imagemBase64:b64 }) })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setCertOCR(d.texto??'')
    } catch(e:unknown) { alert('Erro OCR certificado: '+String(e)) }
    finally { setCertLoading(false) }
  }

  async function salvar(itensFinal: ItemChecagem[]) {
    const eq = equips.find(e=>e.id===equipId)
    if (!eq) { alert('Selecione um equipamento.'); return }
    setSalvando(true)
    const proximaChecagem = addM(data, periodicidade)   // periodicidade já em meses
    const { validarChecagem } = await import('@/lib/checagens/validacao')
    const status = validarChecagem(itensFinal, proximaChecagem, resultadoGeral)
    try {
      const res = await fetch('/api/checagens', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          equipamentoId:eq.id, equipamentoTag:eq.tag,
          nomeInstrumento, laboratorio, numeroCertificado:numeroCert,
          dataCalibracaoRef:dataCalibRef, padraoTag,
          grupoId:eq.grupoId, subgrupoId:eq.subgrupoId,
          data, responsavel, tipoComparacao:tipoComp, papelReferencia:papelRef,
          resultadoGeral, periodicidade, proximaChecagem, fonte:tab,
          normaReferencia:normaRef||undefined, status, itens:itensFinal, obs:obs||undefined,
        }),
      })
      const saved = await res.json()
      if (saved.error) throw new Error(saved.error)
      router.push(`/checagens/${saved.id}`)
    } catch(e:unknown) { alert('Erro ao salvar: '+String(e)) }
    finally { setSalvando(false) }
  }

  async function handleExcel(file: File) {
    setLoading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/importacao/excel', { method:'POST', body:fd })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setExcelItens((d.itens??[]).map((item:ItemChecagem,i:number)=>({...item,ponto:i+1,valorReferencia:item.valorReferencia??'',valorMedido:item.valorMedido??''})))
    } catch(e:unknown) { alert('Erro Excel: '+String(e)) }
    finally { setLoading(false) }
  }

  async function handleOCR(file: File) {
    setLoading(true)
    try {
      const b64 = await fileToBase64(file)
      const res = await fetch('/api/importacao/ocr', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ imagemBase64:b64 }) })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setOcrTexto(d.texto??'')
    } catch(e:unknown) { alert('Erro OCR: '+String(e)) }
    finally { setLoading(false) }
  }

  const equip = equips.find(e=>e.id===equipId)

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">FOR 6405 · Rev 01</p>
          <h1 className="page-title">Registro de Checagem Intermediária</h1>
        </div>
        <div className="flex items-center gap-2">
          {(['manual','excel','ocr'] as Tab[]).map(t => (
            <button key={t} type="button" onClick={()=>setTab(t)}
              className={cn('px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                tab===t?'bg-[#141B28] text-white border border-white/10':'text-white/35 hover:text-white/60')}>
              {t==='manual'?'Manual':t==='excel'?'Excel':'OCR'}
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
            <select className="input" value={equipId} onChange={e=>handleEquipChange(e.target.value)}>
              <option value="">Selecione…</option>
              {equips.map(e=><option key={e.id} value={e.id}>{e.tag} — {e.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">TAG</label>
            <input className="input font-mono" value={equip?.tag??''} readOnly placeholder="Auto"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Instrumento de medição</label>
            <input className="input" value={nomeInstrumento} onChange={e=>setNomeInstrumento(e.target.value)} placeholder="Nome / descrição"/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Laboratório</label>
            <select className="input" value={laboratorio} onChange={e=>setLaboratorio(e.target.value)}>
              <option value="">Selecione…</option>
              {LABORATORIOS.map(g=>(
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.items.map(lab=><option key={lab} value={lab}>{lab}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Certificado de calibração n°</label>
            <input className="input font-mono" value={numeroCert} onChange={e=>setNumeroCert(e.target.value)} placeholder="ex: R0042-2025"/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Data calibração (padrão)</label>
            <input type="date" className="input" value={dataCalibRef} onChange={e=>setDataCalibRef(e.target.value)}/>
          </div>
        </div>

        <p className="form-section mb-4">Execução</p>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">TAG do padrão</label>
            <input className="input font-mono" value={padraoTag}
              onChange={e=>handlePadraoTagChange(e.target.value)} placeholder="ex: 1528EMC"/>
            {certPadraoMsg && (
              <p className={`text-[10px] mt-1 ${certPadrao?'text-green-400':'text-amber-400'}`}>{certPadraoMsg}</p>
            )}
            {certPadrao && (
              <button type="button" onClick={aplicarCorrecoesDoCertPadrao}
                className="mt-1.5 btn-primary text-[11px] py-1">
                <FileSearch size={11}/> Aplicar correções do certificado
              </button>
            )}
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Data da checagem</label>
            <input type="date" className="input" value={data} onChange={e=>setData(e.target.value)}/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Responsável</label>
            <input className="input" value={responsavel} onChange={e=>setResponsavel(e.target.value)} placeholder="Nome do técnico"/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Periodicidade (meses)</label>
            <input type="number" min={1} max={60} className="input" value={periodicidade} onChange={e=>setPeriodicidade(Number(e.target.value))}/>
          </div>
          <div>
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 block mb-1">Norma de referência</label>
            <input className="input" value={normaRef} onChange={e=>setNormaRef(e.target.value)} placeholder="ex: CISPR 15"/>
          </div>
        </div>

        {/* ── Método de comparação ── */}
        <div className="border border-white/8 rounded-xl p-4 space-y-4">
          <p className="text-[10px] font-mono tracking-[2px] uppercase text-white/40">Método de comparação</p>

          {/* Tipo */}
          <div className="flex gap-6">
            {(['direta','indireta'] as TipoComparacao[]).map(t=>(
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tipoComp" value={t} checked={tipoComp===t} onChange={()=>setTipoComp(t)} className="accent-gold"/>
                <span className="text-sm font-semibold text-white/80">{t==='direta'?'Direta':'Indireta'}</span>
                <span className="text-[11px] text-white/35">
                  {t==='direta' ? '— um gera, outro mede' : '— caixa preta gera, ambos medem'}
                </span>
              </label>
            ))}
          </div>

          {/* Papel da referência (só para direta) */}
          {tipoComp === 'direta' && (
            <div className="pl-4 border-l-2 border-gold/30">
              <p className="text-[10px] font-mono text-white/35 mb-2 uppercase tracking-wider">Papel da referência:</p>
              <div className="flex gap-6">
                <label className="flex items-start gap-2 cursor-pointer group">
                  <input type="radio" name="papelRef" value="gerador" checked={papelRef==='gerador'} onChange={()=>setPapelRef('gerador')} className="accent-gold mt-0.5"/>
                  <div>
                    <p className="text-sm text-white/80 font-medium group-hover:text-white">Referência gera</p>
                    <p className="text-[11px] text-white/35">Ajusta na ref → instrumento lê. Erro = MM − VR</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer group">
                  <input type="radio" name="papelRef" value="medidor" checked={papelRef==='medidor'} onChange={()=>setPapelRef('medidor')} className="accent-gold mt-0.5"/>
                  <div>
                    <p className="text-sm text-white/80 font-medium group-hover:text-white">Referência mede</p>
                    <p className="text-[11px] text-white/35">Ajusta no instrumento → ref mede. Erro = VN − VR</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {tipoComp === 'indireta' && (
            <div className="pl-4 border-l-2 border-teal/30 text-[11px] text-white/40">
              Caixa preta gera um sinal fixo → referência lê (VR) e instrumento checado lê (MM) simultaneamente.<br/>
              Erro = MM − Valor corrigido (VR + correção do certificado)
            </div>
          )}

          {/* Resultado */}
          <div className="pt-2 border-t border-white/6">
            <p className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 mb-2">Resultado geral</p>
            <div className="flex gap-5">
              {([['satisfatorio','Satisfatório','text-green-400'],['insatisfatorio','Insatisfatório','text-red-400'],['pendente','Pendente','text-white/40']] as [ResultadoGeral,string,string][]).map(([v,l,cls])=>(
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="resultGeral" value={v} checked={resultadoGeral===v} onChange={()=>setResultadoGeral(v)} className="accent-gold"/>
                  <span className={cn('text-sm',cls)}>{l}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Certificado PDF → correções automáticas ── */}
        {tipoComp === 'indireta' && (
          <div className="mt-4 pt-4 border-t border-white/6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] font-mono tracking-[2px] uppercase text-white/40">Certificado de calibração — extração de correções</p>
                <p className="text-[11px] text-white/25 mt-0.5">Carregue o PDF para extrair automaticamente as correções por ponto</p>
              </div>
              {certOCR && (
                <button type="button" onClick={aplicarCorrecoes} className="btn-primary text-xs">
                  <FileSearch size={12}/> Aplicar correções
                </button>
              )}
            </div>
            <input ref={certRef} type="file" accept=".pdf,image/*" className="hidden"
              onChange={e=>e.target.files?.[0]&&handleCertPDF(e.target.files[0])}/>
            <div className="flex items-center gap-3">
              <button type="button" onClick={()=>certRef.current?.click()} className="btn-secondary text-xs">
                {certLoading?<Loader2 size={12} className="animate-spin"/>:<Upload size={12}/>}
                {certLoading?'Lendo…':'Carregar PDF do certificado'}
              </button>
              {certOCR && (
                <span className="text-[11px] text-green-400">
                  ✓ {parsearCorrecoesDeCertificado(certOCR).length} correção(ões) identificada(s)
                </span>
              )}
            </div>
            {certOCR && (
              <details className="mt-2">
                <summary className="text-[10px] text-white/25 cursor-pointer hover:text-white/50">Ver texto extraído</summary>
                <pre className="mt-1 p-2 rounded-lg bg-black/20 text-[9px] text-white/35 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">{certOCR}</pre>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ── Tab Manual ── */}
      {tab === 'manual' && (
        <div className="card overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="form-section">Pontos de medição</p>
            <button type="button" onClick={addItem} className="btn-ghost text-xs"><Plus size={12}/> Linha</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: modo==='indireta'?900:650 }}>
              <TblHeader modo={modo}/>
              <tbody>
                {itens.map(item=>(
                  <ItemRow key={item.id} item={item} modo={modo}
                    onChange={i=>updateItem(item.id,i)}
                    onDelete={()=>removeItem(item.id)}/>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-white/5 flex items-center gap-3">
            <label className="text-[10px] font-mono tracking-[2px] uppercase text-white/40 flex-shrink-0">Obs. gerais</label>
            <input className="input flex-1 text-sm" value={obs} onChange={e=>setObs(e.target.value)} placeholder="Observações…"/>
          </div>
          <div className="px-4 py-3 border-t border-white/5 flex justify-end">
            <button type="button" onClick={()=>salvar(itens)} disabled={salvando} className="btn-primary">
              {salvando&&<Loader2 size={13} className="animate-spin"/>}
              <Save size={13}/> Registrar checagem
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Excel ── */}
      {tab==='excel'&&(
        <div className="card p-5 mb-4 space-y-4">
          <p className="form-section">Importar planilha .xlsx</p>
          <p className="text-[11px] text-white/40">A=Grandeza · B=Unidade · C=VR · D=MM · E=Resultado · F=Obs</p>
          <div className="flex gap-3">
            <input ref={excelRef} type="file" accept=".xlsx,.xls,.xltm" className="hidden"
              onChange={e=>e.target.files?.[0]&&handleExcel(e.target.files[0])}/>
            <button type="button" onClick={()=>excelRef.current?.click()} className="btn-secondary">
              {loading?<Loader2 size={13} className="animate-spin"/>:<Upload size={13}/>} Selecionar
            </button>
          </div>
          {excelItens.length>0&&(
            <>
              <div className="overflow-x-auto max-h-56">
                <table className="w-full">
                  <thead className="tbl-head"><tr><th>#</th><th>Grandeza</th><th>Unid.</th><th>VR</th><th>MM</th><th>Resultado</th></tr></thead>
                  <tbody>
                    {excelItens.map(i=>(
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
                <button type="button" onClick={()=>salvar(excelItens)} disabled={salvando} className="btn-primary">
                  {salvando&&<Loader2 size={13} className="animate-spin"/>} Confirmar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab OCR ── */}
      {tab==='ocr'&&(
        <div className="card p-5 mb-4 space-y-4">
          <p className="form-section">Importar via OCR</p>
          <div className="flex gap-3">
            <input ref={ocrRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={e=>e.target.files?.[0]&&handleOCR(e.target.files[0])}/>
            <button type="button" onClick={()=>ocrRef.current?.click()} className="btn-secondary">
              {loading?<Loader2 size={13} className="animate-spin"/>:<ScanText size={13}/>} Selecionar
            </button>
          </div>
          {ocrTexto&&(
            <>
              <textarea className="input h-40 resize-none font-mono text-xs" value={ocrTexto} onChange={e=>setOcrTexto(e.target.value)}/>
              <div className="flex justify-end">
                <button type="button" className="btn-primary" disabled={salvando}
                  onClick={()=>salvar([{id:uid(),ponto:1,grandeza:'OCR',unidade:'—',valorReferencia:'',valorMedido:ocrTexto,resultado:'na'}])}>
                  {salvando&&<Loader2 size={13} className="animate-spin"/>} Confirmar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
