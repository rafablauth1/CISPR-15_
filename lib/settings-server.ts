import fs from 'fs'
import path from 'path'

export interface AppSettings {
  excelPath: string
  dataFolder: string
  pdfAutoSaveToEut: boolean
}

const DEFAULTS: AppSettings = {
  excelPath: '',
  dataFolder: '',
  pdfAutoSaveToEut: true,
}

// Pasta de userData — MESMA que o Electron usa (app.getPath('userData') =
// %APPDATA%/CISPR 15 LABELO). É gravável; o cwd do servidor Next empacotado NÃO é.
export function getUserDataDir(): string {
  return (
    process.env.CISPR_USER_DATA ||
    (process.env.APPDATA ? path.join(process.env.APPDATA, 'CISPR 15 LABELO') : null) ||
    path.join(process.env.HOME || '.', '.cispr15-labelo')
  )
}

export function getSettingsFilePath(): string {
  return path.join(getUserDataDir(), 'settings.json')
}

export function readSettings(): AppSettings {
  try {
    const p = getSettingsFilePath()
    if (fs.existsSync(p)) {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(p, 'utf-8')) }
    }
  } catch {}
  return { ...DEFAULTS }
}

export function writeSettings(settings: Partial<AppSettings>): AppSettings {
  const current = readSettings()
  const merged = { ...current, ...settings }
  const p = getSettingsFilePath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}
