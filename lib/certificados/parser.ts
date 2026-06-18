import type { LinhaCertificado } from '@/lib/certificados/tipos'

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.').trim())
  return isNaN(n) ? null : n
}

function fmtCorrecao(n: number): string {
  return (n >= 0 ? '+' : '') + n.toPrecision(4).replace(/\.?0+$/, '')
}

/** Só a grandeza do cabeçalho, cortando no primeiro traço.
 *  Ex.: "Medição de nível - coaxial 50Ω" → "Medição de nível" */
function soGrandeza(s: string): string {
  return (s || '').split(/\s*[-–—]\s*/)[0].trim()
}

/**
 * Tenta extrair linhas de correção de um texto OCR de certificado de calibração.
 * Suporta múltiplos formatos comuns de certificados (DARE, CHOMA, IMETRO, etc).
 */
/* Casa VR↔MM SEMPRE por colunas de mesma grandeza (unidade entre parênteses).
   A unidade da MM define o ensaio; o erro = VR − MM. Evita o caso de pegar a
   coluna de frequência (GHz/MHz) como VR e subtrair de uma MM em dBm. */
function parsearCertificadoVRMM(linhasRaw: string[]): LinhaCertificado[] {
  const linhas = linhasRaw.map(l => l.replace(/ /g, ' '))
  const reUnidade = /\(([^)]+)\)/
  const ehParam   = (l: string) => /^par[âa]metro\b/i.test(l.trim())
  const ehLegenda = (l: string) =>
    /unidade da grandeza|^\s*UMP\s*[-–]|^\s*UST\s*[-–]|^\s*VR\s*\(unidade|^\s*MM\s*\(unidade|^\s*IM\s*\(unidade/i.test(l)
  const numToken = /[≥≤><≈~]?\s*[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?|[+-]?\d+(?:\.\d+)?/g
  const parseN = (s: string): number | null => {
    let t = String(s).replace(/[≥≤><≈~\s]/g, '')
    if (!t || /^[-—–∞]+$/.test(t)) return null
    if (t.includes(',')) t = t.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
    const n = parseFloat(t)
    return isFinite(n) ? n : null
  }
  const extrairNums = (l: string): { n: number; dec: number }[] => {
    const out: { n: number; dec: number }[] = []
    const m = l.match(numToken)
    if (m) for (const tk of m) { const n = parseN(tk); if (n !== null) { const d = tk.match(/,(\d+)/); out.push({ n, dec: d ? d[1].length : 0 }) } }
    return out
  }
  const near2     = (x: number) => x >= 1.9 && x <= 2.35      // fator k típico (2,00 / 2,07)
  const temLetras = (l: string) => /[a-zA-ZÀ-ÿ]{4,}/.test(l) // linha de rótulo/legenda
  // GRANDEZA = cabeçalho "Medição de …" antes da tabela; "Parâmetro:" = nome da tabela
  const reGrand   = /^medi[çc][ãa]o\s+de\b|^medi[çc][õo]es\s+de\b|^calibra[çc][ãa]o\s+de\b/i

  const inicios: number[] = []
  const grandezaDe: Record<number, string> = {}
  let curG = ''
  linhas.forEach((l, i) => {
    const t = l.trim()
    if (reGrand.test(t)) curG = soGrandeza(t)
    if (ehParam(l)) { inicios.push(i); grandezaDe[i] = curG }
  })

  const res: LinhaCertificado[] = []
  let pnt = 0
  for (let s = 0; s < inicios.length; s++) {
    const ini = inicios[s]
    let fim = s + 1 < inicios.length ? inicios[s + 1] : linhas.length
    for (let i = ini; i < fim; i++) { if (ehLegenda(linhas[i])) { fim = i; break } }
    const bloco = linhas.slice(ini, fim)
    const parametro = (bloco[0].replace(/^par[âa]metro\s*:?\s*/i, '') || '').trim()
    const grandeza = grandezaDe[ini] || parametro

    // unidade da grandeza (a MM define) — UMP (xxx); evita pegar a freq (GHz/MHz)
    const headerTxt = bloco.slice(0, 14).join(' ')
    const unidMM = (headerTxt.match(/UMP\s*\(([^)]+)\)/i)?.[1]
      || headerTxt.match(/UST\s*\((?!GHz|MHz|kHz|Hz)([^)]+)\)/i)?.[1] || '').trim()

    // dados: ancora no fator k (≈2,00). [freq…, VR, MM, IM, k, veff] →
    //   VR, MM, IM são as 3 colunas antes do k. Erro = VR − MM.
    let buf: { n: number; dec: number }[] = []
    for (let i = 1; i < bloco.length; i++) {
      const raw = bloco[i].trim()
      if (!raw) continue
      const nums = extrairNums(raw)
      if (temLetras(raw) && nums.length < 3) { buf = []; continue } // rótulo/config → reinicia
      if (nums.length === 0) continue
      buf.push(...nums)
      let kIdx = -1
      if (buf.length >= 1 && near2(buf[buf.length - 1].n)) kIdx = buf.length - 1
      else if (buf.length >= 2 && near2(buf[buf.length - 2].n)) kIdx = buf.length - 2
      if (kIdx >= 3) {
        const vr = buf[kIdx - 3].n, mm = buf[kIdx - 2].n, im = buf[kIdx - 1].n
        if (isFinite(vr) && isFinite(mm)) {
          pnt++
          // alinha MM e correção ao nº de casas decimais do VR (mesma grandeza)
          const casas = Math.max(buf[kIdx - 3].dec, buf[kIdx - 2].dec)
          const corr = vr - mm
          res.push({
            ponto: pnt,
            grandeza,
            unidade: unidMM,
            valorNominal: vr.toFixed(casas),
            valorIndicado: mm.toFixed(casas),
            correcao: (corr >= 0 ? '+' : '') + corr.toFixed(casas),
            incertezaExpandida: isFinite(im) ? `±${im}` : '',
            fatorCobertura: 2,
          })
        }
        buf = []
      } else if (buf.length > 10) { buf = [] }
    }
  }
  return res
}

export function parsearCertificado(texto: string): LinhaCertificado[] {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const resultado: LinhaCertificado[] = []

  // ── Estratégia 0 (prioritária): formato LABELO/RNBC com colunas VR/MM e
  //    unidade entre parênteses — casa VR e MM pela mesma grandeza. ─────────
  const vrmm = parsearCertificadoVRMM(texto.split(/\r?\n/))
  if (vrmm.length > 0) return vrmm

  // ── Estratégia 1: formato tabulado com marcadores Python (# GRANDEZA / # PARAM / # HEADERS) ──
  const hasMarkers = linhas.some(l => l.startsWith('# GRANDEZA:') || l.startsWith('# PARAM:') || l.startsWith('# HEADERS:'))
  if (hasMarkers) {
    let curGrandeza = ''
    let curParam    = ''
    let vrIdx = -1, mmIdx = -1, imIdx = -1
    let freqBased   = false   // col[0] é frequência (ex: (MHz)) → usar como nominal
    let ponto = 0

    const parseNum2 = (s: string) => {
      // Remove operadores de comparação (≥13,8 → 13,8) e caracteres especiais
      const t = s.trim().replace(/\s+/g,'').replace(/^[≥>≤<≈~]/,'')
      if (!t || t==='-' || t==='—' || t==='∞') return NaN
      if (t.includes(',')) return parseFloat(t.replace(/\./g,'').replace(',','.'))
      return parseFloat(t)
    }

    for (const linha of linhas) {
      if (linha.startsWith('# GRANDEZA:')) { curGrandeza = soGrandeza(linha.slice('# GRANDEZA:'.length)); continue }
      if (linha.startsWith('# PARAM:'))    { curParam    = linha.slice('# PARAM:'.length).trim();    continue }
      if (linha.startsWith('# HEADERS:')) {
        const cols = linha.slice('# HEADERS:'.length).trim().split('\t').map(s => s.trim())
        mmIdx = cols.findIndex(c => /\bUMP\b/i.test(c))
        vrIdx = mmIdx > 0 ? cols.slice(0, mmIdx).reduceRight((f,c,i) => f>=0?f:/\bUST\b/i.test(c)?i:-1, -1) : -1
        imIdx = mmIdx >= 0 && mmIdx+1 < cols.length ? mmIdx+1 : -1
        // fallback se não detectou col VR/MM
        if (vrIdx < 0 || mmIdx < 0) { vrIdx = 1; mmIdx = 2; imIdx = 3 }
        // col[0] é unidade de frequência (MHz/GHz/kHz/Hz) → dados baseados em frequência
        freqBased = cols.length > 0 && /^\([a-zA-Z]*[hH]z\)$/i.test(cols[0].trim())
        continue
      }
      if (linha.startsWith('#')) continue
      if (!linha.includes('\t')) continue

      const cols = linha.split('\t')
      const freqNum = freqBased ? parseNum2(cols[0] ?? '') : NaN
      const vr = parseNum2(cols[vrIdx] ?? '')
      const mm = parseNum2(cols[mmIdx] ?? '')
      if (freqBased ? (!isFinite(freqNum) || !isFinite(mm)) : (!isFinite(vr) || !isFinite(mm))) continue

      ponto++
      // Quando baseado em frequência: nominal=freq, correcao=UMP (valor medido na freq)
      // Caso típico: nominal=VR, correcao=VR-MM
      const nominalNum = freqBased ? freqNum : vr
      const correcaoNum = freqBased ? mm : parseFloat((vr - mm).toPrecision(10))
      const im = imIdx >= 0 ? parseNum2(cols[imIdx] ?? '') : NaN
      resultado.push({
        ponto,
        grandeza: curGrandeza || curParam,
        unidade: '',
        valorNominal: String(nominalNum),
        valorIndicado: String(mm),
        correcao: fmtCorrecao(correcaoNum),
        incertezaExpandida: isFinite(im) ? `±${im}` : '',
        fatorCobertura: 2,
      })
    }
    if (resultado.length > 0) return resultado
  }

  // ── Estratégia 2: detectar tabela com cabeçalho típico ──────────────────
  let dentroTabela = false
  let colCorrecao  = -1
  let colNominal   = -1
  let colIndicado  = -1
  let colIncerteza = -1
  let curGrandeza2 = ''
  let ponto = 0

  for (const linha of linhas) {
    const norm = linha.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

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
      const nums = colunas.map(parseNum)
      const numCount = nums.filter(n => n !== null).length
      if (numCount < 2) {
        if (/[a-zA-ZÀ-ÿ]{4}/.test(linha) && !norm.includes('unid') && numCount === 0)
          curGrandeza2 = linha
        continue
      }

      ponto++
      const correcaoVal = colCorrecao >= 0 ? parseNum(colunas[colCorrecao] ?? '') : null
      const nominalVal  = colNominal  >= 0 ? parseNum(colunas[colNominal]  ?? '') : null
      const indicadoVal = colIndicado >= 0 ? parseNum(colunas[colIndicado] ?? '') : null
      const incerteza   = colIncerteza >= 0 ? (colunas[colIncerteza] ?? '') : ''
      const correcao = correcaoVal ?? (
        nominalVal !== null && indicadoVal !== null ? nominalVal - indicadoVal : null
      )

      resultado.push({
        ponto,
        grandeza: curGrandeza2,
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

export interface DadosPadrao {
  nome?: string
  fabricante?: string
  modelo?: string
  serie?: string
  tag?: string
  protocolo?: string
  numeroCertificado?: string
  labCalibracao?: string
  ultimaCalibracao?: string  // ISO yyyy-mm-dd (data final do período)
  procedimentos?: string[]   // códigos PC do certificado (ex.: "PC R04") → casa a IT
}

/* Extrai os dados do PADRÃO da 1ª página do certificado (bloco "Características
   da Unidade Sob Teste"): Nome, Fabricante, Modelo, Nº de Série, TAG, Protocolo,
   período de calibração. Usado para pré-preencher o cadastro de equipamento. */
export function parsearDadosPadrao(texto: string): DadosPadrao {
  const t = texto.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
  // Corrige rótulos quebrados pelo OCR (ex.: "Protoc olo" → "Protocolo")
  const tn = t
    .replace(/Protoc\s*olo/gi, 'Protocolo')
    .replace(/Fabric\s*ante/gi, 'Fabricante')
    .replace(/Proced\s*imento/gi, 'Procedimento')
    .replace(/Caracter\s*[íi]sticas/gi, 'Características')
  const token = (re: RegExp): string | undefined => { const m = tn.match(re); return m?.[1]?.trim() || undefined }
  // termina no PRÓXIMO rótulo — PREFIXOS (robusto a splits) + marcador genérico "Nº:"
  const STOP = '(?:Protoc|Fabric|Modelo|TAG|Procedim|M[ée]todo|Padr|Nome|Caracter|Certificad|N(?:[º°o.]*|[úu]mero)\\s*de\\s*(?:S[ée]rie|Identifica[çc][ãa]o)|N[º°o]\\s*:)'
  const campo = (label: string): string | undefined => {
    // fronteira ANTES do STOP (prefixos como "Protoc" casam no início de "Protocolo")
    const m = tn.match(new RegExp(label + '\\s*:?\\s*(.+?)\\s+' + STOP, 'i'))
    const v = m?.[1]?.trim().replace(/[•\-–:\s]+$/, '').trim()
    return v || undefined
  }

  const nome       = campo('\\bNome')
  const fabricante = campo('\\bFabricante')
  const modelo     = campo('\\bModelo')   // para no Protocolo/TAG/etc — não cola o protocolo
  // Série: aceita "Nº de Série" e "Número de Série". Em alguns certs LABELO a série
  // vem rotulada como "Nº de Identificação" — usa como FALLBACK (não rouba a TAG).
  const serie      = token(/\bN(?:[º°o.]*|[úu]mero)\s*de\s*S[ée]rie\s*:?\s*([A-Za-z0-9.\-/]+)/i)
    ?? token(/\bN(?:[º°o.]*|[úu]mero)\s*de\s*Identifica[çc][ãa]o\s*:?\s*([A-Za-z0-9.\-/]+)/i)
  const protocolo  = token(/\bProtocolo\s*N?[º°o.]*\s*:?\s*([A-Za-z0-9.\-/]+)/i)
  // TAG: pega o número + sufixo de letras (ex.: "3217 EMC" ou "3217EMC" → 3217EMC)
  const tag = (token(/\bTAG\s*N?[º°o.]*\s*:?\s*(\d+\s*[A-Za-z]{2,5})/i)
    ?? token(/\bTAG\s*N?[º°o.]*\s*:?\s*([A-Za-z0-9]+)/i))?.replace(/\s+/g, '')
  // LABELO só quando houver a acreditação CAL 0024 (o "selinho" do LABELO).
  // A palavra "LABELO" sozinha não vale — ela aparece como CLIENTE em certificados
  // de outros laboratórios.
  const labCalibracao = ehAcreditacaoLabelo(t) ? 'LABELO/PUCRS' : undefined

  // número do certificado: "Certificado de Calibração Nº X0000/20XX" (o próprio).
  // Senão, o ÚLTIMO X0000/20XX da página (os anteriores são dos padrões usados).
  let numeroCertificado: string | undefined
  const cm = t.match(/Certificado de Calibra[çc][ãa]o\s*N[º°o]?\s*([A-Z]\d{3,4}\/\d{4})/i)
  if (cm) numeroCertificado = cm[1]
  else { const all = t.match(/[A-Z]\d{3,4}\/\d{4}/g); if (all?.length) numeroCertificado = all[all.length - 1] }

  // DATA (só a data, sem texto): período de calibração (última) → data de
  // calibração → data de emissão → primeira data dd/mm/aaaa encontrada.
  const isoFrom = (d?: string) => { if (!d) return undefined; const [dd, mm, yy] = d.split('/'); return `${yy}-${mm}-${dd}` }
  let dataStr: string | undefined
  const per = t.match(/Per[íi]odo de calibra[çc][ãa]o[^0-9]{0,30}(\d{2}\/\d{2}\/\d{4})(?:[^0-9]{0,8}(\d{2}\/\d{2}\/\d{4}))?/i)
  if (per) dataStr = per[2] || per[1]
  if (!dataStr) dataStr = token(/data\s+d[ae]\s+calibra[çc][ãa]o[^0-9]{0,30}(\d{2}\/\d{2}\/\d{4})/i)
  if (!dataStr) dataStr = token(/(?:data\s+de\s+)?emiss[ãa]o[^0-9]{0,30}(\d{2}\/\d{2}\/\d{4})/i)
  if (!dataStr) dataStr = token(/(\d{2}\/\d{2}\/\d{4})/)
  const ultimaCalibracao = isoFrom(dataStr)

  // Procedimentos de calibração referenciados (ex.: "PC R04", "PC E02") →
  // normaliza para "PC <Letra><NN>" e remove duplicados. Casa com o codigo da IT/PC.
  const procedimentos = (() => {
    const set = new Set<string>()
    const re = /\bPC\s+([A-Za-z])\.?\s*(\d{1,3})\b/g
    let m: RegExpExecArray | null
    while ((m = re.exec(tn)) !== null) {
      set.add(`PC ${m[1].toUpperCase()}${m[2].padStart(2, '0')}`)
    }
    return set.size ? [...set] : undefined
  })()

  return { nome, fabricante, modelo, serie, tag, protocolo, numeroCertificado, labCalibracao, ultimaCalibracao, procedimentos }
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

    if (!numero && (norm.includes('certificado') || norm.includes('certificate') || norm.includes('n°') || norm.includes('n.') || norm.includes('nr') || norm.includes('n.'))) {
      const m = linha.match(/[A-Z]{1,4}\s*\d{3,6}[-/]\d{2,4}|[A-Z]{1,3}\s*\d{4,6}[-/]\d{2,4}|\d{5,8}[-/]\d{4}|\d{4,8}[/-][A-Z]{2,4}/)
      if (m) numero = m[0].replace(/\s+/g, '')
    }

    if (!laboratorio && (norm.includes('laborat') || norm.includes('lab ') || norm.includes('rnbc') || norm.includes('labelo'))) {
      // Pega o primeiro segmento antes de " - " ou ":" (ex: "LABELO - Laboratórios...")
      const parts = linha.split(/\s[-–]\s|:\s/).map(s => s.trim()).filter(s => s.length > 2)
      laboratorio = (parts[0] || '')
        .replace(/\s*p[áa]gina\s+\d+\s+de\s+\d+.*/i, '')   // remove rodapé "Página X de Y"
        .replace(/\s{2,}.*/, '')                            // corta colunas grudadas (2+ espaços)
        .trim()
    }

    if (!dataEmissao) {
      const dateM = linha.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
      if (dateM && (norm.includes('emiss') || norm.includes('data') || norm.includes('date') || norm.includes('period') || norm.includes('calibr'))) {
        const [, d, m, y] = dateM
        dataEmissao = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
      }
    }
  }

  return { numero, laboratorio, dataEmissao }
}

// ─── Validação de certificado LABELO ──────────────────────────────────────
// Nº de certificado do LABELO: uma destas letras + número (1–9999) + "/" + ano.
// União das letras citadas (V L R E F T M + P B J Q A).
const LETRAS_LABELO = 'ABEFJLMPQRTV'

// Acreditação do LABELO (o "selinho"): CAL 0024. Marcador DEFINITIVO do modelo
// LABELO. Exige o contexto do EMISSOR ("...acreditado ... sob o número CAL 0024"),
// porque um "CAL 0024" solto pode ser um PADRÃO calibrado pelo LABELO citado na
// rastreabilidade de um certificado de OUTRO laboratório (falso-positivo).
export const CAL_LABELO = 'CAL 0024'
export function ehAcreditacaoLabelo(texto: string): boolean {
  return /sob\s+o\s+n[úu]mero\s+(?:CAL\s*)?0*24\b/i.test(texto || '')
}

/** Extrai o número do certificado no padrão LABELO (ex.: "R0047/2025").
 *  Tolerante a OCR: letra + 3–5 dígitos + separador (/ . -) + ano (2 ou 4 díg),
 *  com espaços no meio; a letra não pode estar grudada em outra letra/dígito. */
export function numeroCertificadoLabelo(texto: string): string | null {
  const re = new RegExp(`(?<![A-Za-z0-9])([${LETRAS_LABELO}])\\s?-?\\s?(\\d{1,4})\\s?[/.\\-]\\s?(\\d{2,4})(?![0-9])`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(texto || '')) !== null) {
    let ano = m[3]
    if (ano.length === 2) ano = '20' + ano
    if (ano.length === 4 && +ano >= 1990 && +ano <= 2099) {
      return `${m[1].toUpperCase()}${m[2]}/${ano}`
    }
  }
  return null
}

/**
 * Decide se um PDF é mesmo um certificado de calibração do LABELO.
 *  - não pode ser formulário interno (FOR 6xxx / Análise Crítica);
 *  - aceita se achar o nº no padrão LABELO, OU se for claramente um certificado
 *    do LABELO (menção a "LABELO" + título "Certificado de Calibração").
 */
export function classificarCertificadoLabelo(texto: string): {
  ok: boolean; numero: string | null; motivo?: string
} {
  const t = texto || ''
  if (/\bFOR\s*6\d{3}\b/i.test(t) || /an[áa]lise\s+cr[íi]tica/i.test(t)) {
    return { ok: false, numero: null, motivo: 'É formulário (FOR / Análise Crítica), não certificado' }
  }
  const numero = numeroCertificadoLabelo(t)
  const temTitulo = /certificado\s+de\s+calibra[çc][ãa]o/i.test(t)
  // É LABELO SÓ com a acreditação CAL 0024 (o selinho do modelo conhecido).
  // A palavra "LABELO" não basta — é o CLIENTE em certificados de outros labs
  // (CTJ, Elus, etc.), inclusive alguns com nº no formato parecido (ex.: P-7405/24).
  if (!ehAcreditacaoLabelo(t)) {
    return { ok: false, numero: null, motivo: 'Outro laboratório — sem a acreditação CAL 0024 do LABELO' }
  }
  if (numero || temTitulo) return { ok: true, numero }
  return { ok: false, numero: null, motivo: 'CAL 0024 presente, mas sem título/nº de certificado de calibração' }
}

/**
 * Resolve a TAG do equipamento. A TAG COM a sigla (3 letras finais) está no
 * PDF — o nome da pasta normalmente é só o numeral. Por isso prioriza o que foi
 * lido do CERTIFICADO (ocrTag), com a pasta apenas como reserva.
 * Exige sufixo de 2–4 letras (a sigla). Sem sufixo em lugar nenhum → null.
 */
export function resolverTag(folder: string, ocrTag?: string, textoCert?: string): string | null {
  const acharNoTexto = (t?: string): string | null => {
    if (!t) return null
    // procura "TAG ... 1234EMC" ou um "<num><2-4 letras>" próximo de "TAG"
    const m = t.match(/\bTAG\b[^0-9]{0,12}(\d{2,6})\s*([A-Za-z]{2,4})\b/i)
    if (m) return (m[1] + m[2]).toUpperCase()
    return null
  }
  // 1) TAG lida do certificado (com sigla)  2) reforço no texto do PDF  3) pasta
  for (const cand of [ocrTag, acharNoTexto(textoCert), folder]) {
    const c = (cand || '').toUpperCase().replace(/\s+/g, '')
    const m = c.match(/(\d{2,6}[A-Z]{2,4})(?![A-Z0-9])/)
    if (m) return m[1]
  }
  return null
}

/** Corta um campo do OCR: vazio ou maior que `max` → undefined (provável lixo). */
export function limparCampo(v: string | undefined, max: number): string | undefined {
  const s = (v || '').trim()
  return s && s.length <= max ? s : undefined
}

// ─── FOR 6401 — Análise Crítica de Certificado de Calibração ────────────────
export interface DadosAnaliseCritica {
  fornecedor?: string       // laboratório que calibrou
  certificado?: string      // nº do certificado de calibração
  tag?: string
  nome?: string             // nome do instrumento (autoritativo — sem erro)
  dataCertificado?: string  // data da calibração (dd/mm/aaaa)
  dataAnalise?: string      // data de realização da análise crítica (dd/mm/aaaa)
  periodicidadeMeses?: number
}

export function ehAnaliseCritica(texto: string): boolean {
  return /FOR\s*6401|an[áa]lise\s+cr[íi]tica\s+de\s+certificad/i.test(texto || '')
}

/** "2 anos" → 24 · "1 ano(s)" → 12 · "6 meses" → 6 · "18 mês" → 18. */
function periodicidadeParaMeses(s: string): number | undefined {
  const m = (s || '').toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(anos?|m[êe]s|meses)/)
  if (!m) return undefined
  const n = parseFloat(m[1].replace(',', '.'))
  if (!isFinite(n)) return undefined
  return /ano/.test(m[2]) ? Math.round(n * 12) : Math.round(n)
}

/** Extrai os dados de cadastro de um FOR 6401 (análise crítica). Layout em tabela:
 *  "Fornecedor \t Certificado \t TAG \t Nome do Instrumento \t Data do certificado"
 *  seguido da linha de valores. */
export function parsearAnaliseCritica(texto: string): DadosAnaliseCritica {
  const linhas = (texto || '').split(/[\r\n]+/).map(l => l.trim())
  const r: DadosAnaliseCritica = {}
  for (let i = 0; i < linhas.length; i++) {
    if (/Fornecedor\b.*Certificad.*\bTAG\b.*Nome do Instrumento.*Data do certificad/i.test(linhas[i])) {
      const v = (linhas[i + 1] || '').split('\t').map(s => s.trim())
      if (v.length >= 5) {
        r.fornecedor = v[0] || undefined
        r.certificado = v[1] || undefined
        r.tag = (v[2] || '').toUpperCase().replace(/\s+/g, '') || undefined
        r.nome = v[3] || undefined
        const dc = (v[4] || '').match(/\b\d{2}\/\d{2}\/\d{4}\b/); r.dataCertificado = dc ? dc[0] : undefined
      }
      break
    }
  }
  const iAna = linhas.findIndex(l => /Data da an[áa]lise cr[íi]tica/i.test(l))
  if (iAna >= 0) for (let j = iAna; j < Math.min(iAna + 6, linhas.length); j++) {
    const m = linhas[j].match(/\b\d{2}\/\d{2}\/\d{4}\b/); if (m) { r.dataAnalise = m[0]; break }
  }
  // "Periodicidade" (NÃO "Periodicidade Recomendada") — valor na linha seguinte
  const iPer = linhas.findIndex(l => /^Periodicidade$/i.test(l))
  if (iPer >= 0 && linhas[iPer + 1]) r.periodicidadeMeses = periodicidadeParaMeses(linhas[iPer + 1])
  return r
}

/** GRANDEZAS de um certificado do LABELO: são os títulos de seção (texto
 *  centralizado/negrito, FORA das tabelas) que aparecem logo ANTES de cada
 *  "Parâmetro:" — ex.: "Medição de perda de retorno - Coaxial 50Ω - Conector tipo N".
 *  Ficam entre a 2ª e a penúltima página. Dedupe, preservando a ordem. */
export function extrairGrandezasLabelo(texto: string): string[] {
  const linhas = (texto || '').split(/[\r\n]+/).map(l => l.trim())
  const out: string[] = []
  const seen = new Set<string>()
  const ehCabecalhoOuTabela = (l: string) =>
    l.includes('\t') ||                                  // linha de tabela (colunas)
    l.length < 5 ||
    /^(resultado|configura|frequ[êe]ncia|data de|per[íi]odo|certificad|labelo|laborat[óo]rio|av\.|telefone|e-?mail|rbw|vr\b|mm\b|ust\b|ump\b|veff|observa|nome:|fabricante:|modelo:|tag:|prot[óo]colo|m[ée]todo|padr[ão]|procedim|caracter[íi]stic)/i.test(l)
  for (let i = 0; i < linhas.length; i++) {
    if (!/^par[âa]metro\s*:/i.test(linhas[i])) continue
    for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
      const l = linhas[j]
      if (!l || ehCabecalhoOuTabela(l)) continue
      const key = l.toLowerCase()
      if (!seen.has(key)) { seen.add(key); out.push(l) }
      break
    }
  }
  return out
}
