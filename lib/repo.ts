import { lerJSON, escreverJSON } from '@/lib/dados'

// Repositório genérico de uma coleção (array de itens com `id`) sobre um arquivo
// JSON. Centraliza o ciclo ler→mutar→gravar (que estava copiado em cada rota) e
// usa a escrita atômica de lib/dados.ts por baixo. A API HTTP das rotas não muda.

export interface Repo<T extends { id: string }> {
  /** Lista completa (com os defaults se o arquivo não existir). */
  all(): T[]
  /** Busca por id. */
  byId(id: string): T | undefined
  /** Transação: lê, aplica o mutator e grava (atômico). É a primitiva. */
  update(mutator: (lista: T[]) => T[]): T[]
  /** Cria um item gerando id único; devolve o item criado. */
  create(item: Omit<T, 'id'>): T
  /** Edita um item por id; devolve o atualizado ou undefined se não achar. */
  patch(id: string, partial: Partial<Omit<T, 'id'>>): T | undefined
  /** Remove os ids informados; devolve quantos saíram. */
  remove(ids: string[]): number
  /** Esvazia a coleção. */
  clear(): void
}

/** UUID quando disponível (evita colisão de Date.now() em lote/multiusuário). */
function novoId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createRepo<T extends { id: string }>(arquivo: string, defaults: T[] = []): Repo<T> {
  const ler = () => lerJSON<T[]>(arquivo, defaults)

  function update(mutator: (lista: T[]) => T[]): T[] {
    const proxima = mutator(ler())
    escreverJSON(arquivo, proxima)
    return proxima
  }

  return {
    all: ler,
    byId: (id) => ler().find((x) => x.id === id),
    update,
    create(item) {
      const novo = { ...(item as object), id: novoId() } as T
      update((lista) => [...lista, novo])
      return novo
    },
    patch(id, partial) {
      let achou: T | undefined
      update((lista) => lista.map((x) => {
        if (x.id !== id) return x
        achou = { ...x, ...partial, id: x.id } as T
        return achou
      }))
      return achou
    },
    remove(ids) {
      const set = new Set(ids)
      let n = 0
      update((lista) => lista.filter((x) => (set.has(x.id) ? (n++, false) : true)))
      return n
    },
    clear() { update(() => []) },
  }
}
