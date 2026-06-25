export type TipoDocumento = 'IT' | 'PC'

export type TipoBloco =
  | 'h1' | 'h2' | 'h3'
  | 'p' | 'destaque'
  | 'ul' | 'ol'
  | 'img' | 'tabela' | 'definicoes' | 'diagrama'

// Formas de um diagrama (editor "Paint" do Maker de IT). Representado em SVG —
// renderiza igual no editor, na visualização e no PDF.
export type FormaTipo = 'retangulo' | 'elipse' | 'linha' | 'texto' | 'componente'
export interface Forma {
  id: string
  tipo: FormaTipo
  x: number
  y: number
  w?: number     // retângulo / elipse / componente
  h?: number
  x2?: number    // linha (fio): ponto final
  y2?: number
  texto?: string // texto / rótulo dentro de retângulo/elipse
  cor?: string
  simbolo?: string // p/ tipo 'componente': id do equipamento (gerador, lisn, antena…)
}

// Estilo de fonte opcional por bloco (família e tamanho em pt). Quando ausente,
// usa o padrão do documento (Arial, tamanhos por tipo de bloco).
export interface EstiloBloco { fonte?: string; tamanho?: number }

export interface BlocoH1        extends EstiloBloco { id: string; tipo: 'h1';        numero: string; texto: string }
export interface BlocoH2        extends EstiloBloco { id: string; tipo: 'h2';        numero: string; texto: string }
export interface BlocoH3        extends EstiloBloco { id: string; tipo: 'h3';        numero: string; texto: string }
export interface BlocoP         extends EstiloBloco { id: string; tipo: 'p';         texto: string }
export interface BlocoDestaque  extends EstiloBloco { id: string; tipo: 'destaque';  termo: string; texto: string }
export interface BlocoUL        extends EstiloBloco { id: string; tipo: 'ul';        itens: string[] }
export interface BlocoOL        extends EstiloBloco { id: string; tipo: 'ol';        itens: string[] }
export interface BlocoImg       extends EstiloBloco { id: string; tipo: 'img';       src: string; legenda: string }
export interface BlocoTabela    extends EstiloBloco { id: string; tipo: 'tabela';    cabecalho: string[]; linhas: string[][] }
export interface BlocoDefinicoes extends EstiloBloco { id: string; tipo: 'definicoes'; itens: { sigla: string; definicao: string }[] }
export interface BlocoDiagrama  extends EstiloBloco { id: string; tipo: 'diagrama';  formas: Forma[]; w: number; h: number; legenda?: string }

// Fontes disponíveis para escolha por bloco (web-safe / instaladas no Windows).
export const FONTES_DISPONIVEIS = [
  'Arial', 'Calibri', 'Times New Roman', 'Georgia',
  'Verdana', 'Tahoma', 'Courier New', 'Cambria',
]

export type Bloco =
  | BlocoH1 | BlocoH2 | BlocoH3
  | BlocoP  | BlocoDestaque
  | BlocoUL | BlocoOL
  | BlocoImg | BlocoTabela | BlocoDefinicoes | BlocoDiagrama

export interface DocumentoIT {
  id: string
  tipoDocumento: TipoDocumento
  codigo: string      // ex: "PC R04", "IT-001"
  titulo: string      // ex: "Atenuador"
  grupoId?: string    // grupo de equipamento ao qual a IT se aplica (taxonomia /api/grupos)
  subgrupoId?: string // subgrupo — usado p/ "consultar IT" na checagem pelo subgrupo do equipamento
  revisao: string     // ex: "00"
  dataRevisao: string // YYYY-MM-DD
  revisadoPor: string
  aprovadoPor: string
  blocos: Bloco[]
  criadoEm: string
  atualizadoEm: string
}
