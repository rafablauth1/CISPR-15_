// Extrai texto de todos os PDFs de "D:\Certificados Outros LAB" usando pdf-parse
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const ROOT = 'D:\\Certificados Outros LAB';
const OUT = path.join(__dirname, '..', 'tmp_cert_extract');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (name.toLowerCase().endsWith('.pdf')) acc.push(full);
  }
  return acc;
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const pdfs = walk(ROOT);
  console.log('Encontrados ' + pdfs.length + ' PDFs');
  let i = 0;
  for (const file of pdfs) {
    i++;
    const lab = path.relative(ROOT, file).split(path.sep)[0];
    const base = (i).toString().padStart(2, '0') + '_' + lab.replace(/[^\w]+/g, '_') + '_' + path.basename(file, '.pdf').replace(/[^\w]+/g, '_');
    try {
      const data = await pdfParse(fs.readFileSync(file));
      const header = `### ARQUIVO: ${file}\n### LAB(pasta): ${lab}\n### PAGINAS: ${data.numpages}\n` + '='.repeat(80) + '\n';
      fs.writeFileSync(path.join(OUT, base + '.txt'), header + data.text, 'utf8');
      console.log(`[OK ${i}/${pdfs.length}] ${lab} -> ${base}.txt (${data.text.length} chars, ${data.numpages}p)`);
    } catch (e) {
      fs.writeFileSync(path.join(OUT, base + '.ERRO.txt'), 'ERRO: ' + e.message, 'utf8');
      console.log(`[ERRO ${i}/${pdfs.length}] ${lab}: ${e.message}`);
    }
  }
  console.log('Saida em: ' + OUT);
})();
