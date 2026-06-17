// Extratores ESPECÍFICOS por laboratório.
// O pdf-parse embaralha tabelas, então para os layouts mais bagunçados o método
// genérico (extrair-generico.ts) não acha modelo/série/data. Aqui cada lab tem
// uma função que "rastreia" esses campos por âncoras conhecidas do seu PDF.
// Só preenche os campos que o genérico costuma ERRAR — o merge no genérico
// mantém o que já veio certo (overlay: { ...generico, ...especifico-definido }).

export interface CamposLab {
  modelo?: string; serie?: string; dataCalibracao?: string; fabricante?: string
}

const MES: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
}

/** Normaliza qualquer formato de data para dd/mm/aaaa.
 *  Aceita 17/07/2024, 17-07-2024, "05 de outubro de 2022" e "3 Fev 2025". */
export function normData(s?: string): string | undefined {
  if (!s) return undefined
  let m = s.match(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})/)
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`
  m = s.match(/(\d{1,2})\s*(?:de\s+)?([A-Za-zçãéêíóôõ]{3,12})\.?\s*(?:de\s+)?(\d{4})/i)
  if (m) { const mm = MES[m[2].slice(0, 3).toLowerCase()]; if (mm) return `${m[1].padStart(2, '0')}/${mm}/${m[3]}` }
  return undefined
}

/** 1ª data dd/mm/aaaa que aparece no texto (na maioria dos certs = a calibração). */
function primeiraData(t: string): string | undefined {
  const m = t.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)
  return m ? normData(m[0]) : undefined
}

/** 2ª data de um par de datas GRUDADAS (ex.: "11/02/202617/02/2026" → 17/02/2026).
 *  Vários labs imprimem recebimento+emissão ou entrada+calibração coladas. */
function segundaDataColada(t: string): string | undefined {
  const m = t.match(/(\d{2}\/\d{2}\/\d{4})(\d{2}\/\d{2}\/\d{4})/)
  return m ? normData(m[2]) : undefined
}

const cap = (t: string, re: RegExp) => { const m = t.match(re); return m ? (m[1] || '').trim() : undefined }

// Chave = nome canônico devolvido por identificarLaboratorio() em extrair-generico.
export const EXTRATORES_LAB: Record<string, (t: string) => CamposLab> = {
  // Barômetro: modelo tipo 623ADV, série após "Instrumento:", 1ª data = calibração.
  'CTJ': (t) => ({
    modelo: cap(t, /\b(\d{3}[A-Z]{3})\b/),
    serie:  cap(t, /Instrumento:\s*(\d{6,8})\b/i),
    dataCalibracao: primeiraData(t),
  }),
  // Vazão: fabricante "Alfa Instrumentos", modelo na linha seguinte, série de 8 díg.
  'Elus Instrumentação': (t) => ({
    fabricante: cap(t, /\b(Alfa\s+Instrumentos)\b/i),
    modelo:     cap(t, /Alfa\s+Instrumentos\s*\r?\n\s*([^\r\n]+)/i),
    serie:      cap(t, /\b(\d{8})\b/),
    dataCalibracao: primeiraData(t),
  }),
  // Torquímetro GEDORE: série "6GX 030371"; datas recebimento+emissão coladas.
  'K&L Metrologia': (t) => ({
    serie:  cap(t, /\b(\d[A-Z]{2}\s?\d{6})\b/),
    dataCalibracao: segundaDataColada(t) || primeiraData(t),
  }),
  // Massa: linha "EOSN 90302980LUM"; entrada+calibração coladas (2ª = calibração).
  'Metroquality': (t) => ({
    serie:  cap(t, /EOSN?\s*(\d{6,9})/i),
    dataCalibracao: segundaDataColada(t),
  }),
  // Lâmpada: "Modelo/Tipo: 230 V 20 W".
  'Inmetro': (t) => ({
    modelo: cap(t, /Modelo\/?Tipo:\s*([^\r\n]+?)\s*(?:N[úu]mero|C[óo]digo|$)/im),
  }),
  // ISI medidor de espessura: "Número de série ... é 7360" (Senai volumétrico não tem).
  'SENAI/CETEMP': (t) => ({
    serie: cap(t, /N[úu]mero\s+de\s+s[ée]rie[^\d]{0,40}(\d{3,6})/i),
  }),
  // Microdurômetro: 2 datas escritas no topo (emissão, depois calibração) → 2ª é a calibração.
  'Holtermann': (t) => ({
    dataCalibracao: (() => {
      const m = t.match(/(\d{1,2}\s+de\s+[A-Za-zçã]+\s+de\s+\d{4})\D+(\d{1,2}\s+de\s+[A-Za-zçã]+\s+de\s+\d{4})/i)
      return m ? normData(m[2]) : undefined
    })(),
  }),
}

/** Aplica o extrator do lab (se houver), devolvendo só os campos NÃO vazios. */
export function aplicarExtratorLab(lab: string | undefined, texto: string): CamposLab {
  if (!lab) return {}
  const fn = EXTRATORES_LAB[lab]
  if (!fn) return {}
  const r = fn(texto || '')
  const out: CamposLab = {}
  for (const k of Object.keys(r) as (keyof CamposLab)[]) {
    const v = r[k]
    if (v && String(v).trim()) out[k] = String(v).trim()
  }
  return out
}
