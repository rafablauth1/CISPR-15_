import fs from 'fs'
import path from 'path'
import { readSettings, getUserDataDir } from '@/lib/settings-server'

function getDadosDir(): string {
  const { dataFolder } = readSettings()
  // Sem pasta de rede configurada, grava em userData/dados (MESMO lugar gravável do
  // Electron). NUNCA usar process.cwd(): no app empacotado é a pasta de instalação
  // (somente leitura) → escrita falha e "não salva" grupos/labs/equipamentos.
  return dataFolder || path.join(getUserDataDir(), 'dados')
}

/** Caminho absoluto de um arquivo de dados. */
export function caminhoDados(arquivo: string): string {
  return path.join(getDadosDir(), arquivo)
}

// Lê um JSON. Se o arquivo principal existir mas estiver corrompido/ilegível,
// tenta o backup .bak antes de cair no padrão — assim um arquivo truncado não
// apaga os dados na próxima leitura. (Arquivo ausente → padrão, como antes.)
export function lerJSON<T>(arquivo: string, padrao: T): T {
  const p = caminhoDados(arquivo)
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
  } catch {
    try {
      const bak = p + '.bak'
      if (fs.existsSync(bak)) return JSON.parse(fs.readFileSync(bak, 'utf-8')) as T
    } catch {}
  }
  return padrao
}

// Escrita ATÔMICA: grava num .tmp e faz rename (atômico no mesmo volume), mantendo
// um .bak da versão anterior. O arquivo final nunca fica pela metade. Se o rename
// falhar em algum filesystem, cai pra escrita direta — nunca perde a capacidade de salvar.
export function escreverJSON(arquivo: string, dados: unknown): void {
  const p = caminhoDados(arquivo)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const json = JSON.stringify(dados, null, 2)

  // backup da versão atual antes de sobrescrever
  if (fs.existsSync(p)) {
    try { fs.copyFileSync(p, p + '.bak') } catch {}
  }

  const tmp = `${p}.tmp.${process.pid}.${Date.now()}`
  try {
    fs.writeFileSync(tmp, json, 'utf-8')
    fs.renameSync(tmp, p)   // atômico no mesmo volume
  } catch {
    // Fallback robusto: escrita direta (ex.: filesystem sem rename atômico).
    try { fs.unlinkSync(tmp) } catch {}
    fs.writeFileSync(p, json, 'utf-8')
  }
}
