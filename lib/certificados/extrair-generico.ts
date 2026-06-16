// Extração GENÉRICA da 1ª página de certificados de OUTROS laboratórios.
// NÃO altera o OCR do LABELO (parsearDadosPadrao/parsearCertificadoRBC seguem
// intactos). Usa sinônimos de rótulos comuns (PT/EN) e a acreditação CAL XXXX
// para identificar o laboratório emissor.

// Acreditação (Cgcre/Inmetro) → nome do laboratório. CAL 0024 = LABELO.
// Vá preenchendo conforme os outros labs aparecerem.
export const LABS_POR_CAL: Record<string, string> = {
  'CAL 0024': 'LABELO/PUCRS',
}

const limpa = (s?: string) => (s || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim()

/** Acreditação do laboratório EMISSOR (o "sob o número CAL XXXX"). */
export function extrairAcreditacao(texto: string): string | undefined {
  const t = texto || ''
  const m = t.match(/sob\s+o\s+n[úu]mero\s+(CAL)\s*(\d{3,4})/i) || t.match(/\b(CAL)\s*(\d{3,4})\b/i)
  return m ? `CAL ${m[2]}` : undefined
}

export function labPorAcreditacao(cal?: string): string | undefined {
  if (!cal) return undefined
  return LABS_POR_CAL[`CAL ${cal.replace(/\D/g, '')}`]
}

export interface MetaGenerica {
  numero?: string; nome?: string; fabricante?: string; modelo?: string
  serie?: string; tag?: string; acreditacao?: string; laboratorio?: string
}

// Procura "rótulo: valor" linha a linha (também separa colunas por " | ").
function campo(texto: string, rotulos: string[], max = 80): string | undefined {
  const linhas = texto.split(/[\r\n]+|\s\|\s/).map(l => l.trim()).filter(Boolean)
  for (const r of rotulos) {
    const re = new RegExp('^(?:' + r + ')\\s*[:\\-–]\\s*(.+)$', 'i')
    for (const ln of linhas) {
      const m = ln.match(re)
      if (m) {
        const v = limpa(m[1]).replace(/[•\-–:\s]+$/, '').trim()
        if (v && v.length <= max && !/^n[º°o.]?$/i.test(v)) return v
      }
    }
  }
  return undefined
}

/** Extrai metadados da 1ª página de um certificado de qualquer laboratório. */
export function extrairMetadadosGenerico(texto: string): MetaGenerica {
  const t = (texto || '').slice(0, 4500)   // foco na folha de rosto
  // Nº do certificado/relatório — letra(s) opcionais + dígitos + sep + ano
  const numM = t.match(/(?:certificad\w*|certificate|relat[óo]rio)\s*(?:de\s*calibra\w*)?\s*(?:n[º°o.]*)?\s*[:\-]?\s*([A-Z]{0,4}\s?-?\s?\d{1,6}\s?[/.\-]\s?\d{2,4})/i)
  const acred = extrairAcreditacao(texto)
  return {
    numero:     numM ? limpa(numM[1]).replace(/\s+/g, '') : undefined,
    nome:       campo(t, ['Nome', 'Equipamento', 'Descri[çc][ãa]o', 'Instrumento', 'Equipment', 'Description', 'Instrument', 'Item\\s*calibrad\\w*', 'Objeto', 'Unidade\\s*sob\\s*teste']),
    fabricante: campo(t, ['Fabricante', 'Marca', 'Manufacturer', 'Make', 'Maker'], 50),
    modelo:     campo(t, ['Modelo', 'Model', 'Tipo', 'Type'], 40),
    serie:      campo(t, ['N[º°o]?\\s*de\\s*S[ée]rie', 'N[º°o]?\\s*S[ée]rie', 'S[ée]rie', 'Serial(?:\\s*N\\w*)?', 'S/?N'], 30),
    tag:        campo(t, ['TAG', 'Identifica[çc][ãa]o', 'Patrim[ôo]nio', 'C[óo]digo', '\\bID\\b'], 20),
    acreditacao: acred,
    laboratorio: labPorAcreditacao(acred),
  }
}
