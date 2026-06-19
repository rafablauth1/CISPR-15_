// Captura as 5 telas do Módulo Lab que faltavam no manual.
const puppeteer = require('puppeteer-core')
const fs = require('fs'); const path = require('path')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:3000'
const OUT  = path.join('C:', 'Users', 'Notla', 'OneDrive', 'Área de Trabalho', 'DIONATA', 'cispr15-standalone', 'screenshots_manual')
const shots = [
  ['lab_dashboard.png',        '/dashboard'],
  ['lab_equipamentos.png',     '/equipamentos'],
  ['lab_certificado_grade.png','/certificados'],
  ['lab_checagens.png',        '/checagens'],
  ['lab_procedimentos.png',    '/procedimentos'],
]
;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new', args: ['--no-sandbox'],
    defaultViewport: { width: 1460, height: 1000, deviceScaleFactor: 2 },
  })
  const page = await browser.newPage()
  for (const [name, route] of shots) {
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 })
      await new Promise(r => setTimeout(r, 1800))
      await page.screenshot({ path: path.join(OUT, name) })
      console.log('OK', name)
    } catch (e) { console.log('ERRO', name, String(e).slice(0, 80)) }
  }
  await browser.close()
})()
