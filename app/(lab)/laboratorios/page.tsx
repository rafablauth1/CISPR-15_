'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Check, Loader2, BadgeCheck } from 'lucide-react'
import type { LaboratorioCal } from '@/lib/laboratorios/registro'

export default function LaboratoriosPage() {
  const [labs, setLabs] = useState<LaboratorioCal[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    fetch('/api/laboratorios').then(r => r.json()).then(d => setLabs(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setCarregando(false))
  }, [])

  const set = (i: number, campo: keyof LaboratorioCal, val: string) => {
    setLabs(ls => ls.map((l, idx) => idx === i ? { ...l, [campo]: val } : l)); setSalvo(false)
  }
  const add = () => { setLabs(ls => [...ls, { cal: '', nome: '', modelo: '' }]); setSalvo(false) }
  const del = (i: number) => { setLabs(ls => ls.filter((_, idx) => idx !== i)); setSalvo(false) }

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
