// Modelo PADRÃO de Instrução de Trabalho de checagem — baseado no documento
// "IT_Checagem_Atenuadores_RF" (estrutura aprovada pelo Rafael). Toda IT nova
// começa a partir daqui (cada bloco com id novo) e o usuário edita pra mais/menos.
import type { Bloco } from './tipos'

let _n = 0
const uid = () => 'b' + Date.now().toString(36) + (_n++).toString(36) + Math.random().toString(36).slice(2, 6)
const h1 = (numero: string, texto: string): Bloco => ({ id: uid(), tipo: 'h1', numero, texto })
const h2 = (numero: string, texto: string): Bloco => ({ id: uid(), tipo: 'h2', numero, texto })
const p  = (texto: string): Bloco => ({ id: uid(), tipo: 'p', texto })
const ul = (itens: string[]): Bloco => ({ id: uid(), tipo: 'ul', itens })
const ol = (itens: string[]): Bloco => ({ id: uid(), tipo: 'ol', itens })
const tabela = (cabecalho: string[], linhas: string[][]): Bloco => ({ id: uid(), tipo: 'tabela', cabecalho, linhas })
const defs = (itens: { sigla: string; definicao: string }[]): Bloco => ({ id: uid(), tipo: 'definicoes', itens })

/** Blocos do modelo padrão de IT de checagem (estrutura do docx). */
export function blocosPadraoIT(): Bloco[] {
  return [
    h1('1', 'Objetivo'),
    p('Estabelecer o procedimento para a checagem intermediária de [equipamento], com a finalidade de monitorar a estabilidade de suas características metrológicas no intervalo entre calibrações sucessivas, atendendo ao requisito 6.4.10 da ABNT NBR ISO/IEC 17025:2017.'),

    h1('2', 'Campo de aplicação'),
    p('Aplica-se a [descrever os equipamentos abrangidos] pertencentes ao acervo do laboratório e empregados nas medições de compatibilidade eletromagnética e demais ensaios.'),
    p('Equipamentos abrangidos por esta IT (TAG): [ informar TAGs ]'),

    h1('3', 'Documentos de referência'),
    ul([
      'ABNT NBR ISO/IEC 17025:2017 – Requisitos gerais para a competência de laboratórios de ensaio e calibração (item 6.4).',
      'Certificados de calibração vigentes dos equipamentos sob esta IT.',
      'Manuais dos fabricantes dos equipamentos e dos padrões.',
      'JCGM 100 (GUM) / EA-4/02 – avaliação de incerteza de medição.',
    ]),

    h1('4', 'Definições e siglas'),
    defs([
      { sigla: 'Checagem intermediária', definicao: 'Verificação periódica realizada entre calibrações para confirmar que o equipamento mantém seu desempenho metrológico.' },
      { sigla: 'Valor de referência', definicao: 'Valor constante do certificado de calibração vigente, na condição correspondente (interpolado quando necessário).' },
      { sigla: 'Desvio (D)', definicao: 'Diferença entre o valor medido na checagem e o valor de referência.' },
    ]),

    h1('5', 'Equipamentos, padrões e materiais'),
    p('Todos os equipamentos que afetam o resultado devem possuir calibração vigente e rastreabilidade.'),
    ul(['[ listar padrões e instrumentos utilizados na checagem ]', 'Termo-higrômetro para registro das condições ambientais.']),

    h1('6', 'Condições ambientais'),
    p('Realizar a checagem em ambiente estável, recomendando-se temperatura de 23 ± 5 °C e umidade relativa < 75 %. Manter os equipamentos ligados pelo tempo de estabilização indicado pelo fabricante. Registrar as condições no momento da checagem.'),

    h1('7', 'Precauções'),
    ul([
      'Respeitar os limites operacionais do equipamento (potência, tensão, faixa).',
      'Aplicar o torque correto nos conectores, sempre com chave de torque.',
      'Inspecionar e, se necessário, limpar os conectores; adotar cuidados de ESD.',
    ]),

    h1('8', 'Procedimento'),
    h2('8.1', 'Preparação'),
    ol([
      'Identificar o equipamento (TAG, modelo, n.º de série) e recuperar do certificado vigente os valores de referência.',
      'Definir os pontos de checagem cobrindo a faixa de uso.',
      'Realizar inspeção visual; registrar qualquer anomalia.',
      'Conectar, estabilizar os equipamentos e aplicar o torque correto.',
    ]),
    h2('8.2', 'Medição'),
    ol([
      '[ descrever o arranjo e a sequência de medição ]',
      'Registrar as leituras em cada ponto.',
      'Calcular o valor medido na checagem.',
    ]),
    h2('8.3', 'Avaliação'),
    ol([
      'Para cada ponto, calcular o desvio D e comparar com o critério de aceitação (seção 9).',
      'Registrar todos os resultados no Anexo A e assinar.',
    ]),

    h1('9', 'Critério de aceitação'),
    p('O equipamento é considerado conforme, em cada ponto, quando o módulo do desvio não excede o critério definido no plano de calibração acrescido da incerteza dos padrões utilizados na checagem:'),
    p('| valor medido − valor de referência | ≤ critério do plano + incerteza dos padrões'),

    h1('10', 'Tratamento de não conformidade'),
    ol([
      'Excedido o critério, repetir a medição verificando conexões, limpeza e configuração.',
      'Persistindo o desvio, identificar o equipamento como suspeito, retirá-lo de uso e abrir registro de não conformidade.',
      'Avaliar a necessidade de recalibração e o impacto sobre ensaios anteriores.',
    ]),

    h1('11', 'Periodicidade'),
    p('Realizar a checagem intermediária com a periodicidade definida pelo laboratório em função da criticidade e do uso. Periodicidade adotada: [ ex.: semestral ]. Realizar checagem adicional após suspeita de dano, queda, sobrecarga ou manutenção/transporte.'),

    h1('12', 'Registros'),
    ul([
      'Anexo A – Planilha de Registro de Checagem Intermediária.',
      'Arquivar os registros pelo período definido no sistema da qualidade, de forma rastreável ao equipamento e aos padrões.',
    ]),

    h1('', 'Anexo A – Modelo de registro da checagem'),
    p('Conteúdo mínimo do registro — campos de identificação, colunas de resultados e pontos a verificar.'),
    h2('A.1', 'Campos de identificação'),
    tabela(['Campo', 'Descrição'], [
      ['Equipamento', 'TAG, modelo/fabricante e número de série.'],
      ['Certificado de calibração', 'Identificação do certificado tomado como referência.'],
      ['Padrões / equipamentos', 'TAG e situação de calibração dos instrumentos usados.'],
      ['Condições ambientais', 'Temperatura (°C) e umidade relativa (%) no momento da checagem.'],
      ['Data', 'Data de realização da checagem.'],
      ['Executor / verificador', 'Responsáveis pela execução e verificação.'],
    ]),
    h2('A.2', 'Colunas da tabela de resultados'),
    tabela(['Coluna', 'Descrição', 'Unidade'], [
      ['Ponto', 'Ponto verificado (frequência/posição/condição).', '—'],
      ['Ref.', 'Valor de referência da calibração.', '—'],
      ['Medido', 'Valor medido na checagem.', '—'],
      ['Desvio', 'Medido − Referência.', '—'],
      ['Critério', 'Critério do plano + incerteza dos padrões.', '—'],
      ['Resultado', 'Conforme / Não conforme.', 'S/N'],
    ]),
  ]
}
