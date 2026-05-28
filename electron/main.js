const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage, nativeTheme } = require('electron')
const path    = require('path')
const http    = require('http')
const fs      = require('fs')
const os      = require('os')
const { execFile, spawn } = require('child_process')
const XLSX    = require('xlsx')
const mammoth = require('mammoth')
const { listSigningCerts, signPDF } = require('./pdf-signer')

/* ─── PowerShell script para Windows OCR ─────────────────────────────────── */
const PS_OCR_SCRIPT = `
param([string]$ImgPath)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
function Await($task) {
  $t = [System.WindowsRuntimeSystemExtensions]::AsTask($task)
  [void]$t.Wait(-1)
  $t.Result
}
$null = [Windows.Media.Ocr.OcrEngine,            Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile,            Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language,          Windows.Foundation, ContentType=WindowsRuntime]
try {
  $file    = Await([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImgPath))
  $stream  = Await($file.OpenAsync(0))
  $decoder = Await([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream))
  $bitmap  = Await($decoder.GetSoftwareBitmapAsync())
  $engine  = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('pt-BR'))
  if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
  if (-not $engine) { throw 'OCR engine unavailable' }
  $result  = Await($engine.RecognizeAsync($bitmap))
  $result.Lines | ForEach-Object { $_.Text }
} catch { }
`

const DEV_PORT  = 3000
const PROD_PORT = 3721
const APP_PATH  = '/dashboard'

const ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets', 'icon.ico')
  : path.join(__dirname, '../assets/icon.ico')

app.setAppUserModelId('br.pucrs.labelo.cispr15')

if (app.isPackaged) {
  app.commandLine.appendSwitch('disable-background-networking')
  app.commandLine.appendSwitch('disable-component-update')
  app.commandLine.appendSwitch('disable-sync')
  app.commandLine.appendSwitch('no-pings')
  app.commandLine.appendSwitch('disable-breakpad')
}

/* pasta da EUT ativa */
let eutFolderPath = null

/* ─── settings ────────────────────────────────────────────────────────────── */

const SETTINGS_DEFAULTS = { excelPath: '', dataFolder: '', agendaFolder: '', pdfCopyFolder: '', pdfAutoSaveToEut: true, updateFolder: '', certThumbprint: '' }

/* pasta raiz do app:
   - dev:       …/cispr15-standalone/
   - instalado: …/AppData/Local/Programs/CISPR 15 LABELO/   (junto ao exe)  */
function getAppRoot() {
  if (app.isPackaged) return path.dirname(app.getPath('exe'))
  return path.join(__dirname, '..')
}

/* defaults de pasta — dados em userData (sobrevive a updates/reinstalações) */
function getDefaultPaths() {
  const root     = getAppRoot()
  const userData = app.getPath('userData')
  return {
    excelPath:     'C:\\Users\\Notla\\OneDrive\\Área de Trabalho\\Compatibilidade eletromagnética_2026.xlsx',
    dataFolder:    path.join(userData, 'dados'),
    agendaFolder:  path.join(userData, 'agenda'),
    pdfCopyFolder: path.join(userData, 'pdfs'),
    updateFolder:  path.join(root, 'updates'),
  }
}

function getUserDataDir() {
  return app.getPath('userData')
}

function getSettingsFile() {
  return path.join(getUserDataDir(), 'settings.json')
}

function readSettings() {
  const def = { ...SETTINGS_DEFAULTS, ...getDefaultPaths() }
  try {
    const f = getSettingsFile()
    if (fs.existsSync(f)) {
      const saved = JSON.parse(fs.readFileSync(f, 'utf-8'))
      return { ...def, ...saved }
    }
  } catch {}
  return def
}

/* Migra dados antigos (dentro da pasta do app) para userData, uma única vez */
function migrateDataFolders() {
  const root    = getAppRoot()
  const userData = app.getPath('userData')
  const files   = ['cispr15_relatorios.json', 'cispr15_clientes.json']
  const agFile  = 'cispr15_agenda.json'

  // dados e agenda
  const oldDirs = [
    { old: path.join(root, 'dados'),  new: path.join(userData, 'dados'),  list: files },
    { old: path.join(root, 'agenda'), new: path.join(userData, 'agenda'), list: [agFile] },
  ]
  for (const { old: oldDir, new: newDir, list } of oldDirs) {
    if (!fs.existsSync(oldDir)) continue
    fs.mkdirSync(newDir, { recursive: true })
    for (const file of list) {
      const src = path.join(oldDir, file)
      const dst = path.join(newDir, file)
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        try { fs.copyFileSync(src, dst) } catch {}
      }
    }
  }
}

function writeSettings(partial) {
  const merged = { ...readSettings(), ...partial }
  const f = getSettingsFile()
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}

/* ─── dados (rede ou local) ───────────────────────────────────────────────── */

function getDefaultDataDir() {
  return getDefaultPaths().dataFolder
}

function dataFilePath(filename) {
  const { dataFolder } = readSettings()
  return path.join(dataFolder || getDefaultDataDir(), filename)
}

function agendaFilePath() {
  const { agendaFolder, dataFolder } = readSettings()
  return path.join(agendaFolder || dataFolder || getDefaultDataDir(), 'cispr15_agenda.json')
}

function readAgendaFile() {
  const fp = agendaFilePath()
  try {
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'))
  } catch {}
  return []
}

function writeAgendaFile(data) {
  const fp = agendaFilePath()
  fs.mkdirSync(path.dirname(fp), { recursive: true })
  let lastErr = null
  for (let i = 0; i < 4; i++) {
    try { fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8'); return }
    catch (e) { lastErr = e }
  }
  throw lastErr
}

function copyPdfToFolder(filePath) {
  const { pdfCopyFolder } = readSettings()
  if (!pdfCopyFolder || !filePath) return
  try {
    fs.mkdirSync(pdfCopyFolder, { recursive: true })
    fs.copyFileSync(filePath, path.join(pdfCopyFolder, path.basename(filePath)))
  } catch {}
}

function readDataFile(filename) {
  const fp = dataFilePath(filename)
  try {
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'))
  } catch {}
  return []
}

function writeDataFile(filename, data) {
  const fp = dataFilePath(filename)
  fs.mkdirSync(path.dirname(fp), { recursive: true })
  let lastErr = null
  for (let i = 0; i < 4; i++) {
    try { fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8'); return }
    catch (e) { lastErr = e }
  }
  throw lastErr
}

/* ─── utilitários ─────────────────────────────────────────────────────────── */

function ping(port) {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 800 }, () => {
      req.destroy(); resolve(true)
    })
    req.on('error',   () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.end()
  })
}

function waitForServer(port, timeoutMs = 120_000, proc) {
  return new Promise((resolve, reject) => {
    let done = false
    const deadline = Date.now() + timeoutMs
    if (proc) {
      proc.on('exit', (code) => {
        if (!done) { done = true; reject(new Error(`Servidor encerrou inesperadamente (código ${code ?? '?'}). Veja ${app.getPath('userData')}\\server.log`)) }
      })
    }
    async function attempt() {
      if (done) return
      if (await ping(port)) { done = true; return resolve() }
      if (Date.now() >= deadline) { done = true; return reject(new Error('Servidor não respondeu em ' + (timeoutMs / 1000) + 's')) }
      setTimeout(attempt, 600)
    }
    attempt()
  })
}

async function writeWithRetry(filePath, data, retries = 4) {
  for (let i = 0; i <= retries; i++) {
    try { fs.writeFileSync(filePath, data); return }
    catch (err) {
      if (i === retries) throw err
      await new Promise(r => setTimeout(r, 400 * (i + 1)))
    }
  }
}

/* ─── janela ──────────────────────────────────────────────────────────────── */

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    title: 'CISPR 15 — LABELO/PUCRS',
    backgroundColor: '#0B0E14',
    icon: nativeImage.createFromPath(ICON_PATH),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  /* Barra de título nativa em dark mode para combinar com o tema escuro do app. */
  nativeTheme.themeSource = 'dark'
  win.setMenuBarVisibility(true)

  const HIDE_CHROME_CSS = `aside { display: none !important; } header.sticky { display: none !important; }`
  win.webContents.on('did-start-loading', () => {
    win.webContents.insertCSS(HIDE_CHROME_CSS).catch(() => {})
  })

  win.loadFile(path.join(__dirname, 'loading.html'))
  win.maximize()
  win.show()

  let port

  if (!app.isPackaged) {
    if (await ping(DEV_PORT)) {
      port = DEV_PORT
    } else {
      const standaloneDir    = path.resolve(__dirname, '../.next/standalone')
      const standaloneScript = path.join(standaloneDir, 'server.js')
      if (!fs.existsSync(standaloneScript)) {
        dialog.showErrorBox(
          'Build não encontrado',
          'Execute "npm run build" na pasta cispr15-standalone antes de iniciar.\n\nEsperado em:\n' + standaloneDir
        )
        app.quit(); return
      }
      port = PROD_PORT
      try { const proc = await startServer(standaloneDir); await waitForServer(PROD_PORT, 120_000, proc) }
      catch (err) { dialog.showErrorBox('Erro ao iniciar servidor', String(err)); app.quit(); return }
    }
  } else {
    port = PROD_PORT
    try { const proc = await startServer(path.join(process.resourcesPath, 'nextapp')); await waitForServer(PROD_PORT, 120_000, proc) }
    catch (err) { dialog.showErrorBox('Erro ao iniciar CISPR 15', String(err)); app.quit(); return }
  }

  win.loadURL('http://127.0.0.1:' + port + APP_PATH)
}

/* ─── servidor Next.js ────────────────────────────────────────────────────── */

let serverProcess = null

async function startServer(appDir) {
  const { utilityProcess } = require('electron')
  const serverScript = path.join(appDir, 'server.js')
  if (!fs.existsSync(serverScript)) throw new Error('server.js não encontrado em:\n' + serverScript)

  const logPath = path.join(app.getPath('userData'), 'server.log')
  const log = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' })
  log.write(`\n--- start ${new Date().toISOString()} ---\n`)

  serverProcess = utilityProcess.fork(serverScript, [], {
    env: {
      ...process.env,
      PORT: String(PROD_PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      CISPR_USER_DATA: getUserDataDir(),
    },
    cwd: appDir, stdio: 'pipe',
  })
  if (serverProcess.stdout) serverProcess.stdout.on('data', d => log.write('[OUT] ' + d))
  if (serverProcess.stderr) serverProcess.stderr.on('data', d => log.write('[ERR] ' + d))
  serverProcess.on('exit', (code) => {
    log.write(`--- exit code=${code} ${new Date().toISOString()} ---\n`)
    log.end()
    serverProcess = null
  })
  return serverProcess
}

/* ─── menu ────────────────────────────────────────────────────────────────── */

function openPage(win, path_) {
  const port = app.isPackaged ? PROD_PORT : DEV_PORT
  win?.loadURL('http://127.0.0.1:' + port + path_)
}

function buildMenu(port) {
  return Menu.buildFromTemplate([
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Abrir pasta da EUT no Explorer',
          click: () => { if (eutFolderPath) shell.openPath(eutFolderPath) },
        },
        { type: 'separator' },
        {
          label: 'Configurações',
          accelerator: 'CmdOrCtrl+,',
          click: () => openPage(BrowserWindow.getFocusedWindow(), '/configuracoes'),
        },
        { type: 'separator' },
        { label: 'Sair', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
    {
      label: 'Formulários',
      submenu: [
        {
          label: 'CISPR 15 — Iluminação',
          click: () => openPage(BrowserWindow.getFocusedWindow(), '/cispr15'),
        },
      ],
    },
    {
      label: 'Agenda',
      submenu: [
        {
          label: 'Agenda de Execução',
          accelerator: 'CmdOrCtrl+A',
          click: () => openPage(BrowserWindow.getFocusedWindow(), '/agenda'),
        },
      ],
    },
    {
      label: 'Relatório',
      submenu: [
        {
          label: 'Salvar PDF',
          accelerator: 'CmdOrCtrl+P',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('menu:salvar-pdf'),
        },
        {
          label: 'Salvar PDF na pasta da EUT',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('menu:salvar-pdf-eut'),
        },
        {
          label: 'Salvar HTML na pasta da EUT',
          click: async () => {
            const win = BrowserWindow.getFocusedWindow()
            if (!win || !eutFolderPath) {
              dialog.showMessageBox({ type: 'info', message: 'Selecione uma pasta da EUT primeiro.' })
              return
            }
            const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
            const outPath = path.join(eutFolderPath, 'relatorio.html')
            fs.writeFileSync(outPath, html)
            shell.showItemInFolder(outPath)
          },
        },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        { label: `CISPR 15 LABELO  v${app.getVersion()}`, enabled: false },
      ],
    },
  ])
}

/* ─── ciclo de vida ───────────────────────────────────────────────────────── */

app.whenReady().then(() => {
  // migra dados antigos (dentro do app) para userData, se necessário
  try { migrateDataFolders() } catch {}
  // garante que as pastas de dados existam
  const dp = getDefaultPaths()
  for (const dir of [dp.dataFolder, dp.agendaFolder, dp.pdfCopyFolder, dp.updateFolder]) {
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
  }
  Menu.setApplicationMenu(buildMenu())
  createWindow()
})

app.on('window-all-closed', () => {
  if (serverProcess) { serverProcess.kill(); serverProcess = null }
  app.quit()
})

/* ─── IPC: Settings ───────────────────────────────────────────────────────── */

ipcMain.handle('settings:get', () => readSettings())

ipcMain.handle('settings:set', (_, partial) => {
  try { return { ok: true, settings: writeSettings(partial) } }
  catch (err) { return { ok: false, error: String(err) } }
})

ipcMain.handle('settings:browse-excel', async () => {
  const win = BrowserWindow.getFocusedWindow()
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Selecionar planilha Excel',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return { canceled: true }
  return { filePath: filePaths[0] }
})

ipcMain.handle('settings:browse-folder', async (_, { title }) => {
  const win = BrowserWindow.getFocusedWindow()
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: title || 'Selecionar pasta',
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths.length) return { canceled: true }
  return { folderPath: filePaths[0] }
})

ipcMain.handle('settings:browse-pdf', async () => {
  const win = BrowserWindow.getFocusedWindow()
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Selecionar PDF do Relatório',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return { canceled: true }
  return { filePath: filePaths[0] }
})

ipcMain.handle('shell:open-path', async (_, { path: p }) => {
  try { await shell.openPath(p); return { ok: true } }
  catch (err) { return { ok: false, error: String(err) } }
})

/* ─── IPC: Dados de rede (clientes / relatórios) ─────────────────────────── */

ipcMain.handle('data:get-clientes', () => {
  const { dataFolder } = readSettings()
  const data = readDataFile('cispr15_clientes.json')
  return { ok: true, clientes: data ?? [], fromNetwork: !!dataFolder }
})

ipcMain.handle('data:save-clientes', (_, { clientes }) => {
  try { writeDataFile('cispr15_clientes.json', clientes); return { ok: true } }
  catch (err) { return { ok: false, error: String(err) } }
})

ipcMain.handle('data:get-relatorios', () => {
  const { dataFolder } = readSettings()
  const data = readDataFile('cispr15_relatorios.json')
  return { ok: true, relatorios: data ?? [], fromNetwork: !!dataFolder }
})

ipcMain.handle('data:save-relatorios', (_, { relatorios }) => {
  try { writeDataFile('cispr15_relatorios.json', relatorios); return { ok: true } }
  catch (err) { return { ok: false, error: String(err) } }
})

ipcMain.handle('data:get-agenda', () => {
  const { agendaFolder, dataFolder } = readSettings()
  const data = readAgendaFile()
  return { ok: true, agenda: data ?? [], fromNetwork: !!(agendaFolder || dataFolder) }
})

ipcMain.handle('data:save-agenda', (_, { agenda }) => {
  try { writeAgendaFile(agenda); return { ok: true } }
  catch (err) { return { ok: false, error: String(err) } }
})

ipcMain.handle('settings:get-local-data-dir', () => getDefaultDataDir())

/* ─── IPC: PDF ────────────────────────────────────────────────────────────── */

ipcMain.handle('pdf:save', async (_, { filename }) => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return { ok: false, error: 'sem janela' }
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Salvar Relatório PDF',
    defaultPath: filename || 'relatorio-cispr15.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return { ok: false, canceled: true }
  try {
    const data = await win.webContents.printToPDF({
      printBackground: true, pageSize: 'A4', landscape: false,
      margins: { marginType: 'none' }, displayHeaderFooter: false,
    })
    fs.writeFileSync(filePath, data)
    shell.openPath(filePath)
    return { ok: true, filePath }
  } catch (err) { return { ok: false, error: String(err) } }
})

ipcMain.handle('pdf:save-eut', async (_, { filename, folderPath }) => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (!win) return { ok: false, error: 'sem janela' }
  try {
    let outDir = folderPath || eutFolderPath || app.getPath('documents')
    let usedDocuments = false
    // Tenta garantir que o diretório exista; se falhar (ex: pasta de rede inacessível), recai para Documentos
    if (outDir !== app.getPath('documents')) {
      try {
        fs.mkdirSync(outDir, { recursive: true })
      } catch {
        outDir = app.getPath('documents')
        usedDocuments = true
      }
    }
    const outPath = path.join(outDir, (filename || 'relatorio.pdf').replace(/[\\/:"*?<>|]/g, '_'))
    // Se já existe, apenas abre a pasta sem regerar
    if (fs.existsSync(outPath)) {
      shell.showItemInFolder(outPath)
      return { ok: true, filePath: outPath, skipped: true, usedDocuments }
    }
    const data = await win.webContents.printToPDF({
      printBackground: true, pageSize: 'A4', landscape: false,
      margins: { marginType: 'none' }, displayHeaderFooter: false,
    })
    await writeWithRetry(outPath, data)
    shell.showItemInFolder(outPath)
    return { ok: true, filePath: outPath, usedDocuments }
  } catch (err) { return { ok: false, error: String(err) } }
})

// Lista certificados com chave privada disponíveis no Windows Certificate Store
ipcMain.handle('pdf:list-certs', async () => {
  try {
    const certs = listSigningCerts()
    return { ok: true, certs }
  } catch (err) {
    return { ok: false, error: String(err), certs: [] }
  }
})

// Assina digitalmente um PDF já salvo na pasta da EUT
ipcMain.handle('pdf:sign-file', async (_, { eutFolderPath: eutPath, pdfFilename }) => {
  const { certThumbprint } = readSettings()
  if (!certThumbprint) return { ok: false, error: 'Nenhum certificado configurado em Configurações → Assinatura Digital.' }
  if (!eutPath || !pdfFilename) return { ok: false, error: 'Caminho da pasta EUT não disponível.' }
  const pdfPath = path.join(eutPath, pdfFilename)
  if (!fs.existsSync(pdfPath)) return { ok: false, error: `PDF não encontrado:\n${pdfPath}` }
  try {
    const pdfBuffer = fs.readFileSync(pdfPath)
    const signed = await signPDF(pdfBuffer, certThumbprint)
    fs.writeFileSync(pdfPath, signed)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message || String(err) }
  }
})

// Copia o PDF assinado da pasta EUT para a pasta da agenda (acionado manualmente após assinatura)
ipcMain.handle('pdf:publish', async (_, { eutFolderPath: eutPath, pdfFilename }) => {
  const { pdfCopyFolder } = readSettings()
  if (!pdfCopyFolder) return { ok: false, error: 'Pasta de destino não configurada em Configurações.' }
  if (!eutPath || !pdfFilename) return { ok: false, error: 'Caminho da pasta EUT não disponível.' }
  const src = path.join(eutPath, pdfFilename)
  if (!fs.existsSync(src)) return { ok: false, error: `PDF não encontrado em:\n${src}` }
  try {
    fs.mkdirSync(pdfCopyFolder, { recursive: true })
    const dest = path.join(pdfCopyFolder, pdfFilename)
    fs.copyFileSync(src, dest)
    return { ok: true, dest }
  } catch (err) { return { ok: false, error: String(err) } }
})

ipcMain.handle('relatorio:cancel-pdf', async (_, { eutFolderPath: eutPath, pdfFilename }) => {
  const s = readSettings()
  const targets = []
  if (eutPath && pdfFilename) targets.push(path.join(eutPath, pdfFilename))
  if (s.pdfCopyFolder && pdfFilename) targets.push(path.join(s.pdfCopyFolder, pdfFilename))
  const deleted = []
  for (const p of targets) {
    try { if (fs.existsSync(p)) { fs.unlinkSync(p); deleted.push(p) } } catch {}
  }
  return { ok: true, deleted }
})

ipcMain.handle('pdf:followup', async (_, { html, filename, landscape }) => {
  const tmpPath = path.join(app.getPath('temp'), `fu_print_${Date.now()}.html`)
  let win = null
  try {
    fs.writeFileSync(tmpPath, html, 'utf-8')
    const docsDir = path.join(app.getPath('documents'), 'CISPR 15 LABELO', 'followup')
    fs.mkdirSync(docsDir, { recursive: true })
    const safe = (filename || 'followup.pdf').replace(/[\\/:"*?<>|]/g, '_')
    const outPath = path.join(docsDir, safe)
    win = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { javascript: false } })
    await win.loadFile(tmpPath)
    const data = await win.webContents.printToPDF({
      printBackground: true, pageSize: 'A4', landscape: !!landscape,
      margins: { marginType: 'minimum' }, displayHeaderFooter: false,
    })
    fs.writeFileSync(outPath, data)
    shell.showItemInFolder(outPath)
    return { ok: true, filePath: outPath }
  } catch (err) {
    return { ok: false, error: String(err) }
  } finally {
    try { if (win) win.destroy() } catch {}
    try { fs.unlinkSync(tmpPath) } catch {}
  }
})

ipcMain.handle('pdf:find-in-copy-folder', (_, { query }) => {
  const { pdfCopyFolder } = readSettings()
  if (!pdfCopyFolder || !query) return { ok: false, filePaths: [], folder: pdfCopyFolder }
  try {
    if (!fs.existsSync(pdfCopyFolder)) return { ok: false, filePaths: [], folder: pdfCopyFolder }
    const san = s => String(s).replace(/[/\\:*?"<>|\s]/g, '_').replace(/_+/g, '_').toLowerCase()
    const needle = san(query)
    const files = fs.readdirSync(pdfCopyFolder)
    const matches = files.filter(f => f.toLowerCase().endsWith('.pdf') && san(f).includes(needle))
    if (matches.length > 0) {
      const filePaths = matches.map(f => path.join(pdfCopyFolder, f))
      return { ok: true, filePaths, filePath: filePaths[0], folder: pdfCopyFolder }
    }
    return { ok: false, filePaths: [], folder: pdfCopyFolder }
  } catch (err) { return { ok: false, filePaths: [], error: String(err) } }
})

ipcMain.handle('pdf:delete-copy', (_, { pdfPath }) => {
  const { pdfCopyFolder } = readSettings()
  if (!pdfCopyFolder || !pdfPath) return { ok: true }
  try {
    const copyPath = path.join(pdfCopyFolder, path.basename(pdfPath))
    if (fs.existsSync(copyPath)) fs.unlinkSync(copyPath)
    return { ok: true }
  } catch (err) { return { ok: false, error: String(err) } }
})

/* ─── IPC: DOCX ───────────────────────────────────────────────────────────── */

ipcMain.handle('docx:parse', async (_, { buffer }) => {
  try {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })
    return { html: result.value }
  } catch (err) { return { error: String(err) } }
})

/* ─── IPC: Pasta da EUT ──────────────────────────────────────────────────── */

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tif', '.tiff'])

ipcMain.handle('eut:open-folder', async () => {
  const win = BrowserWindow.getFocusedWindow()
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Selecionar pasta da EUT (protocolo)',
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths.length) return { canceled: true }

  const folderPath = filePaths[0]
  eutFolderPath = folderPath
  const entries = fs.readdirSync(folderPath)

  let docxName = null, docxBuffer = null
  for (const f of entries) {
    if (f.toLowerCase().endsWith('.docx') && !f.startsWith('~')) {
      docxName   = f
      docxBuffer = Array.from(fs.readFileSync(path.join(folderPath, f)))
      break
    }
  }

  const imageFiles = []
  for (const f of entries) {
    const full = path.join(folderPath, f)
    const ext  = path.extname(f).toLowerCase()
    try {
      const stat = fs.statSync(full)
      if (stat.isFile() && IMAGE_EXTS.has(ext)) {
        imageFiles.push({ name: f, filePath: full })
      } else if (stat.isDirectory()) {
        for (const sf of fs.readdirSync(full)) {
          const sext = path.extname(sf).toLowerCase()
          if (IMAGE_EXTS.has(sext)) imageFiles.push({ name: sf, filePath: path.join(full, sf) })
        }
      }
    } catch {}
  }
  imageFiles.sort((a, b) => {
    const n = s => parseInt(s.replace(/\D/g, ''), 10) || 0
    return n(a.name) - n(b.name)
  })
  const images = imageFiles.map(({ name, filePath }) => ({
    name, ext: path.extname(name).toLowerCase().replace('.', ''),
    base64: fs.readFileSync(filePath).toString('base64'),
  }))

  return { ok: true, folderPath, folderName: path.basename(folderPath), docxName, docxBuffer, images }
})

ipcMain.handle('eut:get-folder',   () => ({ folderPath: eutFolderPath }))
ipcMain.handle('eut:clear-folder', () => { eutFolderPath = null; return { ok: true } })

ipcMain.handle('window:focus', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) { win.focus(); win.webContents.focus() }
  return { ok: true }
})



/* ─── IPC: Excel ──────────────────────────────────────────────────────────── */

function toExcelSerial(d) { return d.getTime() / 86400000 + 25569 }

function findNextEmptyRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1] === 'EMC' && rows[i][4] === '' && rows[i][5] === '' && rows[i][6] === '') return i
  }
  return -1
}

function getExcelPath() {
  const s = readSettings()
  if (s.excelPath) return s.excelPath
  return 'C:\\Users\\Notla\\OneDrive\\Área de Trabalho\\Compatibilidade eletromagnética_2026.xlsx'
}

ipcMain.handle('excel:check-protocolo', async (_, { protocolo }) => {
  const EXCEL_PATH = getExcelPath()
  try {
    if (!fs.existsSync(EXCEL_PATH)) return { exists: false, error: 'Planilha não encontrada' }
    const wb   = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
    const needle = protocolo.trim().toLowerCase()
    for (const row of rows) {
      const cell = String(row[6] ?? '').trim().toLowerCase()
      if (cell && cell === needle) {
        const num = row[2]; const year = new Date().getFullYear()
        return { exists: true, numRelatorio: num ? `EMC ${num}/${year}` : undefined }
      }
    }
    return { exists: false }
  } catch (err) { return { exists: false, error: String(err) } }
})

ipcMain.handle('excel:proximo-numero', async () => {
  const EXCEL_PATH = getExcelPath()
  try {
    if (!fs.existsSync(EXCEL_PATH)) return { error: 'Planilha não encontrada: ' + EXCEL_PATH }
    const wb   = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
    const idx  = findNextEmptyRow(rows)
    if (idx === -1) return { error: 'Sem linhas disponíveis' }
    const num = parseInt(String(rows[idx][2]), 10)
    return { proximoNumero: num, relatorio: `EMC ${num}/${new Date().getFullYear()}` }
  } catch (err) { return { error: String(err) } }
})

ipcMain.handle('excel:registrar', async (_, { cliente, produto, protocolo, orcamento, responsavel }) => {
  const EXCEL_PATH = getExcelPath()
  try {
    if (!fs.existsSync(EXCEL_PATH)) return { error: 'Planilha não encontrada: ' + EXCEL_PATH }
    // Lê só para encontrar a linha vazia (sem reescrever com XLSX para não perder formatação)
    const buf  = fs.readFileSync(EXCEL_PATH)
    const wb   = XLSX.read(buf, { type: 'buffer' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const idx  = findNextEmptyRow(rows)
    if (idx === -1) return { error: 'Sem linhas disponíveis' }
    const num    = parseInt(String(rows[idx][2]), 10)
    const row1   = idx + 1
    const orcNum = Number(orcamento)

    // Usa xlsx-populate para escrever preservando toda a formatação do modelo
    const XlsxPopulate = require('xlsx-populate')
    let lastErr = null
    for (let i = 1; i <= 4; i++) {
      try {
        const pop   = await XlsxPopulate.fromFileAsync(EXCEL_PATH)
        const sheet = pop.sheet(0)
        sheet.cell(`E${row1}`).value(cliente)
        sheet.cell(`F${row1}`).value(produto)
        sheet.cell(`G${row1}`).value(protocolo)
        sheet.cell(`H${row1}`).value(isNaN(orcNum) ? orcamento : orcNum)
        sheet.cell(`I${row1}`).value(new Date()).style('numberFormat', 'dd/mm/yyyy')
        sheet.cell(`J${row1}`).value(responsavel)
        await pop.toFileAsync(EXCEL_PATH)
        lastErr = null
        break
      } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 400 * i)) }
    }
    if (lastErr) throw lastErr
    return { numero: num, numRelatorio: `EMC ${num}/${new Date().getFullYear()}` }
  } catch (err) {
    const msg = String(err)
    return { error: msg + ((msg.includes('EBUSY') || msg.includes('EPERM')) ? ' — feche a planilha' : '') }
  }
})

/* ─── IPC: Auto-update ────────────────────────────────────────────────────── */

function semverGt(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

ipcMain.handle('update:check', async () => {
  try {
    const s = readSettings()
    if (!s.updateFolder) return { available: false }
    const versionFile = path.join(s.updateFolder, 'version.json')
    if (!fs.existsSync(versionFile)) return { available: false }
    const remote = JSON.parse(fs.readFileSync(versionFile, 'utf-8'))
    if (!remote.version || !remote.installer) return { available: false }
    if (semverGt(remote.version, app.getVersion())) {
      return { available: true, version: remote.version, installer: remote.installer }
    }
    return { available: false }
  } catch (err) {
    return { available: false, error: String(err) }
  }
})

ipcMain.handle('update:install', async (_, { installer }) => {
  try {
    const s = readSettings()
    const src  = path.join(s.updateFolder, installer)
    const dest = path.join(os.tmpdir(), installer)
    fs.copyFileSync(src, dest)
    spawn(dest, ['/SILENT', '/NORESTART'], { detached: true, stdio: 'ignore' }).unref()
    setTimeout(() => app.quit(), 800)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

/* ─── IPC: OCR (Windows.Media.Ocr via PowerShell) ────────────────────────── */

ipcMain.handle('ocr:recognize', async (_, { images }) => {
  const scriptPath = path.join(os.tmpdir(), 'cispr15_ocr_engine.ps1')
  try { fs.writeFileSync(scriptPath, PS_OCR_SCRIPT, 'utf-8') } catch {}

  const runOcr = (base64, idx) => new Promise((resolve) => {
    const tmpImg = path.join(os.tmpdir(), `cispr15_img_${Date.now()}_${idx}.jpg`)
    try { fs.writeFileSync(tmpImg, Buffer.from(base64, 'base64')) }
    catch { resolve(''); return }
    execFile(
      'powershell',
      ['-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-ImgPath', tmpImg],
      { timeout: 25000, encoding: 'utf8' },
      (err, stdout) => {
        try { fs.unlinkSync(tmpImg) } catch {}
        resolve(err ? '' : stdout.trim())
      }
    )
  })

  try {
    const texts = await Promise.all((images || []).slice(0, 4).map((img, i) => runOcr(img.base64, i)))
    return { ok: true, texts }
  } catch (err) {
    return { ok: false, error: String(err), texts: [] }
  }
})
