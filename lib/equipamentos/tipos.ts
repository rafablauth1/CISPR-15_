import type { GrandezaMetrologica } from '@/lib/metrologia/tipos'

export type GrupoId =
  | 'geradores'
  | 'medidores'
  | 'redes-impedancia'
  | 'antenas'
  | 'atenuacao'
  | 'grandezas-ambientais'

export type SubgrupoId =
  | 'gerador-sinal-rf'
  | 'gerador-funcoes'
  | 'fonte-alimentacao-dc'
  | 'analisador-espectro'
  | 'receptor-emi'
  | 'multimetro'
  | 'lisn-50uh'
  | 'lisn-5uh'
  | 'antena-loop'
  | 'antena-log-periodica'
  | 'antena-biconica'
  | 'atenuador'
  | 'filtro-rf'
  | 'termoigrometro'
  | 'barometro'

export type StatusEquipamento = 'ativo' | 'calibrar' | 'fora'

export interface EquipamentoEMC {
  id: string
  tag: string
  nome: string
  grupoId: GrupoId
  subgrupoId: SubgrupoId
  status: StatusEquipamento
  grandezas: GrandezaMetrologica[]
  ultimaCalibracao: string
  proximaCalibracao: string
  intervaloCalibracao: number
  fabricante?: string
  modelo?: string
  serie?: string
  labCalibracao?: string
  numeroCertificado?: string
  obs?: string
}
