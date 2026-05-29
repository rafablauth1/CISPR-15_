export interface LinhaCertificado {
  ponto: number
  grandeza: string
  unidade: string
  valorNominal: string
  valorIndicado: string
  correcao: string             // valor da correção (ex: "+0.005")
  incertezaExpandida: string   // U (k=2)
  fatorCobertura: number
}

export interface Certificado {
  id: string
  equipamentoId: string
  equipamentoTag: string
  numero: string               // n° do certificado (ex: "R0042-2025")
  laboratorio: string
  dataEmissao: string          // YYYY-MM-DD
  dataValidade?: string        // YYYY-MM-DD (12 ou 24 meses)
  normaRastreabilidade?: string
  itens: LinhaCertificado[]
  obs?: string
  criadoEm: string
}
