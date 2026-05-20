const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // PDF
  salvarPDF:       (filename)  => ipcRenderer.invoke('pdf:save',              { filename }),
  salvarPDFNaEut:  (filename, folderPath) => ipcRenderer.invoke('pdf:save-eut', { filename, folderPath }),
  deletePdfCopy:   (pdfPath)   => ipcRenderer.invoke('pdf:delete-copy',       { pdfPath }),
  findPdfCopy:     (query)     => ipcRenderer.invoke('pdf:find-in-copy-folder', { query }),

  // Excel
  checkProtocolo:  (protocolo) => ipcRenderer.invoke('excel:check-protocolo', { protocolo }),
  proximoNumero:   ()          => ipcRenderer.invoke('excel:proximo-numero'),
  registrarExcel:  (dados)     => ipcRenderer.invoke('excel:registrar',       dados),

  // Docx
  parseDocx:       (arr)       => ipcRenderer.invoke('docx:parse',            { buffer: arr }),

  // Pasta EUT
  abrirPastaEut:   ()          => ipcRenderer.invoke('eut:open-folder'),
  getEutFolder:    ()          => ipcRenderer.invoke('eut:get-folder'),
  limparPastaEut:  ()          => ipcRenderer.invoke('eut:clear-folder'),

  // Configurações
  getSettings:     ()          => ipcRenderer.invoke('settings:get'),
  setSettings:     (partial)   => ipcRenderer.invoke('settings:set',          partial),
  browseExcel:     ()          => ipcRenderer.invoke('settings:browse-excel'),
  browseFolder:    (title)     => ipcRenderer.invoke('settings:browse-folder', { title }),
  getLocalDataDir: ()          => ipcRenderer.invoke('settings:get-local-data-dir'),

  // Dados de rede (clientes / relatórios / agenda)
  getClientes:     ()          => ipcRenderer.invoke('data:get-clientes'),
  saveClientes:    (clientes)  => ipcRenderer.invoke('data:save-clientes',    { clientes }),
  getRelatorios:   ()          => ipcRenderer.invoke('data:get-relatorios'),
  saveRelatorios:  (relatorios) => ipcRenderer.invoke('data:save-relatorios', { relatorios }),
  getAgenda:       ()          => ipcRenderer.invoke('data:get-agenda'),
  saveAgenda:      (agenda)    => ipcRenderer.invoke('data:save-agenda',      { agenda }),
  // OCR local (Windows.Media.Ocr)
  recognizeOcr:    (images)  => ipcRenderer.invoke('ocr:recognize', { images }),

  // Follow-up PDF direto
  saveFollowupPdf: (html, filename, landscape) => ipcRenderer.invoke('pdf:followup', { html, filename, landscape }),

  // Shell / arquivos
  openPath:        (path)  => ipcRenderer.invoke('shell:open-path',       { path }),
  browsePDF:       ()      => ipcRenderer.invoke('settings:browse-pdf'),
  focusWindow:     ()      => ipcRenderer.invoke('window:focus'),

  // Eventos do menu
  onMenuSalvarPDF:    (cb) => ipcRenderer.on('menu:salvar-pdf',     () => cb()),
  onMenuSalvarPDFEut: (cb) => ipcRenderer.on('menu:salvar-pdf-eut', () => cb()),
})
