'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Save, Check, Loader2, BadgeCheck, Upload } from 'lucide-react'
import type { LaboratorioCal } from '@/lib/laboratorios/registro'
import { extrairAcreditacao, identificarLaboratorio, extrairNomeLaboratorio } from '@/lib/certificados/extrair-generico'
import { fileToBase64 } from '@/lib/utils'

const normCal = (c: string) => `CAL ${(c.match(/\d{3,4}/) || [''])[0]}`

export default function LaboratoriosPage() {
  const [labs, setLabs] = useState<LaboratorioCal[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [importando, setImportando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/laboratorios').then(r => r.json()).then(d => setLabs(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setCarregando(false))
  }, [])

  const set = (i: number, campo: keyof LaboratorioCal, val: string) => {
    setLabs(ls => ls.map((l, idx) => idx === i ? { ...l, [campo]: val } : l)); setSalvo(false)
  }
  const add = () => { setLabs(ls => [...ls, { cal: '', nome: '', modelo: '' }]); setSalvo(false) }
  const del = (i: number) => { setLabs(ls => ls.filter((_, idx) => idx !== i)); setSalvo(false) }

  /* Cadastro via UPLOAD: lê os PDFs, extrai o CAL (selinho de acreditação) e o
     nome do laboratório emissor, e associa CAL → nome no registro. */
  async function importarCertificados(files: FileList) {
    const api = (window as unknown as { electronAPI?: { extractPdfText?: (b: string) => Promise<{ text?: string }> } }).electronAPI
    if (!api?.extractPdfText) { alert('Disponível apenas no aplicativo.'); return }
    setImportando(true)
    try {
      const achados = new Map<string, string>()   // CAL → melhor nome encontrado
      let lidos = 0, semCal = 0
      for (const f of Array.from(files)) {
        if (!f.name.toLowerCase().endsWith('.pdf')) continue
        lidos++
        try {
          const res = await api.extractPdfText(await fileToBase64(f))
          const texto = res?.text || ''
          const cal = extrairAcreditacao(texto)
          if (!cal) { semCal++; continue }
          const k = normCal(cal)
          const nome = identificarLaboratorio(texto, cal) || extrairNomeLaboratorio(texto) || ''
          if (!achados.has(k) || (!achados.get(k) && nome)) achados.set(k, nome)
        } catch { semCal++ }
      }
      // merge no estado atual (não sobrescreve nome já preenchido)
      const map = new Map(labs.map(l => [normCal(l.cal), { ...l }]))
      let add = 0, upd = 0
      for (const [cal, nome] of achados) {
        const ex = map.get(cal)
        if (ex) { if (!ex.nome && nome) { ex.nome = nome; upd++ } }
        else { map.set(cal, { cal, nome, modelo: '' }); add++ }
      }
      setLabs([...map.values()]); setSalvo(false)
      alert(
        `${lidos} certificado(s) lido(s).\n` +
        `CAL novos: ${add} · atualizados: ${upd}` +
        (semCal ? `\nSem CAL (escaneado/ilegível): ${semCal}` : '') +
        `\n\nRevise os nomes e clique em Salvar.`
      )
    } finally { setImportando(false) }
  }

  async function salvar() {
    setSalvando(true)
    try {
      const r = await fetch('/api/laboratorios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(labs) })
      if (r.ok) { const d = await r.json(); setLabs(Array.isArray(d) ? d : labs); setSalvo(true); setTimeout(() => setSalvo(false), 2500) }
      else alert('Falha ao salvar.')
    } finally { setSalvando(false) }
  }

  if (carregando) return <div className="card p-10 text-center text-white/30 text-sm"><Loader2 className="animate-spin inline mr-2" size={16}/> Carregando…</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Laboratório · Qualidade</p>
          <h1 className="page-title flex items-center gap-2"><BadgeCheck size={20} className="text-teal"/> Laboratórios de Calibração</h1>
          <p className="page-sub">Acreditação (CAL do selo azul) → laboratório. Novos labs aparecem aqui automaticamente na importação.</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) importarCertificados(e.target.files); e.target.value = '' }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={importando} className="btn-secondary"
            title="Ler PDFs de certificados e associar o CAL (selo de acreditação) ao nome do laboratório emissor">
            {importando ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13}/>}
            {importando ? 'Lendo…' : 'Importar certificados'}
          </button>
          <button type="button" onClick={add} className="btn-secondary"><Plus size={13}/> Laboratório</button>
          <button type="button" onClick={salvar} disabled={salvando} className="btn-primary">
            {salvando ? <Loader2 size={13} className="animate-spin"/> : salvo ? <Check size={13}/> : <Save size={13}/>}
            {salvando ? 'Salvando…' : salvo ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="tbl-head">
            <tr>
              <th className="w-28">Acreditação</th>
              <th className="w-72">Nome do laboratório</th>
              <th>Modelo de PDF / observações</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {labs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-white/25 text-sm">Nenhum laboratório. Adicione um ou importe certificados.</td></tr>}
            {labs.map((l, i) => (
              <tr key={i} className="tbl-row">
                <td><input className="input font-mono text-[12px] py-1 w-24 uppercase" placeholder="CAL 0024" value={l.cal} onChange={e => set(i, 'cal', e.target.value)} /></td>
                <td><input className="input text-[12px] py-1 w-full" placeholder="ex.: Trescal, Metroquality…" value={l.nome} onChange={e => set(i, 'nome', e.target.value)} /></td>
                <td><input className="input text-[12px] py-1 w-full" placeholder="layout da tabela, particularidades do OCR…" value={l.modelo ?? ''} onChange={e => set(i, 'modelo', e.target.value)} /></td>
                <td><button type="button" onClick={() => del(i)} className="text-white/25 hover:text-red-400 p-1"><Trash2 size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-white/30 px-1 mt-3">
        Dica: o número <b>CAL XXXX</b> vem do selo azul de acreditação (NBR ISO/IEC 17025) impresso no certificado.
        Na importação, todo CAL novo é cadastrado aqui automaticamente — depois é só dar o nome.
      </p>
    </div>
  )
}
