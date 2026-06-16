import { lerJSON, escreverJSON } from '@/lib/dados'

export interface LaboratorioCal {
  cal: string        // nº de acreditação Cgcre (ex.: "CAL 0024")
  nome: string       // nome do laboratório
  modelo?: string    // observação do modelo de PDF (layout) — para o OCR
}

export const ARQ_LABS = 'laboratorios.json'

export const LABS_DEFAULT: LaboratorioCal[] = [
  { cal: 'CAL 0024', nome: 'LABELO/PUCRS', modelo: 'Nº R/F/T…XXXX/AAAA · tabela por coordenadas (OCR pronto)' },
]

const normCal = (c?: string) => c ? `CAL ${(c.match(/\d{3,4}/) || [''])[0]}` : ''

export function lerLaboratorios(): LaboratorioCal[] {
  return lerJSON<LaboratorioCal[]>(ARQ_LABS, LABS_DEFAULT)
}
export function salvarLaboratorios(labs: LaboratorioCal[]): void {
  escreverJSON(ARQ_LABS, labs)
}
export function nomeDoLab(labs: LaboratorioCal[], cal?: string): string | undefined {
  const k = normCal(cal)
  return k ? labs.find(l => normCal(l.cal) === k)?.nome : undefined
}
/** Garante que o CAL exista no registro (auto-descoberta). Retorna se mudou. */
export function registrarLab(labs: LaboratorioCal[], cal?: string, nomeGuess?: string): boolean {
  const k = normCal(cal)
  if (!k) return false
  if (labs.some(l => normCal(l.cal) === k)) return false
  labs.push({ cal: k, nome: nomeGuess || '', modelo: undefined })
  return true
}
