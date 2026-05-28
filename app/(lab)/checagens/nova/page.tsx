'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Upload, ScanText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addM } from '@/lib/utils'
import type { EquipamentoEMC } from '@/lib/equipamentos/tipos'
import type { ItemChecagem } from '@/lib/checagens/tipos'
import { TEMPLATES } from '@/lib/checagens/templates'
import { fileToBase64 } from '@/lib/utils'

type Tab = 'manual' | 'excel' | 'ocr'

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function itemFromTemplate(desc: string, unidade: string, min?: number, max?: number): ItemChecagem {
  return { id: uid(), descricao: desc, valorMedido: '', unidade, criterioMin: min, criterioMax: max, resultado: 'na' }
}

export default function NovaChecagemPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('manual')
  const [equips, setEquips] = useState<EquipamentoEMC[]>([])
  const [equipId, setEquipId] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [responsavel, setResponsavel] = useState('')
  const [periodicidade, setPeriodicidade] = useState(90)
  const [normaRef, setNormaRef] = useState('')
  const [itens, setItens] = useState<ItemChecagem[]>([])
  const [salvando, setSalvando] = useState(false)
  const [excelItens, setExcelItens] = useState<ItemChecagem[]>([])
  const [excelLoading, setExcelLoading] = useState(false)
  const [ocrTexto, setOcrTexto] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const excelRef = useRef<HTMLInputElement>(null)
  const ocrRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/equipamentos').then(r => r.json()).then(e => {
      setEquips(Array.isArray(e) ? e : [])
    }).catch(() => {})
  }, [])

  function handleEquipChange(id: string) {
    setEquipId(id)
    const eq = equips.find(e => e.id === id)
    if (!eq) return
    const tpl = TEMPLATES[eq.subgrupoId]
    if (tpl) {
      setPeriodicidade(tpl.periodicidadePadrao)
      setItens(tpl.itens.map(i => itemFromTemplate(i.descricao, i.unidade, i.criterioMin, i.criterioMax)))
    }
  }

  function addItem() {
    setItens(prev => [...prev, { id: uid(), descricao: '', valorMedido: '', unidade: '', resultado: 'na' }])
  }

  function removeItem(id: string) { setItens(prev => prev.filter(i => i.id !== id)) }

  function updateItem(id: string, field: keyof ItemChecagem, value: unknown) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  async function salvar(itensFinal: ItemChecagem[]) {
    const eq = equips.find(e => e.id === equipId)
    if (!eq) { alert('Selecione um equipamento.'); return }
    if (!data) { alert('Informe a data.'); return }
    setSalvando(true)
    const proximaChecagem = addM(data, Math.round(periodicidade / 30))
    try {
      const res = await fetch('/api/checagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipamentoId: eq.id,
          equipamentoTag: eq.tag,
          grupoId: eq.grupoId,
          subgrupoId: eq.subgrupoId,
          data,
          responsavel,
          periodicidade,
          proximaChecagem,
          fonte: tab,
          normaReferencia: normaRef || undefined,
          itens: itensFinal,
        }),
      })
      const saved = await res.json()
      if (saved.error) throw new Error(saved.error)
      router.push(`/checagens/${saved.id}`)
    } catch (e: unknown) {
      alert('Erro ao salvar: ' + String(e))
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcel(file: File) {
    setExcelLoading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/importacao/excel', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setExcelItens(data.itens ?? [])
    } catch (e: unknown) {
      alert('Erro ao ler Excel: ' + String(e))
    } finally {
      setExcelLoading(false)
    }
  }

  async function handleOCR(file: File) {
    setOcrLoading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/importacao/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagemBase64: base64 }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setOcrTexto(data.texto ?? '')
    } catch (e: unknown) {
      alert('Erro no OCR: ' + String(e))
    } finally {
      setOcrLoading(false)
    }
  }

  const equip = equips.find(e => e.id === equipId)

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Checagens</p>
          <h1 className="page-title">Nova checagem</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-black/20 rounded-xl border border-white/6 w-fit mb-6">
        {(['manual', 'excel', 'ocr'] as Tab[]).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-[#141B28] text-white border border-white/10' : 'text-white/35 hover:text-white/60',
            )}>
            {t === 'manual' ? 'Manual' : t === 'excel' ? 'Importar Excel' : 'OCR'}
          </button>
        ))}
      </div>

      {/* Campos comuns */}
      <div className="card p-5 mb-5">
        <p className="form-section mb-4">Dados da checagem</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono block mb-1">Equipamento</label>
            <select className="input" value={equipId} onChange={e => handleEquipChange(e.target.value)}>
              <option value="">Selecione…</option>
              {equips.map(e => (
                <option key={e.id} value={e.id}>{e.tag} — {e.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono block mb-1">Data</label>
            <input type="date" className="input" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono block mb-1">Responsável</label>
            <input className="input" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do técnico" />
          </div>
          <div>
            <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono block mb-1">Periodicidade (dias)</label>
            <input type="number" className="input" value={periodicidade} onChange={e => setPeriodicidade(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono block mb-1">Norma de referência</label>
            <input className="input" value={normaRef} onChange={e => setNormaRef(e.target.value)} placeholder="Ex: CISPR 15" />
          </div>
        </div>
      </div>

      {/* Tab: Manual */}
      {tab === 'manual' && (
        <div className="card overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="form-section">Itens de verificação</p>
            <button type="button" onClick={addItem} className="btn-ghost text-xs">
              <Plus size={12} /> Adicionar item
            </button>
          </div>
          {itens.length === 0 ? (
            <p className="text-white/25 text-sm py-8 text-center">
              {equip ? 'Nenhum template — adicione itens manualmente.' : 'Selecione um equipamento para carregar o template.'}
            </p>
          ) : (
            <table className="w-full">
              <thead className="tbl-head">
                <tr>
                  <th>Descrição</th>
                  <th>Valor medido</th>
                  <th>Unidade</th>
                  <th>Mín.</th>
                  <th>Máx.</th>
                  <th>Resultado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itens.map(item => (
                  <tr key={item.id} className="tbl-row">
                    <td>
                      <input className="input text-xs py-1" value={item.descricao}
                        onChange={e => updateItem(item.id, 'descricao', e.target.value)} />
                    </td>
                    <td>
                      <input className="input text-xs py-1 w-24" value={item.valorMedido}
                        onChange={e => updateItem(item.id, 'valorMedido', e.target.value)} />
                    </td>
                    <td>
                      <input className="input text-xs py-1 w-20" value={item.unidade}
                        onChange={e => updateItem(item.id, 'unidade', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" className="input text-xs py-1 w-20"
                        value={item.criterioMin ?? ''} onChange={e => updateItem(item.id, 'criterioMin', e.target.value ? Number(e.target.value) : undefined)} />
                    </td>
                    <td>
                      <input type="number" className="input text-xs py-1 w-20"
                        value={item.criterioMax ?? ''} onChange={e => updateItem(item.id, 'criterioMax', e.target.value ? Number(e.target.value) : undefined)} />
                    </td>
                    <td>
                      <select className="input text-xs py-1 w-20" value={item.resultado}
                        onChange={e => updateItem(item.id, 'resultado', e.target.value)}>
                        <option value="na">N/A</option>
                        <option value="ok">OK</option>
                        <option value="nok">NOK</option>
                      </select>
                    </td>
                    <td>
                      <button type="button" onClick={() => removeItem(item.id)}
                        className="text-white/20 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-4 py-3 border-t border-white/5 flex justify-end">
            <button type="button" onClick={() => salvar(itens)} disabled={salvando}
              className="btn-primary">
              {salvando ? <Loader2 size={13} className="animate-spin" /> : null}
              Salvar checagem
            </button>
          </div>
        </div>
      )}

      {/* Tab: Excel */}
      {tab === 'excel' && (
        <div className="card p-5 mb-5 space-y-4">
          <p className="form-section">Importar arquivo .xlsx</p>
          <div className="flex items-center gap-3">
            <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && handleExcel(e.target.files[0])} />
            <button type="button" onClick={() => excelRef.current?.click()} className="btn-secondary">
              {excelLoading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Selecionar arquivo
            </button>
            <p className="text-[11px] text-white/35">
              Colunas: A=Descrição, B=Valor, C=Unidade, D=Mín, E=Máx
            </p>
          </div>
          {excelItens.length > 0 && (
            <>
              <div className="overflow-auto max-h-64">
                <table className="w-full">
                  <thead className="tbl-head">
                    <tr><th>Descrição</th><th>Valor</th><th>Unidade</th><th>Mín</th><th>Máx</th></tr>
                  </thead>
                  <tbody>
                    {excelItens.map(i => (
                      <tr key={i.id} className="tbl-row">
                        <td>{i.descricao}</td>
                        <td className="font-mono text-[11px]">{i.valorMedido}</td>
                        <td className="font-mono text-[11px]">{i.unidade}</td>
                        <td className="font-mono text-[11px]">{i.criterioMin ?? '—'}</td>
                        <td className="font-mono text-[11px]">{i.criterioMax ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => salvar(excelItens)} disabled={salvando} className="btn-primary">
                  {salvando ? <Loader2 size={13} className="animate-spin" /> : null}
                  Confirmar e salvar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: OCR */}
      {tab === 'ocr' && (
        <div className="card p-5 mb-5 space-y-4">
          <p className="form-section">Importar via OCR</p>
          <div className="flex items-center gap-3">
            <input ref={ocrRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={e => e.target.files?.[0] && handleOCR(e.target.files[0])} />
            <button type="button" onClick={() => ocrRef.current?.click()} className="btn-secondary">
              {ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />}
              Selecionar imagem / PDF
            </button>
          </div>
          {ocrTexto && (
            <>
              <div>
                <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono block mb-1">
                  Texto extraído (editável)
                </label>
                <textarea className="input h-40 resize-none font-mono text-xs" value={ocrTexto}
                  onChange={e => setOcrTexto(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <button type="button" className="btn-primary" disabled={salvando}
                  onClick={() => salvar([{ id: uid(), descricao: 'Resultado OCR', valorMedido: ocrTexto, unidade: '—', resultado: 'na' }])}>
                  {salvando ? <Loader2 size={13} className="animate-spin" /> : null}
                  Confirmar e salvar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
