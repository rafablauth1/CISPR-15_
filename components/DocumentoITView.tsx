import type { CSSProperties } from 'react'
import type { Bloco, DocumentoIT } from '@/lib/instrucoes/tipos'

// Estilo de fonte por bloco (família + tamanho em pt). Mescla com o estilo base
// recebido, sem sobrescrever quando o bloco não define fonte/tamanho próprios.
function estiloBloco(b: Bloco, base?: CSSProperties): CSSProperties {
  const s: CSSProperties = { ...base }
  if (b.fonte) s.fontFamily = b.fonte
  if (b.tamanho) s.fontSize = `${b.tamanho}pt`
  return s
}

/** Documento IT/PC renderizado como página A4 branca (preview e impressão). */
export function DocumentoITView({ doc }: { doc: DocumentoIT }) {
  return (
    <div className="bg-white text-gray-900 rounded-xl shadow-2xl p-0 overflow-hidden"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt' }}>
      {/* Header */}
      <div className="border-b-2 border-gray-900 px-8 py-3 flex items-start justify-between">
        <div className="text-[9pt] font-bold leading-tight">
          <div>LABELO</div>
          <div className="text-[7pt] text-gray-500">PUCRS</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-[11pt] uppercase">
            {doc.tipoDocumento === 'PC' ? 'PROCEDIMENTO DE CALIBRAÇÃO' : 'INSTRUÇÃO DE TRABALHO'}
          </div>
          <div className="font-bold text-[11pt]">
            {[doc.codigo, doc.titulo].filter(Boolean).join(' – ')}
          </div>
        </div>
        <div className="text-[8pt] text-gray-500 text-right">
          Revisão {doc.revisao} - {doc.dataRevisao}
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-6 space-y-3">
        {doc.blocos.map(bloco => {
          switch (bloco.tipo) {
            case 'h1': return (
              <p key={bloco.id} className="font-bold text-[11pt] mt-4" style={estiloBloco(bloco)}>
                {bloco.numero && <span className="mr-2">{bloco.numero}</span>}{bloco.texto}
              </p>
            )
            case 'h2': return (
              <p key={bloco.id} className="font-bold text-[10pt] mt-3" style={estiloBloco(bloco)}>
                {bloco.numero && <span className="mr-2">{bloco.numero}</span>}{bloco.texto}
              </p>
            )
            case 'h3': return (
              <p key={bloco.id} className="font-bold text-[10pt] ml-8" style={estiloBloco(bloco)}>
                {bloco.numero && <span className="mr-2">{bloco.numero}</span>}{bloco.texto}
              </p>
            )
            case 'p': return (
              <p key={bloco.id} className="text-[10pt] leading-relaxed"
                style={estiloBloco(bloco, { textAlign: 'justify', textIndent: '2em' })}>
                {bloco.texto}
              </p>
            )
            case 'destaque': return (
              <p key={bloco.id} className="text-[10pt] leading-relaxed ml-8"
                style={estiloBloco(bloco, { textAlign: 'justify' })}>
                <strong>{bloco.termo} – </strong>{bloco.texto}
              </p>
            )
            case 'ul': return (
              <ul key={bloco.id} className="ml-16 space-y-1" style={estiloBloco(bloco)}>
                {bloco.itens.map((item, i) => (
                  <li key={i} className="text-[10pt] flex gap-2">
                    <span>•</span><span style={{ textAlign: 'justify' }}>{item}</span>
                  </li>
                ))}
              </ul>
            )
            case 'ol': return (
              <ol key={bloco.id} className="ml-8 space-y-1" style={estiloBloco(bloco)}>
                {bloco.itens.map((item, i) => (
                  <li key={i} className="text-[10pt] flex gap-3">
                    <span className="flex-shrink-0">{i + 1})</span>
                    <span style={{ textAlign: 'justify' }}>{item}</span>
                  </li>
                ))}
              </ol>
            )
            case 'img': return (
              <div key={bloco.id} className="flex flex-col items-center gap-2 my-4">
                {bloco.src && <img src={bloco.src} alt={bloco.legenda} className="max-w-full max-h-56 object-contain" />}
                {bloco.legenda && <p className="text-[9pt] text-center italic text-gray-500">{bloco.legenda}</p>}
              </div>
            )
            case 'tabela': return (
              <table key={bloco.id} className="w-full text-[9pt] border-collapse my-2" style={estiloBloco(bloco)}>
                {bloco.cabecalho.some(Boolean) && (
                  <thead>
                    <tr>{bloco.cabecalho.map((h, i) => <th key={i} className="border border-gray-400 px-2 py-1 text-left bg-gray-100">{h}</th>)}</tr>
                  </thead>
                )}
                <tbody>
                  {bloco.linhas.map((linha, r) => (
                    <tr key={r}>{linha.map((c, i) => <td key={i} className="border border-gray-300 px-2 py-1">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )
            case 'definicoes': return (
              <div key={bloco.id} className="space-y-0.5 my-2" style={estiloBloco(bloco)}>
                {bloco.itens.map((item, i) => (
                  <p key={i} className="text-[10pt] font-mono">
                    <strong>{item.sigla}</strong>{item.sigla && item.definicao ? ' – ' : ''}{item.definicao}
                  </p>
                ))}
              </div>
            )
            default: return null
          }
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-300 px-8 py-2 flex justify-between text-[8pt] text-gray-500">
        <span>
          {doc.revisadoPor && `Revisado por: ${doc.revisadoPor}`}
          {doc.revisadoPor && doc.aprovadoPor && ' – '}
          {doc.aprovadoPor && `Aprovado por: ${doc.aprovadoPor}`}
        </span>
      </div>
    </div>
  )
}
