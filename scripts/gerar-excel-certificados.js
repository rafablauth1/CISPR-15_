// Gera um .xlsx formatado (layout em BLOCOS: 1 certificado por bloco) a partir da analise
const XlsxPopulate = require('xlsx-populate');

const OUT = 'D:\\Certificados Outros LAB\\_ANALISE_certificados.xlsx';

const campos = [
  'Lab Emissor', 'Acreditação', 'Nº Certificado', 'Equipamento', 'Fabricante',
  'Modelo', 'Nº Série', 'Código/TAG', 'Grandeza', 'Faixa de Medição', 'Resolução',
  'Data Calibração', 'Validade/Próxima', 'Cliente', 'Procedimento',
  'Condições Ambientais', 'Confiança', 'Observações'
];

// pasta + valores na ordem de "campos"
const dados = [
  ['Alutal','Alutal Controles Industriais Ltda (calibração Atlas)','Não CGCRE — ISO 9001 / ISO 17025:1999 (Atlas)','1112-22','Câmara de exposição de luz (intemperismo)','Atlas Material Testing Technology LLC','Suntest CPS+','803002','—','Irradiância / Temperatura / Umidade','Irradiância 300 W/m²; Black Standard 35 °C','—','11/12/2025','Não declarada (padrões venc. 04/06/2026)','Lab. Analítico de Insumos Farmacêuticos (arquivo cita PUC/Labelo)','Atlas 30-5068-00','18 °C; 51 %UR','Média','Layout estrangeiro fora do padrão BR; não é grandeza elétrica; conferir cliente'],
  ['CHROMPACK_SCAN','Chrompack Inst. Científicos Ltda (Lab. Velocidade de Fluidos)','CGCRE CAL 0256','150.059','Anemômetro','DegreeC','UAS1200PC','0607-79752008','1695VNT','Velocidade do ar (m/s)','0,51 a 5,00 m/s','0,01 m/s','23/10/2023','Não consta (só venc. padrões)','PUCRS / LABELO','PRO-ANE-2000 Rev.3','20,1 °C; 65,3 %UR; 932,6 hPa','Baixa','PDF ESCANEADO com OCR ruim — revisar todos os campos manualmente'],
  ['CTJ','CTJ (Grupo CTJ)','CGCRE CAL 0477','P-7405/24 (OS OSP-1496/24)','Barômetro Analógico','Não identificado no texto','623ADV','2060595','CL-0610','Pressão (mbar)','650 a 1080 mbar','5 mbar','17/07/2024','Não consta','União Brasileira de Educação e Assistência (PUCRS)','PR-CTJ-026','20,8→20,9 °C; 42→43 %UR','Alta','Fabricante não aparece no texto extraído'],
  ['ELUS INSTRUMENTAÇÃO','Elus Instrumentação / Precisão Metrológica (Lab. Vazão)','CGCRE CAL 0439','E11863/23','Totalizador de Volume de Líquidos','Alfa Instrumentos','ACE-LDG-S-15-MF001NEL','12011092','3227LAV','Vazão / Volume (L/min)','~5,5 a 25 L/min (DN 15 mm)','1 pulso / 0,001 L','04/12/2023','Determinada pelo cliente','PUCRS','PCVL-001','21,70 °C; 56,50 %UR; 935,50 hPa','Alta',''],
  ['Holtermann','Holtermann Comercial e Técnica Ltda','CGCRE CAL 0382','31.169/22','Microdurômetro','Shimadzu','HMV-G 21DT','I63115100189','3212UDM','Dureza Vickers/Knoop (HV)','Escalas HV-1 e HV-0,5; forças 0,5 e 1 kgf','—','05/10/2022','Não declarada','PUCRS / LABELO (Lab. Materiais e Componentes)','PHC-06 rev.9 (ASTM E384-17/E92-17)','21,1 °C; 52 %UR','Alta',''],
  ['INMETRO','Inmetro — Dimci / Laraf','Inmetro (laboratório nacional)','DIMCI 1068/2025','Lâmpada incandescente halógena','Não identificado','230 V 20 W (soquete E27)','Não identificado','1987 LUM','Fluxo Luminoso (lm)','216 lm; 0,092 A; 228,9 V','—','17/09/2025','Não consta','União Brasileira de Educação e Assistência (PUCRS)','GUM 2008; padrão Laraf PT 011','25±2 °C; 60±15 %UR','Alta',''],
  ['ISI SIM SENAI','ISI SIM SENAI CETEMP (Lab. Dimensional)','CGCRE CAL 0013','00642/16','Medidor de espessura (relógio comparador)','Mitutoyo','Não consta (cód. série AGQ995)','7360','1223QUI','Comprimento / Espessura (mm)','0 a 10 mm','0,01 mm','11/02/2016','Não consta (padrões válidos até 08/2016)','União Brasileira de Educação e Assistência - LABELO','PRI 631-117','20±1 °C; ≤65 %UR','Alta','Distingue Nº série (7360) de cód. série (AGQ995)'],
  ['K&L','K&L Laboratórios de Metrologia','CGCRE (CAL não citado no texto)','L002787/2026','Torquímetro Axial','GEDORE','Não identificado (possível 6GX)','6GX 030371','1198DPC','Torque (cN.m)','20 a 120 cN.m','0,1 cN.m (1 div = 1 cN.m)','17/02/2026','Não consta (padrão venc. 11/2026)','União Brasileira de Educação e Assistência','PSQ-FTD.02 rev.003','20,0±1,0 °C','Média','Modelo x nº série ambíguos no texto'],
  ['KEYSIGHT','Keysight Technologies Medição Brasil Ltda','Não CGCRE — ISO 9001:2015; rastreável SI (CIPM MRA)','WO-00936667','Data Acquisition/Switch Unit (GPIB, RS232)','Keysight Technologies','34970A','MY58015424 (antigo MY41024308)','640DOM','Multigrandeza elétrica (V DC/AC, Freq, Ohms, I DC/AC)','Várias faixas','—','03/02/2025','Próxima até 03/02/2026','PUCRS','STE-50114553-B.02.03','23±5 °C; 20-80 %RH','Alta','Reparo por troca; nº série antigo MY41024308'],
  ['Metroquality','Metroquality (Lab. de Massa)','CGCRE (Cgcre citada, CAL não no texto)','40630/25','Balança eletro-mecânica','Ambíguo (linha "EOSN 90302980LUM")','Ambíguo (possível EOS)','Ambíguo (possível 90302980)','…LUM (incompleto)','Massa (kg)','0 a 100 kg','0,005 kg','30/10/2025','Não consta','União Brasileira de Educação e Assistência PUCRS','PCM 051 rev.09','21±2 °C; 76±16 %UR; 1009±1 hPa','Média','Fabricante/modelo/série/TAG grudados — revisar no PDF. Cancela cert. 40311/25'],
  ['Metrosul','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','Nula','PDF 100% ESCANEADO (imagem) — pdf-parse não extrai nada. Precisa OCR de imagem. Arquivo 4327-25.pdf'],
  ['Novus_SCAN','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','(não extraído)','Nula','PDF 100% ESCANEADO (imagem) — pdf-parse não extrai nada. Precisa OCR de imagem. Arquivo 4327-25.pdf (homônimo do Metrosul)'],
  ['Padrão Balancas','Padrão Balanças (Lab. de Massa)','CGCRE CAL 291','MA 010_06_23','Conjunto de Pesos Padrão (15 peças, classe E2)','Kn Waagen','Não consta','12.079.10','2894LIF','Massa (mg/g/kg)','1 g a 2 kg','—','05/06/2023','Não consta (cópia arquivada 4 anos)','União Brasileira de Educação e Assistência / LABELO','IT 022 (OIML R111-1, ABBA)','20,9 °C; 51,7 %UR; 933 hPa','Alta','Classe declarada E2'],
  ['Senai','Instituto SENAI de Inovação Metalmecânica - CETEMP (Lab. Volumetria)','CGCRE CAL 0013','01305/19','Balão Volumétrico','Brand','Não consta','Não consta','1511QUI','Volume (mL)','100 mL','—','12/06/2019','Não consta','União Brasileira de Educação e Assistência - LABELO','PRI 631/68 rev.09; gravimétrico ASTM E542-01','20±1 °C; 60±10 %UR; 1013±50 hPa','Alta',''],
];

const mapaRows = [
  ['Chrompack','Nº de Identificação'],['CTJ','Cód. de Identificação / ID Code'],
  ['ELUS','Identificação'],['Holtermann','Número do cliente (também "Local de instalação: LABELO")'],
  ['Inmetro','Código de Identificação'],['ISI SIM SENAI','Código de identificação do proprietário'],
  ['K&L','Código'],['Keysight','Ativo Nº'],
  ['Metroquality','(grudado na linha do instrumento — sufixo …LUM)'],
  ['Padrão Balanças','Identificação do Conjunto'],['Senai','Identificação'],
];

const confCor = { 'Alta': 'C6EFCE', 'Média': 'FFEB9C', 'Baixa': 'FCD5B4', 'Nula': 'F4B0B0' };
const confTexto = { 'Alta': '006100', 'Média': '9C6500', 'Baixa': '974706', 'Nula': '9C0006' };
const AZUL = '1F4E78', AZUL_CLARO = 'DDEBF7', CINZA = 'F2F2F2';

(async () => {
  const wb = await XlsxPopulate.fromBlankAsync();
  const ws = wb.sheet(0).name('Certificados');
  ws.column(1).width(22);
  ws.column(2).width(80);

  let r = 1;
  for (const linha of dados) {
    const pasta = linha[0];
    const valores = linha.slice(1);
    const equip = valores[3] === '(não extraído)' ? '(não extraído)' : valores[3];

    // Título do bloco (merge A:B)
    ws.cell(r, 1).value('▎ ' + pasta + '  —  ' + equip);
    ws.range(r, 1, r, 2).merged(true).style({
      bold: true, fontSize: 12, fontColor: 'FFFFFF', fill: AZUL,
      verticalAlignment: 'center', horizontalAlignment: 'left'
    });
    ws.row(r).height(24);
    r++;

    // Campos do bloco
    campos.forEach((campo, ci) => {
      const val = valores[ci];
      const isNaoExtraido = String(val).startsWith('(não');
      const isConf = campo === 'Confiança';

      ws.cell(r, 1).value(campo).style({
        bold: true, fontColor: '1F4E78', fill: AZUL_CLARO,
        verticalAlignment: 'top', horizontalAlignment: 'left',
        border: { top: { style: 'hair', color: 'FFFFFF' }, right: { style: 'thin', color: 'FFFFFF' } }
      });

      const cell = ws.cell(r, 2).value(val);
      cell.style({
        wrapText: true, verticalAlignment: 'top', horizontalAlignment: 'left',
        fontColor: isNaoExtraido ? '999999' : '000000', italic: isNaoExtraido,
        fill: (ci % 2 === 1 ? CINZA : 'FFFFFF'),
        border: { bottom: { style: 'hair', color: 'D9D9D9' } }
      });
      if (isConf && confCor[val]) {
        cell.style({ fill: confCor[val], fontColor: confTexto[val], bold: true });
      }
      // altura conforme tamanho do texto
      const len = String(val).length;
      ws.row(r).height(len > 60 ? 30 : 15);
      r++;
    });

    // Linha em branco entre blocos
    r++;
  }

  ws.freezePanes(0, 0);

  // ===== Aba 2: Mapa de rotulos =====
  const ws2 = wb.addSheet('Mapa de rótulos (TAG)');
  ws2.cell('A1').value('Como cada laboratório nomeia o Código/TAG do cliente');
  ws2.range(1, 1, 1, 2).merged(true).style({ bold: true, fontSize: 12, fontColor: 'FFFFFF', fill: AZUL, verticalAlignment: 'center' });
  ws2.cell('A2').value('Padrão LABELO = número + 3 letras (ex.: 1987LUM, 640DOM, 3212UDM, 1198DPC)');
  ws2.range(2, 1, 2, 2).merged(true).style({ italic: true, fontColor: '555555' });
  ws2.cell(3, 1).value('Laboratório').style({ bold: true, fontColor: 'FFFFFF', fill: AZUL });
  ws2.cell(3, 2).value('Rótulo usado para a TAG do cliente').style({ bold: true, fontColor: 'FFFFFF', fill: AZUL });
  mapaRows.forEach((m, i) => {
    ws2.cell(i + 4, 1).value(m[0]).style({ bold: true, fill: AZUL_CLARO, verticalAlignment: 'top' });
    ws2.cell(i + 4, 2).value(m[1]).style({ wrapText: true, verticalAlignment: 'top', fill: (i % 2 ? CINZA : 'FFFFFF'), border: { bottom: { style: 'hair', color: 'D9D9D9' } } });
  });
  ws2.column(1).width(20); ws2.column(2).width(62);
  const rr = mapaRows.length + 5;
  ws2.cell(rr, 1).value('Regex sugerida:').style({ bold: true });
  ws2.cell(rr, 2).value('\\b(\\d{2,8})\\s?([A-Z]{3})\\b  — capturar perto dos rótulos acima');

  await wb.toFileAsync(OUT);
  console.log('Gerado: ' + OUT);
})();
