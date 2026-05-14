export interface Cispr15Config {
  tipo: 'lampada' | 'luminaria'
  tensaoConfig: '127' | '127_220' | '127_220_277'
  // Cliente
  cliente: string
  clienteRua: string
  clienteCidade: string
  clienteCep: string
  // DUT
  produto: string
  fabricante: string
  modelo: string
  identificador: string
  lacre: string
  tensaoAlim: string
  potencia: string
  frequencia: string
  // Amostra
  documentacao: string
  // Relatório
  numRelatorio: string
  orcamento: string
  protocolo: string
  periodoInicio: string
  periodoFim: string
  dataEmissao: string
  responsavel: string
}

export interface LoteAmostra {
  produto: string; fabricante: string; modelo: string; identificador: string
  tensaoAlim: string; potencia: string; frequencia: string
  protocolo: string; orcamento: string
  periodoInicio: string; periodoFim: string; dataEmissao: string
  conformidade: 'pendente' | 'conforme' | 'reprovado'
  numRelatorio: string
  photos: { name: string; base64: string }[]
  docxHtml: string | null
  docxFilename: string | null
}

export interface LoteConfig {
  tipo: 'lampada' | 'luminaria'
  qtd: number
  cliente: string
  clienteRua: string
  clienteCidade: string
  clienteCep: string
  responsavel: string
  amostras: LoteAmostra[]
}

export function getTensoes(cfg: Cispr15Config): string[] {
  if (cfg.tipo === 'luminaria') return ['220V']
  if (cfg.tensaoConfig === '127')         return ['127V']
  if (cfg.tensaoConfig === '127_220_277') return ['127V', '220V', '277V']
  return ['127V', '220V']
}

export const today = () => new Date().toISOString().split('T')[0]

export function newAmostra(): LoteAmostra {
  return {
    produto: '', fabricante: '', modelo: '', identificador: '',
    tensaoAlim: '', potencia: '', frequencia: '50/60Hz',
    protocolo: '', orcamento: '',
    periodoInicio: today(), periodoFim: today(), dataEmissao: today(),
    conformidade: 'pendente', numRelatorio: '',
    photos: [], docxHtml: null, docxFilename: null,
  }
}

export const DEFAULTS: Cispr15Config = {
  tipo: 'lampada', tensaoConfig: '127_220',
  cliente: '', clienteRua: '', clienteCidade: '', clienteCep: '',
  produto: '', fabricante: '', modelo: '', identificador: '', lacre: '',
  tensaoAlim: '', potencia: '', frequencia: '50/60Hz',
  documentacao: 'embalagem com especificações',
  numRelatorio: '', orcamento: '', protocolo: '',
  periodoInicio: today(), periodoFim: today(), dataEmissao: today(),
  responsavel: '',
}

export interface ClienteDB {
  id: string
  nome: string
  rua: string
  cidade: string
  cep: string
  cnpj: string
}

// localStorage keys
export const CFG_KEY         = 'cispr15_cfg_v3'
export const PHOTOS_KEY      = 'cispr15_photos_v3'
export const DOCX_HTML_KEY   = 'cispr15_docx_html_v3'
export const DOCX_NAME_KEY   = 'cispr15_docx_name_v3'
export const LOTE_KEY        = 'cispr15_lote_v1'
export const CLIENTES_KEY    = 'cispr15_clientes_v1'
export const RELATORIOS_KEY      = 'cispr15_relatorios_v1'
export const EMENDA_DRAFT_KEY    = 'cispr15_emenda_draft_v1'
export const RELATORIO_DOCX_PFX  = 'cispr15_docx_v1_'
export const LOCKED_KEY          = 'cispr15_locked_v1'

/** EMC 1244/2026 + emenda 1 → EMC1244a/2026 */
export function formatEmendaNumero(numRelatorio: string, emendaNum: number): string {
  const letter = String.fromCharCode(96 + Math.min(emendaNum, 26))
  if (!numRelatorio) return `Emenda ${letter}`
  const clean = numRelatorio.replace(/\s+/g, '')
  return clean.includes('/') ? clean.replace('/', `${letter}/`) : `${clean}${letter}`
}

export interface AmendmentChange {
  marker: number
  campo: string
  descricao: string
}

export interface EmendaDraft {
  relatorioId: string
  numRelatorioOriginal: string
  emendaNum: number
  dataEmenda: string
  alteracoes: AmendmentChange[]
  cfgOriginal: Cispr15Config
  photoNamesOriginal: string[]
  docxFilenameOriginal: string | null
}

export interface RelatorioSalvo {
  id: string
  numRelatorio: string
  dataEmissao: string
  clienteNome: string
  protocolo: string
  produto: string
  cfg: Cispr15Config
  photos: { name: string; base64: string }[]
  docxFilename: string | null
  emendas: { numero: number; dataEmenda: string; alteracoes: AmendmentChange[] }[]
  eutFolderPath?: string
}

/* ─── configurações do app ─────────────────────────────────────────────────── */

export interface AppSettings {
  excelPath: string
  dataFolder: string
  pdfAutoSaveToEut: boolean
  senhaEmissao: string
}

export const SETTINGS_DEFAULTS: AppSettings = {
  excelPath: '',
  dataFolder: '',
  pdfAutoSaveToEut: true,
  senhaEmissao: '',
}

export interface AgendaItem {
  id: string
  tipo: 'lampada' | 'luminaria'
  protocolo: string
  orcamento: string
  cliente: string
  produto: string
  dataEntrada: string
  previsaoSaida: string
  dataEmissao: string
  numRelatorio: string
  responsavel: string
  statusConduzida: 'pendente' | 'realizado'
  statusLoop: 'pendente' | 'realizado'
  statusAnexoB: 'pendente' | 'realizado'
  observacoes: string
  pdfPath?: string
  tags?: string[]
}

export const AGENDA_KEY = 'cispr15_agenda_v1'
export const SESSION_KEY = 'cispr15_session_v1'
export const AUTH_KEY    = 'cispr15_authed_v1'

export const SETTINGS_KEY = 'cispr15_app_settings_v1'
