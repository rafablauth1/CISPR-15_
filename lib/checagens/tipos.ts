import type { GrupoId, SubgrupoId } from '@/lib/equipamentos/tipos'

export type StatusChecagem = 'aprovado' | 'atencao' | 'reprovado'
export type FonteImportacao = 'manual' | 'excel' | 'ocr'

export interface ItemChecagem {
  id: string
  descricao: string
  valorMedido: string
  unidade: string
  criterioMin?: number
  criterioMax?: number
  resultado: 'ok' | 'nok' | 'na'
  normaId?: string
  secao?: string
}

export interface Checagem {
  id: string
  equipamentoId: string
  equipamentoTag: string
  grupoId: GrupoId
  subgrupoId: SubgrupoId
  data: string
  responsavel: string
  periodicidade: number
  proximaChecagem: string
  status: StatusChecagem
  fonte: FonteImportacao
  normaReferencia?: string
  itens: ItemChecagem[]
  obs?: string
  criadoEm: string
}
