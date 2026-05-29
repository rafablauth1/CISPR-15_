import type { GrupoId, SubgrupoId } from '@/lib/equipamentos/tipos'

export type StatusChecagem  = 'aprovado' | 'atencao' | 'reprovado'
export type FonteImportacao = 'manual' | 'excel' | 'ocr'
export type TipoComparacao  = 'direta' | 'indireta'
export type ResultadoGeral  = 'satisfatorio' | 'insatisfatorio' | 'pendente'

export interface ItemChecagem {
  id: string
  ponto: number
  grandeza: string           // "Grandeza a ser verificada"
  unidade: string
  // Comparação direta (colunas VR / MM)
  valorReferencia: string    // VR — valor do padrão (UST)
  valorMedido: string        // MM — valor lido no instrumento (UMP)
  // Comparação indireta (colunas extras)
  valorTransferencia?: string
  correcaoPadrao?: string
  valorCorrigido?: string
  // Resultado do ponto
  resultado: 'ok' | 'nok' | 'na'
  observacoes?: string
  // Opcionais (norma de referência)
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
