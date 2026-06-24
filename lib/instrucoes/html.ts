import type { Bloco, DocumentoIT } from '@/lib/instrucoes/tipos'
import { diagramaParaSVG } from '@/lib/instrucoes/diagrama'

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Estilo inline (fonte/tamanho) de um bloco; vazio quando usa o padrão.
function estilo(b: Bloco): string {
  const p: string[] = []
  if (b.fonte) p.push(`font-family:'${b.fonte}',Arial,sans-serif`)
  if (b.tamanho) p.push(`font-size:${b.tamanho}pt`)
  return p.length ? ` style="${p.join(';')}"` : ''
}

function blocoHTML(b: Bloco): string {
  switch (b.tipo) {
    case 'h1': return `<p class="h1"${estilo(b)}>${b.numero ? `<span class="num">${esc(b.numero)}</span>` : ''}${esc(b.texto)}</p>`
    case 'h2': return `<p class="h2"${estilo(b)}>${b.numero ? `<span class="num">${esc(b.numero)}</span>` : ''}${esc(b.texto)}</p>`
    case 'h3': return `<p class="h3"${estilo(b)}>${b.numero ? `<span class="num">${esc(b.numero)}</span>` : ''}${esc(b.texto)}</p>`
    case 'p': return `<p class="par"${estilo(b)}>${esc(b.texto)}</p>`
    case 'destaque': return `<p class="destaque"${estilo(b)}><strong>${esc(b.termo)} – </strong>${esc(b.texto)}</p>`
    case 'ul': return `<ul class="lista"${estilo(b)}>${b.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
    case 'ol': return `<ol class="lista ol"${estilo(b)}>${b.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ol>`
    case 'img': return `<figure class="img">${b.src ? `<img src="${b.src}" alt="${esc(b.legenda)}"/>` : ''}${b.legenda ? `<figcaption>${esc(b.legenda)}</figcaption>` : ''}</figure>`
    case 'tabela': return `<table class="tbl"${estilo(b)}>${b.cabecalho.some(Boolean) ? `<thead><tr>${b.cabecalho.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${b.linhas.map(l => `<tr>${l.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    case 'definicoes': return `<div class="defs"${estilo(b)}>${b.itens.map(it => `<p><strong>${esc(it.sigla)}</strong>${it.sigla && it.definicao ? ' – ' : ''}${esc(it.definicao)}</p>`).join('')}</div>`
    case 'diagrama': return `<figure class="img">${diagramaParaSVG(b)}${b.legenda ? `<figcaption>${esc(b.legenda)}</figcaption>` : ''}</figure>`
    default: return ''
  }
}

/** Converte uma IT/PC em HTML A4 autossuficiente para geração de PDF. */
export function documentoITtoHTML(doc: DocumentoIT): string {
  const titulo = [doc.codigo, doc.titulo].filter(Boolean).join(' – ')
  const tipoLabel = doc.tipoDocumento === 'PC' ? 'PROCEDIMENTO DE CALIBRAÇÃO' : 'INSTRUÇÃO DE TRABALHO'
  const rodape = [
    doc.revisadoPor ? `Revisado por: ${esc(doc.revisadoPor)}` : '',
    doc.aprovadoPor ? `Aprovado por: ${esc(doc.aprovadoPor)}` : '',
  ].filter(Boolean).join(' – ')

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: 0; }
  .page { padding: 24px 40px 40px; }
  .cab { border-bottom: 2px solid #111; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-start; }
  .cab .marca { font-weight: bold; font-size: 9pt; line-height: 1.2; }
  .cab .marca .pucrs { color: #888; font-size: 7pt; }
  .cab .centro { text-align: center; }
  .cab .centro .tipo { font-weight: bold; font-size: 11pt; text-transform: uppercase; }
  .cab .centro .titulo { font-weight: bold; font-size: 11pt; }
  .cab .rev { color: #888; font-size: 8pt; text-align: right; white-space: nowrap; }
  .corpo { padding-top: 18px; }
  .corpo > * { margin: 0 0 10px; }
  .h1 { font-weight: bold; font-size: 11pt; margin-top: 16px; }
  .h2 { font-weight: bold; font-size: 10pt; margin-top: 12px; }
  .h3 { font-weight: bold; font-size: 10pt; margin-left: 24px; }
  .num { margin-right: 8px; }
  .par { font-size: 10pt; line-height: 1.5; text-align: justify; text-indent: 2em; }
  .destaque { font-size: 10pt; line-height: 1.5; text-align: justify; margin-left: 24px; }
  .lista { font-size: 10pt; margin-left: 48px; line-height: 1.5; }
  .lista li { text-align: justify; }
  .img { text-align: center; margin: 16px 0; }
  .img img { max-width: 100%; max-height: 360px; object-fit: contain; }
  .img figcaption { font-size: 9pt; font-style: italic; color: #777; margin-top: 4px; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .tbl th, .tbl td { border: 1px solid #aaa; padding: 4px 8px; text-align: left; }
  .tbl th { background: #f0f0f0; }
  .defs { font-family: 'Courier New', monospace; font-size: 10pt; }
  .defs p { margin: 0 0 2px; }
  .rodape { border-top: 1px solid #ccc; margin-top: 24px; padding-top: 6px; font-size: 8pt; color: #888; }
</style></head>
<body><div class="page">
  <div class="cab">
    <div class="marca">LABELO<div class="pucrs">PUCRS</div></div>
    <div class="centro"><div class="tipo">${tipoLabel}</div><div class="titulo">${esc(titulo)}</div></div>
    <div class="rev">Revisão ${esc(doc.revisao)} - ${esc(doc.dataRevisao)}</div>
  </div>
  <div class="corpo">${doc.blocos.map(blocoHTML).join('')}</div>
  ${rodape ? `<div class="rodape">${rodape}</div>` : ''}
</div></body></html>`
}
