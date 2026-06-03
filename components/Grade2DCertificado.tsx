'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, Trash2, Plus, ScanText, TableIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extrairTextoArquivo } from '@/lib/useOCR'
import {
  interpolarBilinear,
  parsearTabelaCertificado2D,
  parsearCertificadoRBC,
  extrairGrade,
  type PontoCalibracao2D,
} from '@/lib/interpolacao'

interface Props {
  eixo1Nome: string
  eixo1Unidade: string
  eixo2Nome: string
  eixo2Unidade: string
  pontos: PontoCalibracao2D[]
  onChange: (pontos: PontoCalibracao2D[]) => void
  onEixoChange: (campo: 'eixo1Nome'|'eixo1Unidade'|'eixo2Nome'|'eixo2Unidade', valor: string) => void
}

function uid() { return Math.random().toString(36).slice(2) }

export function Grade2DCertificado({
  eixo1Nome, eixo1Unidade, eixo2Nome, eixo2Unidade,
  pontos, onChange, onEixoChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading,   setLoading]   = useState(false)
  const [textoOCR,  setTextoOCR]  = useState('')
  const [aba,       setAba]       = useState<'tabela'|'grade'|'ocr'>('tabela')
  const [testE1,    setTestE1]    = useState('')
  const [testE2,    setTestE2]    = useState('')
  const [dragOver,  setDragOver]  = useState(false)

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => setDragOver(false), [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(file: File) {
    setLoading(true)
    try {
      const texto = await extrairTextoArquivo(file)
      setTextoOCR(texto)
      // Tenta parser RBC primeiro (preenche eixos automaticamente)
      const rbc = parsearCertificadoRBC(texto)
      if (rbc.pontos.length >= 3) {
        onChange(rbc.pontos)
        onEixoChange('eixo1Nome',    rbc.eixo1Nome)
        onEixoChange('eixo1Unidade', rbc.eixo1Unidade)
        onEixoChange('eixo2Nome',    rbc.eixo2Nome)
        onEixoChange('eixo2Unidade', rbc.eixo2Unidade)
        setAba('grade')
      } else {
        const detectados = parsearTabelaCertificado2D(texto)
        if (detectados.length) {
          onChange(detectados)
          setAba('grade')
        } else {
          setAba('ocr')
        }
      }
    } catch(e: unknown) { alert('Erro ao ler arquivo: ' + String(e)) }
    finally { setLoading(false) }
  }

  function aplicarOCR() {
    const rbc = parsearCertificadoRBC(textoOCR)
    if (rbc.pontos.length >= 3) {
      onChange(rbc.pontos)
      onEixoChange('eixo1Nome',    rbc.eixo1Nome)
      onEixoChange('eixo1Unidade', rbc.eixo1Unidade)
      onEixoChange('eixo2Nome',    rbc.eixo2Nome)
      onEixoChange('eixo2Unidade', rbc.eixo2Unidade)
      setAba('grade')
      return
    }
    const detectados = parsearTabelaCertificado2D(textoOCR)
    if (!detectados.length) { alert('Nenhum ponto identificado. Verifique o texto ou edite manualmente.'); return }
    onChange(detectados)
    setAba('grade')
  }

  function addPonto() {
    onChange([...pontos, { eixo1: 0, eixo2: 0, correcao: 0 }])
  }

  function updatePonto(idx: number, campo: keyof PontoCalibracao2D, val: string) {
    const next = pontos.map((p, i) => i === idx ? { ...p, [campo]: parseFloat(val) || 0 } : p)
    onChange(next)
  }

  function removePonto(idx: number) {
    onChange(pontos.filter((_, i) => i !== idx))
  }

  const correcaoTeste = (testE1 && testE2)
    ? interpolarBilinear(parseFloat(testE1), parseFloat(testE2), pontos)
    : null

  const { eixo1Vals, eixo2Vals, grade } = extrairGrade(pontos)
  const inp = 'input text-[11px] py-1 px-2 h-7 w-full'

  return (
    <div
      className={cn('card p-4 space-y-4 transition-all', dragOver && 'border-teal/50 bg-teal/3')}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <p className="form-section !pt-0 !pb-0">Grade de correção 2D — Interpolação bilinear</p>
          {dragOver && <p className="text-[11px] text-teal mt-1">Solte o arquivo para processar via OCR</p>}
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".pdf,image/*,.txt" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="btn-secondary text-xs py-1">
            {loading ? <Loader2 size={12} className="animate-spin"/> : <ScanText size={12}/>}
            {loading ? 'Lendo…' : 'OCR / arrastar arquivo'}
          </button>
          <button type="button" onClick={addPonto} className="btn-ghost text-xs py-1">
            <Plus size={12}/> Ponto
          </button>
        </div>
      </div>

      {/* Nomes dos eixos */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: `Eixo 1 — nome`,    val: eixo1Nome,    campo: 'eixo1Nome'    as const },
          { label: `Eixo 1 — unidade`, val: eixo1Unidade, campo: 'eixo1Unidade' as const },
          { label: `Eixo 2 — nome`,    val: eixo2Nome,    campo: 'eixo2Nome'    as const },
          { label: `Eixo 2 — unidade`, val: eixo2Unidade, campo: 'eixo2Unidade' as const },
        ].map(({ label, val, campo }) => (
          <div key={campo}>
            <label className="text-[9px] font-mono uppercase tracking-widest text-white/30 block mb-1">{label}</label>
            <input className="input text-xs py-1" value={val}
              onChange={e => onEixoChange(campo, e.target.value)}
              placeholder={label.includes('nome') ? 'ex: Frequência' : 'ex: MHz'} />
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-white/6 pb-0">
        {([['tabela','Tabela de pontos'],['grade','Visualização grade'],['ocr','Texto OCR']] as [typeof aba, string][]).map(([k,l])=>(
          <button key={k} type="button" onClick={()=>setAba(k)}
            className={cn('px-3 py-1.5 text-[11px] rounded-t-lg transition-all',
              aba===k ? 'bg-white/8 text-white border-b-2 border-gold' : 'text-white/35 hover:text-white/60')}>
            {l}
          </button>
        ))}
      </div>

      {/* Aba: Tabela de pontos */}
      {aba === 'tabela' && (
        <div className="overflow-x-auto max-h-64">
          {pontos.length === 0 ? (
            <p className="text-white/25 text-[12px] text-center py-6">
              Nenhum ponto. Use OCR ou adicione manualmente.
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="tbl-head">
                <tr>
                  <th>{eixo1Nome||'Eixo 1'} ({eixo1Unidade||'—'})</th>
                  <th>{eixo2Nome||'Eixo 2'} ({eixo2Unidade||'—'})</th>
                  <th>Correção</th>
                  <th>Incerteza U</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {pontos.map((p, i) => (
                  <tr key={i} className="tbl-row group/row">
                    <td><input className={inp} type="number" value={p.eixo1} onChange={e=>updatePonto(i,'eixo1',e.target.value)}/></td>
                    <td><input className={inp} type="number" value={p.eixo2} onChange={e=>updatePonto(i,'eixo2',e.target.value)}/></td>
                    <td><input className={inp} type="number" value={p.correcao} onChange={e=>updatePonto(i,'correcao',e.target.value)}/></td>
                    <td><input className={inp} type="number" value={p.incerteza??''} onChange={e=>updatePonto(i,'incerteza',e.target.value)} placeholder="—"/></td>
                    <td>
                      <button type="button" onClick={()=>removePonto(i)}
                        className="opacity-0 group-hover/row:opacity-100 text-white/25 hover:text-red-400 p-0.5 transition-all">
                        <Trash2 size={11}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Aba: Visualização grade */}
      {aba === 'grade' && (
        <div className="space-y-3">
          {eixo1Vals.length === 0 ? (
            <p className="text-white/25 text-[12px] text-center py-6">Sem pontos para visualizar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-[10px] font-mono border-collapse">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-white/30 border border-white/6">
                      {eixo1Nome||'E1'} \ {eixo2Nome||'E2'}
                    </th>
                    {eixo2Vals.map(e2 => (
                      <th key={e2} className="px-2 py-1 text-white/60 border border-white/6 whitespace-nowrap">
                        {e2} {eixo2Unidade}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eixo1Vals.map(e1 => (
                    <tr key={e1}>
                      <td className="px-2 py-1 text-white/60 border border-white/6 whitespace-nowrap font-bold">
                        {e1} {eixo1Unidade}
                      </td>
                      {eixo2Vals.map(e2 => {
                        const val = grade[`${e1}_${e2}`]
                        return (
                          <td key={e2} className={cn(
                            'px-2 py-1 text-center border border-white/6',
                            val !== undefined ? 'text-teal' : 'text-white/15'
                          )}>
                            {val !== undefined ? (val >= 0 ? '+' : '') + val.toPrecision(4) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Calculadora de interpolação */}
          {pontos.length > 0 && (
            <div className="border border-white/8 rounded-xl p-3 space-y-2">
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30">Teste de interpolação</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-white/50">{eixo1Nome||'Eixo 1'}:</label>
                  <input className="input font-mono text-xs py-1 w-24" type="number"
                    value={testE1} onChange={e=>setTestE1(e.target.value)}
                    placeholder={eixo1Unidade||'valor'} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-white/50">{eixo2Nome||'Eixo 2'}:</label>
                  <input className="input font-mono text-xs py-1 w-24" type="number"
                    value={testE2} onChange={e=>setTestE2(e.target.value)}
                    placeholder={eixo2Unidade||'valor'} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/50">Correção:</span>
                  <span className={cn('font-mono text-sm font-bold',
                    correcaoTeste !== null ? 'text-teal' : 'text-white/20')}>
                    {correcaoTeste !== null
                      ? (correcaoTeste >= 0 ? '+' : '') + correcaoTeste.toPrecision(4)
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aba: Texto OCR */}
      {aba === 'ocr' && (
        <div className="space-y-2">
          <textarea
            className="input font-mono text-xs h-40 resize-none"
            placeholder={'Cole o texto do certificado ou carregue via OCR acima...\n\nFormato esperado por linha: eixo1  eixo2  correção  [incerteza]\nEx: 50  -40  +0.12  0.05'}
            value={textoOCR}
            onChange={e => setTextoOCR(e.target.value)}
          />
          <div className="flex justify-end">
            <button type="button" onClick={aplicarOCR} className="btn-primary text-xs">
              <TableIcon size={12}/> Extrair tabela
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
