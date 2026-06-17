// Extração GENÉRICA da 1ª página de certificados de OUTROS laboratórios.
// NÃO altera o OCR do LABELO (parsearDadosPadrao/parsearCertificadoRBC seguem
// intactos). Usa sinônimos de rótulos comuns (PT/EN) e a acreditação CAL XXXX
// (ou a assinatura do nome) para identificar o laboratório emissor.
//
// Padrões de rótulo aprendidos analisando certificados reais de vários labs
// (Chrompack, CTJ, Elus, Holtermann, Inmetro, ISI/SENAI, K&L, Keysight,
// Metroquality, Padrão Balanças, Senai...). Os termos foram generalizados
// para também cobrir laboratórios novos que sigam convenções parecidas.

// Acreditação (Cgcre) → nome do laboratório. CAL 0024 = LABELO.
// Estes são os já conhecidos; o registro auto-descoberto cobre o resto.
export const LABS_POR_CAL: Record<string, string> = {
  'CAL 0024': 'LABELO/PUCRS',
  'CAL 0013': 'SENAI/CETEMP',     // ISI SIM SENAI CETEMP
  'CAL 0256': 'Chrompack',
  'CAL 0382': 'Holtermann',
  'CAL 0439': 'Elus Instrumentação',
  'CAL 0477': 'CTJ',
  'CAL 291':  'Padrão Balanças',
}

// Assinatura por NOME — pega laboratórios SEM acreditação CGCRE (Inmetro,
// Keysight) e serve de reforço quando o CAL não aparece no texto extraído.
const ASSINATURAS_LAB: { re: RegExp; nome: string }[] = [
  { re: /\binmetro\b|\bdimci\b/i,                       nome: 'Inmetro' },
  { re: /keysight|agilent/i,                            nome: 'Keysight Technologies' },
  { re: /chrompack/i,                                   nome: 'Chrompack' },
  { re: /holtermann/i,                                  nome: 'Holtermann' },
  { re: /\belus\b|precis[ãa]o\s+metrol[óo]gica/i,       nome: 'Elus Instrumentação' },
  { re: /metroquality/i,                                nome: 'Metroquality' },
  { re: /metrosul/i,                                    nome: 'Metrosul' },
  { re: /padr[ãa]o\s+balan[çc]as/i,                     nome: 'Padrão Balanças' },
  { re: /cetemp|\bsenai\b/i,                            nome: 'SENAI/CETEMP' },
  { re: /grupo\s*ctj|\bctj\b/i,                         nome: 'CTJ' },
  { re: /\bk\s*&\s*l\b/i,                               nome: 'K&L Metrologia' },
  { re: /alutal|atlas\s+material/i,                     nome: 'Alutal' },
  { re: /\blabelo\b/i,                                  nome: 'LABELO/PUCRS' },
]

const limpa = (s?: string) => (s || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim()

/** Acreditação do laboratório EMISSOR (o "sob o número CAL XXXX"). */
export function extrairAcreditacao(texto: string): string | undefined {
  const t = texto || ''
  const m = t.match(/sob\s+o\s+n[úu]mero\s+(?:CAL\s*)?(\d{3,4})/i) || t.match(/\bCAL\s*(\d{3,4})\b/i)
  return m ? `CAL ${m[1]}` : undefined
}

export function labPorAcreditacao(cal?: string): string | undefined {
  if (!cal) return undefined
  const n = cal.replace(/\D/g, '')
  return LABS_POR_CAL[`CAL ${n}`] || LABS_POR_CAL[`CAL ${n.padStart(4, '0')}`]
}

/** Nome canônico do laboratório: CAL conhecido > assinatura do nome. */
export function identificarLaboratorio(texto: string, cal?: string): string | undefined {
  const porCal = labPorAcreditacao(cal ?? extrairAcreditacao(texto))
  if (porCal) return porCal
  for (const a of ASSINATURAS_LAB) if (a.re.test(texto || '')) return a.nome
  return undefined
}

/** Tenta achar o NOME do laboratório emissor na 1ª página (best-effort). */
export function extrairNomeLaboratorio(texto: string): string | undefined {
  // 1) assinatura conhecida (mais confiável)
  const porAssin = identificarLaboratorio(texto)
  if (porAssin) return porAssin
  // 2) heurística: 1ª linha "de cara" que parece nome de laboratório
  const linhas = (texto || '').split(/[\r\n]+|\s\|\s/).map(l => l.trim()).filter(Boolean).slice(0, 30)
  for (const l of linhas) {
    if (/acreditad|cgcre|iso\/?iec|17025|p[áa]gina|certificad|av\.|telefone|e-?mail|website|cliente/i.test(l)) continue
    if (/(laborat[óo]rio|metrolog|calibra[çc]|instrument|tecnolog|controles)/i.test(l) && l.length >= 4 && l.length <= 80) {
      return l.replace(/\s{2,}.*/, '').replace(/[•\-–:]\s*$/, '').trim()
    }
  }
  return undefined
}

export interface MetaGenerica {
  numero?: string; nome?: string; fabricante?: string; modelo?: string
  serie?: string; tag?: string; acreditacao?: string; laboratorio?: string
  dataCalibracao?: string
}

// Detecta se uma linha é, ela própria, um RÓTULO (e não um valor) — usado para
// não confundir o próximo rótulo com o valor procurado em layouts "em coluna".
const RE_ROTULO = /:\s*$|^(fabricante|marca|manufacturer|make|maker|modelo|model|tipo|type|n[º°o.]*\s*de\s*s[ée]rie|n[º°o.]*\s*s[ée]rie|s[ée]rie|serial|s\/?n|identifica|c[óo]d|tag|patrim|ativo|data|cliente|contratante|solicitante|interessado|endere[çc]o|faixa|resolu|procedimento|temperatura|umidade|press[ãa]o|denomina|objeto|descri|instrumento|item|emiss|valid|pr[óo]xima|local|condi[çc])/i
const ehRotulo = (s: string) => RE_ROTULO.test(s.trim())

// Lixo que às vezes "vaza" como valor logo após um rótulo.
const ehLixo = (v: string) =>
  !v || /^n[º°o.]*$/i.test(v) || /^[-–•:.\s/]+$/.test(v) || /^(o\s+mesmo|determinado)/i.test(v)

// Corta um RÓTULO seguinte que veio colado no valor, na mesma linha
// (ex.: "Não identificado Modelo/Tipo: 230 V" → "Não identificado").
const CUT_INLINE = /\s+(?:Fabricante|Marca|Manufacturer|Modelo|Model|Tipo|Type|N[º°o.]*\s*de\s*S[ée]rie|Serial|S\/?N|C[óo]d(?:igo)?\b|Identifica|Data|Faixa|Resolu|Endere)\b.*$/i

const arruma = (s: string, max: number) => {
  const v = limpa(s).replace(CUT_INLINE, '').replace(/\s{2,}.*/, '').replace(/[•\-–:\s]+$/, '').trim()
  return v && !ehLixo(v) && !ehRotulo(v) && v.length <= max ? v : undefined
}

// Procura "rótulo: valor" e também "rótulo:" com o valor na PRÓXIMA linha
// (vários labs imprimem rótulo e valor em linhas separadas — Alutal, Keysight, CTJ).
// O \b após o rótulo impede casar como prefixo de palavra maior (Equipamento ≠ Equipamentos).
function campo(texto: string, rotulos: string[], max = 80): string | undefined {
  const linhas = texto.split(/[\r\n]+|\s\|\s/).map(l => l.trim())
  for (const r of rotulos) {
    const re = new RegExp('^(?:' + r + ')(?![A-Za-zÀ-ÿ])\\s*[:\\-–]?\\s*(.*)$', 'i')
    for (let i = 0; i < linhas.length; i++) {
      if (!linhas[i]) continue
      const m = linhas[i].match(re)
      if (!m) continue
      // (a) valor na MESMA linha
      const mesma = arruma(m[1], max)
      if (mesma) return mesma
      // (b) valor na PRÓXIMA linha não-vazia (layout em coluna)
      for (let j = i + 1; j < Math.min(i + 3, linhas.length); j++) {
        if (!linhas[j]) continue
        if (ehRotulo(linhas[j])) break
        const prox = arruma(linhas[j], max)
        if (prox) return prox
        break
      }
    }
  }
  return undefined
}

// Padrão da TAG LABELO: número (2–8 díg.) + 3 letras (ex.: 1987LUM, 640DOM, 3212UDM).
const RE_TAG_VAL = /\b(\d{2,8})\s*([A-Za-z]{3})\b/
// No fallback global, só aceita 3 letras MAIÚSCULAS (são códigos de área) e que
// não sejam siglas comuns de norma/texto (senão pega lixo tipo 6588ISO, 2022SOB).
const RE_TAG_UP = /\b(\d{2,8})\s*([A-Z]{3})\b/g
const NAO_TAG = new Set(['ISO','NBR','IEC','ABN','RBC','SOB','RAZ','GUM','ART','NIT','SIM','PRO','REV','OSP','CAL','DOC','MRA','NMI','RAM','LTD','LDA','EPP','ZIP','MIN','MAX'])

/** Extrai a TAG do cliente (cada lab usa um rótulo diferente — ver ASSINATURAS). */
export function extrairTag(texto: string): string | undefined {
  // 1) valor logo após um rótulo de identificação (alta confiança)
  const v = campo(texto, [
    'TAG',
    'C[óo]d(?:igo)?\\.?\\s*de\\s*Identifica[çc][ãa]o\\s+do\\s+propriet[áa]rio',
    'C[óo]d(?:igo)?\\.?\\s*de\\s*Identifica[çc][ãa]o',
    'N[º°o.]*\\s*de\\s*Identifica[çc][ãa]o',
    'Identifica[çc][ãa]o\\s+do\\s+Conjunto',
    'Identifica[çc][ãa]o\\s+do\\s+Instrumento',
    'N[úu]mero\\s+do\\s+cliente',
    'Ativo\\s*N[º°o.]*',
    'ID\\s*Code', '\\bID\\b',
    'Identifica[çc][ãa]o', 'Patrim[ôo]nio', 'C[óo]digo',
  ], 30)
  if (v) { const m = v.match(RE_TAG_VAL); if (m) return (m[1] + m[2]).toUpperCase() }
  // 2) fallback: padrão MAIÚSCULO na folha de rosto, ignorando siglas comuns
  const rosto = (texto || '').slice(0, 4500)
  for (const m of rosto.matchAll(RE_TAG_UP)) {
    if (!NAO_TAG.has(m[2])) return (m[1] + m[2]).toUpperCase()
  }
  return undefined
}

/** Extrai metadados da 1ª página de um certificado de qualquer laboratório. */
export function extrairMetadadosGenerico(texto: string): MetaGenerica {
  const t = (texto || '').slice(0, 4500)   // foco na folha de rosto
  // Nº do certificado/relatório — letra(s) opcionais + dígitos + sep + ano,
  // ou formatos próprios (DIMCI 1068/2025, WO-00936667, L002787/2026).
  const numM =
    t.match(/(?:certificad\w*|certificate|relat[óo]rio)\s*(?:de\s*calibra\w*)?\s*(?:n[º°o.]*)?\s*[:\-]?\s*([A-Z]{0,5}\s?-?\s?\d{1,8}\s?[/.\-]\s?\d{2,4})/i) ||
    t.match(/\b(DIMCI\s*\d{1,5}\/\d{2,4})\b/i) ||
    t.match(/\b(WO-\d{6,10})\b/i) ||
    t.match(/\b([A-Z]\d{5,7}\/\d{4})\b/)
  const acred = extrairAcreditacao(texto)
  return {
    numero:     numM ? limpa(numM[1]).replace(/\s+/g, '') : undefined,
    nome:       campo(t, ['Nome', 'Equipamento', 'Descri[çc][ãa]o', 'Denomina[çc][ãa]o', 'Instrumento', 'Measuring\\s*Instrument', 'Equipment', 'Description', 'Instrument', 'Item\\s*calibrad\\w*', 'Item', 'Objeto(?:\\s*calibrad\\w*)?', 'Unidade\\s*sob\\s*teste']),
    fabricante: campo(t, ['Fabricante', 'Marca', 'Nome\\s+do\\s+Fabricante', 'Manufacturer', 'Make', 'Maker'], 50),
    modelo:     campo(t, ['Modelo(?:\\s*N[º°o.]*)?', 'Model(?:\\s*\\/?\\s*Type)?', 'Tipo', 'Type'], 40),
    serie:      campo(t, ['N[º°o.]*\\s*de\\s*S[ée]rie', 'N[º°o.]*\\s*S[ée]rie', 'S[ée]rie\\s*N[º°o.]*', 'S[ée]rie', 'Serial(?:\\s*N\\w*)?', 'Serial\\s*Number', 'S\\/?N'], 30),
    tag:        extrairTag(t),
    acreditacao: acred,
    laboratorio: identificarLaboratorio(texto, acred),
    dataCalibracao: campo(t, ['Data\\s*da\\s*Calibra[çc][ãa]o', 'Calibration\\s*Date', 'Data\\s*de\\s*Calibra[çc][ãa]o', 'Test\\s*Date'], 24),
  }
}
