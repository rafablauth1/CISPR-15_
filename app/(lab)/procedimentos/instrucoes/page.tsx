'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, FileText, Trash2, Download, Loader2 } from 'lucide-react'
import type { DocumentoIT } from '@/lib/instrucoes/tipos'
import { documentoITtoHTML } from '@/lib/instrucoes/html'

export default function InstrucoesPage() {
  const [docs, setDocs] = useState<DocumentoIT[]>([])
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/instrucoes').then(r => r.json()).then(d => setDocs(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function excluir(id: string) {
    if (!confirm('Excluir este documento?')) return
    await fetch(`/api/instrucoes/${id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  // Gera o PDF da IT direto da lista (mesmo caminho do editor) — só no app desktop.
  async function baixarPDF(doc: DocumentoIT) {
    setErro(''); setBaixandoId(doc.id)
    try {
      const html = documentoITtoHTML(doc)
      const base = [doc.tipoDocumento, doc.codigo, doc.titulo].filter(Boolean).join(' ') || 'instrucao'
      const filename = base.replace(/[\\/:"*?<>|]+/g, '_').replace(/\s+/g, '_') + '.pdf'
      const api = (window as unknown as { electronAPI?: { salvarPdfHtml?: Function; saveFollowupPdf?: Function } }).electronAPI
      const gerar = api?.salvarPdfHtml ?? api?.saveFollowupPdf
      if (!gerar) { setErro('Geração de PDF disponível apenas no aplicativo (desktop).'); return }
      const r = await gerar(html, filename, false)
      if (r && r.ok === false && !r.canceled) setErro(r.error || 'Falha ao gerar PDF.')
    } catch (e: unknown) {
      setErro(String(e))
    } finally {
      setBaixandoId(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Procedimentos · Documentos</p>
          <h1 className="page-title">Instruções de Trabalho / PCs</h1>
          <p className="page-sub">{docs.length} documento{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/procedimentos/instrucoes/novo" className="btn-primary">
          <Plus size={13} /> Novo documento
        </Link>
      </div>

      {erro && (
        <div className="mb-4 px-4 py-2.5 rounded-xl text-[12px]"
             style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
          {erro}
        </div>
      )}

      {docs.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <p className="text-white/25 text-sm">Nenhum documento cadastrado.</p>
          <Link href="/procedimentos/instrucoes/novo" className="btn-primary inline-flex">
            <Plus size={13} /> Criar primeiro documento
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {docs.map(doc => (
            <div key={doc.id}
              className="flex items-center gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(232,185,75,0.10)' }}>
                <FileText size={13} style={{ color: 'var(--accent,#E8B94B)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/procedimentos/instrucoes/${doc.id}`}
                  className="text-[13px] font-semibold text-white/85 hover:text-white truncate block">
                  {doc.codigo ? `${doc.codigo} – ` : ''}{doc.titulo}
                </Link>
                <p className="text-[10px] font-mono text-white/30">
                  {doc.tipoDocumento} · Rev. {doc.revisao} · {doc.dataRevisao || '—'}
                  {doc.revisadoPor && ` · ${doc.revisadoPor}`}
                </p>
              </div>
              <span className="text-[10px] text-white/25">{doc.blocos.length} bloco{doc.blocos.length !== 1 ? 's' : ''}</span>
              <button onClick={() => baixarPDF(doc)} disabled={baixandoId === doc.id}
                title="Baixar PDF"
                className="btn-secondary text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100">
                {baixandoId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                PDF
              </button>
              <Link href={`/procedimentos/instrucoes/${doc.id}`}
                className="btn-secondary text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                Editar
              </Link>
              <button onClick={() => excluir(doc.id)}
                className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
