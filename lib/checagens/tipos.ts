import type { GrupoId, SubgrupoId } from '@/lib/equipamentos/tipos'

export type StatusChecagem  = 'aprovado' | 'atencao' | 'reprovado'
export type FonteImportacao = 'manual' | 'excel' | 'ocr'
export type TipoComparacao  = 'direta' | 'indireta'
export type PapelReferencia = 'gerador' | 'medidor'  // só para comparação direta
export type ResultadoGeral  = 'satisfatorio' | 'insatisfatorio' | 'pendente'

export interface ItemChecagem {
  id: string
  ponto: number
  grandeza: string
  unidade: string
  // Direta (ref=gerador): VR = valor gerado pela ref, MM = leitura do instrumento
  // Direta (ref=medidor): VN = nominal ajustado no instrumento, VR = leitura da ref
  // Indireta: VR = leitura da referência, MM = leitura do instrumento checado
  valorNominal?: string      // Direta ref=medidor: o que foi ajustado no instrumento
  valorReferencia: string    // O que a referência diz (gera ou lê)
  valorMedido: string        // O que o instrumento checado diz (lê ou gera)
  // Indireto — correção do certificado da referência
  correcaoPadrao?: string
  valorCorrigido?: string    // valorReferencia + correcaoPadrao
  // Legado
  valorTransferencia?: string
  // Resultado
  resultado: 'ok' | 'nok' | 'na'
  observacoes?: string
  criterioMin?: number
  criterioMax?: number
  normaId?: string
  secao?: string
}

export interface Checagem {
  id: string
  // Identificação do instrumento
  equipamentoId: string
  equipamentoTag: string
  nomeInstrumento: string
  laboratorio: string
  numeroCertificado: string      // certificado de calibração do padrão
  dataCalibracaoRef: string      // data da calibração do padrão
  // Classificação
  grupoId: GrupoId
  subgrupoId: SubgrupoId
  // Execução
  data: string                   // data da checagem
  responsavel: string
  tipoComparacao: TipoComparacao
  papelReferencia: PapelReferencia   // direta: ref gera ou ref mede?
  // Padrão(ões) utilizado(s) (TAG dos padrões usados)
  padraoTag: string
  // Periodicidade
  periodicidade: number          // em dias
  proximaChecagem: string
  // Resultado
  resultadoGeral: ResultadoGeral
  status: StatusChecagem
  // Importação
  fonte: FonteImportacao
  normaReferencia?: string
  // Itens de medição
  itens: ItemChecagem[]
  obs?: string
  criadoEm: string
}
