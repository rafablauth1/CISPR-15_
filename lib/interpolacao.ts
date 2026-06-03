/**
 * Motor de interpolação para correções de certificados de calibração.
 *
 * Suporta:
 *   - Interpolação linear simples (1 eixo: valor nominal × correção)
 *   - Interpolação bilinear (2 eixos: ex. frequência × nível → correção)
 *
 * Extrapolação: usa os valores extremos (clamping), não extrapola.
 */

export interface PontoCalibracaoSimples {
  valorNominal: number  // valor do eixo (ex: tensão, frequência)
  correcao: number
  incerteza?: number
}

export interface PontoCalibracao2D {
  eixo1: number   // ex: frequência em Hz
  eixo2: number   // ex: nível em dB
  correcao: number
  incerteza?: number
}

/** Clamp de valor dentro de um intervalo */
function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

/**
 * Interpolação linear entre dois pontos conhecidos.
 * Se x estiver fora do intervalo, usa o extremo mais próximo (sem extrapolação).
 */
export function interpolarLinear(
  x: number,
  pontos: PontoCalibracaoSimples[]
): number | null {
  if (!pontos.length) return null

  const sorted = [...pontos].sort((a, b) => a.valorNominal - b.valorNominal)

  // Fora do intervalo — usa extremo
  if (x <= sorted[0].valorNominal) return sorted[0].correcao
  if (x >= sorted[sorted.length - 1].valorNominal) return sorted[sorted.length - 1].correcao

  // Encontra o par vizinho
  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[i], p1 = sorted[i + 1]
    if (x >= p0.valorNominal && x <= p1.valorNominal) {
      const t = (x - p0.valorNominal) / (p1.valorNominal - p0.valorNominal)
      return p0.correcao + t * (p1.correcao - p0.correcao)
    }
  }

  return null
}

/**
 * Interpolação bilinear numa grade 2D.
 *
 * Algoritmo:
 *   1. Para cada valor único de eixo1 que envolve x1: interpola ao longo de eixo2 → valor intermediário
 *   2. Interpola os dois valores intermediários ao longo de eixo1 → correção final
 *
 * Se (x1, x2) estiver fora da grade, usa os extremos (sem extrapolação).
 */
export function interpolarBilinear(
  x1: number,
  x2: number,
  pontos: PontoCalibracao2D[]
): number | null {
  if (!pontos.length) return null

  // Eixos únicos ordenados
  const vals1 = [...new Set(pontos.map(p => p.eixo1))].sort((a, b) => a - b)
  const vals2 = [...new Set(pontos.map(p => p.eixo2))].sort((a, b) => a - b)

  if (!vals1.length || !vals2.length) return null

  // Clamp x1 e x2 dentro da grade
  const cx1 = clamp(x1, vals1[0], vals1[vals1.length - 1])
  const cx2 = clamp(x2, vals2[0], vals2[vals2.length - 1])

  // Acha os dois valores de eixo1 que envolvem cx1
  let i1lo = 0, i1hi = vals1.length - 1
  for (let i = 0; i < vals1.length - 1; i++) {
    if (cx1 >= vals1[i] && cx1 <= vals1[i + 1]) { i1lo = i; i1hi = i + 1; break }
  }

  // Para cada um dos dois valores de eixo1, interpola ao longo de eixo2
  function interpEixo2(e1val: number): number | null {
    const row = pontos
      .filter(p => p.eixo1 === e1val)
      .sort((a, b) => a.eixo2 - b.eixo2)
    if (!row.length) return null
    return interpolarLinear(cx2, row.map(p => ({ valorNominal: p.eixo2, correcao: p.correcao })))
  }

  const c_lo = interpEixo2(vals1[i1lo])
  const c_hi = interpEixo2(vals1[i1hi])

  if (c_lo === null || c_hi === null) return null

  // Se os dois extremos de eixo1 são iguais (ponto exato), retorna direto
  if (vals1[i1lo] === vals1[i1hi]) return c_lo

  const t = (cx1 - vals1[i1lo]) / (vals1[i1hi] - vals1[i1lo])
  return c_lo + t * (c_hi - c_lo)
}

/**
 * Extrai valores únicos de eixo1 e eixo2 de uma lista de pontos 2D.
 * Útil para montar a visualização da grade.
 */
export function extrairGrade(pontos: PontoCalibracao2D[]): {
  eixo1Vals: number[]
  eixo2Vals: number[]
  grade: Record<string, number | undefined>  // chave: "e1_e2"
} {
  const eixo1Vals = [...new Set(pontos.map(p => p.eixo1))].sort((a, b) => a - b)
  const eixo2Vals = [...new Set(pontos.map(p => p.eixo2))].sort((a, b) => a - b)
  const grade: Record<string, number | undefined> = {}
  for (const p of pontos) grade[`${p.eixo1}_${p.eixo2}`] = p.correcao
  return { eixo1Vals, eixo2Vals, grade }
}

/**
 * Parser específico para certificados RBC/LABELO (formato ABNT NBR ISO/IEC 17025).
 *
 * Estrutura esperada das tabelas:
 *   Frequência (GHz) | VR UST (dBm) | MM UMP (dBm) | IM (dB) | k | veff
 *
 * A correção é calculada como: Correção = VR_UST − MM_UMP
 * (o quanto a indicação do instrumento difere do valor de referência)
 *
 * Para certificados com múltiplas tabelas (diferentes níveis de VR),
 * gera uma grade 2D: eixo1 = frequência, eixo2 = nível VR.
 */
export function parsearCertificadoRBC(texto: string): {
  pontos: PontoCalibracao2D[]
  eixo1Nome: string; eixo1Unidade: string
  eixo2Nome: string; eixo2Unidade: string
  equipamentoTag: string; numeroCert: string
} {
  const norm = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const linhas = texto.split(/\n/)

  // Detecta TAG e número
  const tagM = texto.match(/TAG[:\s]+([A-Z0-9]{4,10}EMC)/i) ??
               texto.match(/\b(\d{4}EMC)\b/i)
  const certM = texto.match(/N[°º]\s*(R\d{4}\/\d{4})/i) ??
               texto.match(/(R\d{4}[/-]\d{4})/i)
  const equipamentoTag = tagM?.[1]?.toUpperCase() ?? ''
  const numeroCert     = certM?.[1] ?? ''

  // Detecta unidade do eixo1 (frequência)
  const isGHz = /ghz/i.test(texto)
  const isMHz = /mhz/i.test(texto)
  const eixo1Unidade = isGHz ? 'GHz' : isMHz ? 'MHz' : 'Hz'

  // Detecta unidade do eixo2 (nível)
  const eixo2Unidade = /dbm/i.test(texto) ? 'dBm' : /db/i.test(texto) ? 'dB' : ''

  const pontos: PontoCalibracao2D[] = []

  // Estratégia: lê linhas em grupos de 4-6 números
  // A tabela RBC tem colunas: freq | VR | MM | IM | k | veff
  // Cada "linha de dados" pode aparecer em múltiplas linhas de texto (OCR fragmentado)

  // Agrupa tokens numéricos por proximidade
  const tokens: number[] = []
  for (const linha of linhas) {
    const nums = linha.match(/[+-]?\d+[,.]?\d*/g)
    if (!nums) continue
    // Ignora linhas que parecem ser só anos/datas (ex: "2025")
    if (nums.length === 1 && parseInt(nums[0]) > 2000 && parseInt(nums[0]) < 2100) continue
    for (const n of nums) {
      const v = parseFloat(n.replace(',', '.'))
      if (!isNaN(v)) tokens.push(v)
    }
  }

  // Tenta identificar grupos de (freq, VR, MM, IM)
  // VR costuma ser constante dentro de uma tabela
  // A correção = VR - MM (VR_UST - MM_UMP)
  let i = 0
  while (i < tokens.length - 3) {
    const freq = tokens[i]
    const vr   = tokens[i + 1]
    const mm   = tokens[i + 2]
    const im   = tokens[i + 3]

    // Validações heurísticas para certificado de frequência/nível:
    // - freq entre 0.001 e 100 (GHz) ou 1 e 100000 (MHz)
    // - VR entre -60 e +30 (dBm)
    // - MM próximo de VR (erro esperado < 2 dB)
    // - IM (incerteza) pequena (< 5)
    const freqOk = freq > 0.001 && freq < 100000
    const vrOk   = vr >= -60 && vr <= 30
    const mmOk   = Math.abs(mm - vr) < 5
    const imOk   = im >= 0 && im < 5

    if (freqOk && vrOk && mmOk && imOk) {
      const correcao = parseFloat((vr - mm).toFixed(4))
      pontos.push({ eixo1: freq, eixo2: vr, correcao, incerteza: im })
      i += 4
      // Pula k e veff se existirem
      while (i < tokens.length && (tokens[i] === 2 || tokens[i] > 100)) i++
    } else {
      i++
    }
  }

  return {
    pontos,
    eixo1Nome: 'Frequência', eixo1Unidade,
    eixo2Nome: 'Nível',      eixo2Unidade,
    equipamentoTag, numeroCert,
  }
}

/**
 * Tenta parsear texto OCR de um certificado e extrair pontos de correção 2D.
 *
 * Heurística:
 *  - Detecta linhas com ≥3 números (eixo1, eixo2, correção)
 *  - Ignora linhas de cabeçalho (palavras longas dominantes)
 */
export function parsearTabelaCertificado2D(texto: string): PontoCalibracao2D[] {
  // Tenta primeiro o parser específico RBC
  const rbc = parsearCertificadoRBC(texto)
  if (rbc.pontos.length >= 3) return rbc.pontos

  const pontos: PontoCalibracao2D[] = []
  const linhas = texto.split(/\r?\n/).filter(l => l.trim())

  for (const linha of linhas) {
    // Extrai todos os números da linha (inclui decimais e negativos)
    const nums = linha.match(/[+-]?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?/g)
    if (!nums || nums.length < 3) continue

    const parsed = nums.map(n => parseFloat(n.replace(',', '.')))
    if (parsed.some(isNaN)) continue

    // Heurística: 3 números → (eixo1, eixo2, correção)
    //             4 números → (eixo1, eixo2, correção, incerteza)
    pontos.push({
      eixo1: parsed[0],
      eixo2: parsed[1],
      correcao: parsed[2],
      incerteza: parsed[3],
    })
  }

  return pontos
}
