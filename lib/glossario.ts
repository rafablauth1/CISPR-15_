// Glossário compartilhado de siglas/abreviações e suas definições.
// Persistido em glossario.json via /api/glossario. Usado no editor de IT
// (bloco "Definições / Siglas"): ao digitar uma sigla já cadastrada a definição
// é puxada automaticamente; uma nova sigla pode ser gravada no glossário.

export interface ItemGlossario {
  sigla: string
  definicao: string
}

/** Normaliza a sigla para chave de busca (maiúsculas, sem espaços nas pontas). */
export function chaveSigla(s: string): string {
  return (s || '').trim().toUpperCase()
}

/** Faz o upsert de um item na lista (substitui pela sigla, sem duplicar). */
export function upsertGlossario(lista: ItemGlossario[], item: ItemGlossario): ItemGlossario[] {
  const sigla = chaveSigla(item.sigla)
  const definicao = (item.definicao || '').trim()
  if (!sigla || !definicao) return lista
  const i = lista.findIndex(x => chaveSigla(x.sigla) === sigla)
  const novo: ItemGlossario = { sigla, definicao }
  if (i < 0) return [...lista, novo]
  const copia = [...lista]; copia[i] = novo
  return copia
}
