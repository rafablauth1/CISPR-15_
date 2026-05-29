import type { LinhaCertificado } from '@/lib/certificados/tipos'

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.').trim())
  return isNaN(n) ? null : n
}

function fmtCorrecao(n: number): string {
  return (n >= 0 ? '+' : '') + n.toPrecision(4).replace(/\.?0+$/, '')
}

/**
 * Tenta extrair linhas de correção de um texto OCR de certificado de calibração.
 * Suporta múltiplos formatos comuns de certificados (DARE, CHOMA, IMETRO, etc).
 */
export function parsearCertificado(texto: string): LinhaCertificado[] {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const resultado: LinhaCertificado[] = []

  // ── Estratégia 1: detectar tabela com cabeçalho típico ──────────────────
  // Procura padrões como: Ponto | Nominal | Indicado | Correção | Incerteza
  let dentroTabela = false
  let colCorrecao  = -1
  let colNominal   = -1
  let colIndicado  = -1
  let colIncerteza = -1
  let ponto = 0

  for (const linha of linhas) {
    const norm = linha.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

    // Detecta cabeçalho da tabela
    if (!dentroTabela && (norm.includes('corre') || norm.includes('correction'))) {
      const colunas = linha.split(/\s{2,}|\t/).map(c => c.trim())
      colCorrecao  = colunas.findIndex(c => /corre/i.test(c.normalize('NFD').replace(/[̀-ͯ]/g, '')))
      colNominal   = colunas.findIndex(c => /nominal|padr|refer|vr\b/i.test(c.normalize('NFD').replace(/[̀-ͯ]/g, '')))
      colIndicado  = colunas.findIndex(c => /indic|lido|mm\b|medid/i.test(c.normalize('NFD').replace(/[̀-ͯ]/g, '')))
      colIncerteza = colunas.findIndex(c => /incert|U\b|uc\b/i.test(c))
      if (colCorrecao >= 0) { dentroTabela = true; continue }
    }

    if (dentroTabela) {
      const colunas = linha.split(/\s{2,}|\t/).map(c => c.trim())
      // Verifica se linha tem valores numéricos suficientes
      const nums = colunas.map(parseNum)
      const numCount = nums.filter(n => n !== null).length
      if (numCount < 2) {
        // Linha sem números: pode ser fim da tabela ou grandeza
        if (/[a-zA-ZÀ-ÿ]{4}/.test(linha) && !norm.includes('unid') && numCount === 0) {
          // Nova grandeza - mantém contexto
        }
        continue
      }

      ponto++
      const correcaoVal = colCorrecao >= 0 ? parseNum(colunas[colCorrecao] ?? '') : null
      const nominalVal  = colNominal  >= 0 ? parseNum(colunas[colNominal]  ?? '') : null
      const indicadoVal = colIndicado >= 0 ? parseNum(colunas[colIndicado] ?? '') : null
      const incerteza   = colIncerteza >= 0 ? (colunas[colIncerteza] ?? '') : ''

      // Se não achou a correção pela coluna, tenta calcular: Nominal - Indicado
      const correcao = correcaoVal ?? (
        nominalVal !== null && indicadoVal !== null ? nominalVal - indicadoVal : null
      )

      resultado.push({
        ponto,
        grandeza: '',
        unidade: '',
        valorNominal:  nominalVal !== null ? String(nominalVal) : (colunas[colNominal] ?? ''),
        valorIndicado: indicadoVal !== null ? String(indicadoVal) : (colunas[colIndicado] ?? ''),
        correcao: correcao !== null ? fmtCorrecao(correcao) : '',
        incertezaExpandida: incerteza,
        fatorCobertura: 2,
      })
    }
  }

  if (resultado.length > 0) return resultado

  // ── Estratégia 2: linha a linha buscando padrão "número ± número" ────────
  // Ex: "10 V  9.998  +0.002  ±0.005"
  const reValores = /([+-]?\d+[,.]?\d*(?:[eE][+-]?\d+)?)/g
  ponto = 0
  for (const linha of linhas) {
    const norm = linha.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    if (norm.includes('corre') || norm.includes('padr') || norm.includes('incert')) continue
    const nums = [...linha.matchAll(reValores)].map(m => parseFloat(m[1].replace(',', '.')))
    if (nums.length >= 3) {
      ponto++
      // Assume: [nominal, indicado, correção, incerteza]
      // Ou: [nominal, correção, incerteza]
      let nominalVal: number, indicadoVal: number | null = null, correcaoVal: number, incVal: number
      if (nums.length >= 4) {
        [nominalVal, indicadoVal, correcaoVal, incVal] = [nums[0], nums[1], nums[2], nums[3]]
      } else {
        [nominalVal, correcaoVal, incVal] = [nums[0], nums[1], nums[2]]
      }
      resultado.push({
        ponto,
        grandeza: '',
        unidade: '',
        valorNominal:  String(nominalVal),
        valorIndicado: indicadoVal !== null ? String(indicadoVal) : '',
        correcao: fmtCorrecao(correcaoVal!),
        incertezaExpandida: incVal !== undefined ? `±${incVal}` : '',
        fatorCobertura: 2,
      })
    }
  }

  return resultado
}

/**
 * Extrai metadados básicos do certificado (número, laboratório, data).
 */
export function parsearMetadadosCertificado(texto: string): {
  numero: string; laboratorio: string; dataEmissao: string
} {
  const linhas = texto.split(/\r?\n/)
  let numero = '', laboratorio = '', dataEmissao = ''

  for (const linha of linhas) {
    const norm = linha.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

    if (!numero && (norm.includes('certificado') || norm.includes('certificate') || norm.includes('n°') || norm.includes('n.'))) {
      const m = linha.match(/[A-Z]\d{3,6}[-/]\d{2,4}|[A-Z]{1,3}\s*\d{4,6}[-/]\d{2,4}|\d{5,8}[-/]\d{4}/)
      if (m) numero = m[0]
    }

    if (!laboratorio && (norm.includes('laborat') || norm.includes('lab ') || norm.includes('rnbc'))) {
      const parts = linha.split(/[:–-]/).map(s => s.trim()).filter(s => s.length > 3)
      if (parts.length > 1) laboratorio = parts[parts.length - 1].trim()
      else if (parts[0].length > 3) laboratorio = parts[0]
    }

    if (!dataEmissao) {
      const dateM = linha.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
      if (dateM && (norm.includes('emiss') || norm.includes('data') || norm.includes('date'))) {
        const [, d, m, y] = dateM
        dataEmissao = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
      }
    }
  }

  return { numero, laboratorio, dataEmissao }
}
