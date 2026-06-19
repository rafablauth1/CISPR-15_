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

export function lerJSON<T>(arquivo: string, padrao: T): T {
  try {
    const p = path.join(getDadosDir(), arquivo)
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
  } catch {}
  return padrao
}

export function escreverJSON(arquivo: string, dados: unknown): void {
  const p = path.join(getDadosDir(), arquivo)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(dados, null, 2), 'utf-8')
}
