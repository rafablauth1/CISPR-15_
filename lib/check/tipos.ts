// Módulo Check — gerenciador de demandas (kanban interno do app).
// Persistido em check.json via lib/dados.ts (GET/PUT em /api/check).

export type StatusTarefa = 'todo' | 'doing' | 'done'
export type PrioTarefa = 'alta' | 'media' | 'baixa'
export type TipoTarefa = 'feature' | 'bug' | 'improvement'
// Validação pelo usuário: 'a-testar' = implementado, aguardando o Rafael testar;
// depois ele marca 'aprovado' ou 'reprovado'. Ausente = sem ciclo de teste.
export type StatusTeste = 'a-testar' | 'aprovado' | 'reprovado'

export interface AnexoTarefa {
  fid: string
  name: string
  type: string
  size: number
  dataURL: string
}

export interface LogTarefa {
  when: string
  what: string
}

export interface Tarefa {
  id: string
  title: string
  desc: string
  cat: string
  type: TipoTarefa
  prio: PrioTarefa
  status: StatusTarefa
  teste?: StatusTeste   // marcador de validação pelo usuário (opcional)
  created: string
  log: LogTarefa[]
  files: AnexoTarefa[]
}

export interface BoardCheck {
  tarefas: Tarefa[]
  /** nome da área → cor da etiqueta */
  categorias: Record<string, string>
}

export const STATUS: Record<StatusTarefa, { l: string; c: string }> = {
  todo:  { l: 'A fazer',      c: '#64748B' },
  doing: { l: 'Em andamento', c: '#E8B94B' },
  done:  { l: 'Concluído',    c: '#22C55E' },
}

export const PRIO: Record<PrioTarefa, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
export const TIPO: Record<TipoTarefa, string> = { feature: 'Func.', bug: 'Bug', improvement: 'Melhoria' }

export const TESTE: Record<StatusTeste, { l: string; c: string; emoji: string }> = {
  'a-testar':  { l: 'A testar',  c: '#E8B94B', emoji: '🧪' },
  'aprovado':  { l: 'Aprovado',  c: '#22C55E', emoji: '✅' },
  'reprovado': { l: 'Reprovado', c: '#F87171', emoji: '❌' },
}

export const CORES_AREA = [
  '#4F8EF7', '#22D3C8', '#E8B94B', '#A78BFA', '#F87171',
  '#E07B39', '#2A9D8F', '#C084FC', '#22C55E', '#F472B6', '#64748B',
]

export const CATEGORIAS_PADRAO: Record<string, string> = {
  'Instruções de Trabalho': '#4F8EF7',
  'Certificados':           '#22D3C8',
  'Grupos':                 '#E8B94B',
  'Equipamentos':           '#A78BFA',
  'Bugs':                   '#F87171',
  'Geral':                  '#64748B',
}

const DATA_SEED = '22/06/2026 18:00'

function seed(
  id: string,
  cat: string,
  type: TipoTarefa,
  prio: PrioTarefa,
  title: string,
  desc: string,
): Tarefa {
  return {
    id, cat, type, prio, title, desc,
    status: 'todo',
    created: DATA_SEED,
    log: [{ when: DATA_SEED, what: 'Demanda registrada (lista de 22/06/2026).' }],
    files: [],
  }
}

export const TAREFAS_SEED: Tarefa[] = [
  seed('seed-1', 'Instruções de Trabalho', 'feature', 'media', 'Confirmação ao sair sem salvar',
    'Não deixar voltar sem salvar. Mostrar diálogo: "Deseja retornar sem salvar os dados?".'),
  seed('seed-2', 'Instruções de Trabalho', 'feature', 'baixa', 'Corretor ortográfico com sugestões',
    'Colocar corretor estilo Word, com sugestão de correção nos campos de texto.'),
  seed('seed-3', 'Instruções de Trabalho', 'feature', 'alta', 'Editor de diagramas estilo "Paint"',
    'Na área de Maker de IT, criar um editor de diagramas de conexão simples: formas geométricas, fios e ligações pra simular equipamentos e montar esquemas.'),
  seed('seed-4', 'Instruções de Trabalho', 'feature', 'media', 'Glossário de siglas e definições',
    'Digita a sigla → se já existe, puxa automaticamente; se não existe, cadastra no glossário (siglas + definições).'),
  seed('seed-5', 'Certificados', 'improvement', 'media', 'Melhorar leitura OCR do certificado',
    'A leitura OCR do certificado precisa ser melhor trabalhada (precisão / extração).'),
  seed('seed-6', 'Grupos', 'bug', 'alta', 'Não salva tipo de equipamento nos subgrupos',
    'Ao criar um tipo de equipamento dentro dos subgrupos, não está salvando.'),
  seed('seed-7', 'Equipamentos', 'feature', 'media', 'Calibrar antes do uso (certificado vencido +4 anos)',
    'No cadastro, se o certificado estiver vencido há mais de 4 anos, marcar para calibrar antes do uso. Considerar a periodicidade da análise crítica.'),
  seed('seed-8', 'Equipamentos', 'feature', 'media', 'Filtros dependentes com recálculo de contadores',
    'No filtro de equipamento, ao selecionar uma sigla, recalcular os contadores dos outros grupos consequentes do filtro. Um filtro depende do outro (encadeados).'),
  seed('seed-9', 'Bugs', 'bug', 'alta', 'Travamento de digitação após excluir',
    'Depois de apagar algo (ex: deletar um procedimento) fica ~30s sem conseguir digitar.'),
]

export function boardPadrao(): BoardCheck {
  return { tarefas: TAREFAS_SEED, categorias: { ...CATEGORIAS_PADRAO } }
}
