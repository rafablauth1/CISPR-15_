# -*- coding: utf-8 -*-
"""Anexa o Capítulo 22 (Funções Recentes) ao manual ILUSTRADO existente,
preservando todas as figuras. Saída: Manual_Validacao_CISPR15_LABELO.docx (raiz)."""
from pathlib import Path
import docx
import gerar_manual as gm

BASE = Path(r"C:\Users\Notla\OneDrive\Área de Trabalho\DIONATA\cispr15-standalone")
SRC  = BASE / "docs" / "Manual_Validacao_CISPR15_LABELO.docx"
OUT  = BASE / "Manual_Validacao_CISPR15_LABELO.docx"

doc = docx.Document(str(SRC))

gm.page_break(doc)
gm.section_bar(doc, '22. Funções Recentes (Atualizações)')
gm.body_para(doc,
    'Esta seção documenta as funcionalidades acrescentadas nas últimas versões do '
    'sistema, com foco na gestão metrológica (Módulo Lab) e na agenda. As demais '
    'funções descritas nos capítulos anteriores permanecem inalteradas.')

gm.heading_para(doc, '22.1 Importação em lote de certificados (pasta-mãe)', size=11, bold=True, space_before=8, space_after=3)
gm.body_para(doc,
    'Em Equipamentos → "Importar pasta-mãe", o sistema percorre uma pasta com uma '
    'subpasta por equipamento (cada uma com o certificado em PDF), lê os dados e '
    'cadastra automaticamente. Os certificados do LABELO são cadastrados direto; os de '
    'outros laboratórios vão para o Rascunho, identificados pelo laboratório emissor.')
gm.bullet(doc, 'Equipamentos parados há mais de 7 anos sem alteração na pasta (provável fora de uso): o sistema pergunta se deseja cadastrá-los, enviá-los ao Rascunho ou ignorá-los.')
gm.bullet(doc, '2ª varredura ("Cadastrar pela amostra"): cadastra os itens do Rascunho pelos dados da folha de rosto, mesmo sem o certificado padrão do LABELO.')

gm.heading_para(doc, '22.2 Laboratórios de Calibração e Modelo de Extração', size=11, bold=True, space_before=8, space_after=3)
gm.body_para(doc,
    'A tela Laboratórios mantém o vínculo entre a acreditação (CAL XXXX do selo azul '
    'ABNT NBR ISO/IEC 17025) e o nome do laboratório. O LABELO é identificado '
    'exclusivamente pelo seu CAL 0024 — a mera presença da palavra "LABELO" (que aparece '
    'como cliente em certificados de terceiros) não classifica o documento como do LABELO.')
gm.bullet(doc, 'Importar certificados: lê PDFs e associa automaticamente o CAL ao nome do laboratório emissor.')
gm.bullet(doc, 'Modelo de extração por laboratório: para cada lab é possível informar qual RÓTULO ele usa em cada campo (Nome, Fabricante, Modelo, Série, TAG, Data). O botão "Importar amostra" exibe o texto extraído do PDF para localizar os rótulos. O OCR passa a usar esses rótulos com prioridade para aquele laboratório.')

gm.heading_para(doc, '22.3 Siglas oficiais e identificação da TAG', size=11, bold=True, space_before=8, space_after=3)
gm.body_para(doc,
    'A TAG do equipamento segue o padrão número + 3 letras (ex.: 1528EMC). As 3 letras '
    'devem ser uma sigla oficial de laboratório cadastrada (Taxonomia → Siglas); qualquer '
    'outra trinca de letras não é considerada TAG, evitando leituras incorretas.')

gm.heading_para(doc, '22.4 Cadastro pela Análise Crítica (FOR 6401)', size=11, bold=True, space_before=8, space_after=3)
gm.body_para(doc,
    'Quando o PDF lido é um formulário FOR 6401 (Análise Crítica de Certificado de '
    'Calibração), o sistema extrai dele: Fornecedor (laboratório), número do Certificado, '
    'TAG, Nome do Instrumento, Data do certificado e Periodicidade. Periodicidades em anos '
    'são convertidas para meses. Havendo mais de uma análise para a mesma TAG, prevalece a '
    'periodicidade da análise mais recente.')

gm.heading_para(doc, '22.5 Grandezas dos certificados do LABELO', size=11, bold=True, space_before=8, space_after=3)
gm.body_para(doc,
    'Ao cadastrar um certificado do LABELO, as grandezas são identificadas automaticamente '
    'a partir dos títulos de seção (textos centralizados/negrito que antecedem cada '
    '"Parâmetro:", entre a 2ª e a penúltima página) e registradas no equipamento.')

gm.heading_para(doc, '22.6 Tipos de equipamento (atribuição de grupos)', size=11, bold=True, space_before=8, space_after=3)
gm.body_para(doc,
    'Em Equipamentos → Grupos, o painel "Tipos de equipamento" lista os nomes distintos '
    'de equipamentos cadastrados e permite atribuir cada nome a um grupo e subgrupo de uma '
    'só vez (vale para todos os equipamentos com aquele nome).')

gm.heading_para(doc, '22.7 Agenda — fluxo de assinatura e custódia', size=11, bold=True, space_before=8, space_after=3)
gm.bullet(doc, 'Estados: "Em andamento" → ao emitir vai para "Aguardando assinatura" → ao marcar como assinado vai para "Concluído" (com a data).')
gm.bullet(doc, 'O botão do relatório abre a PASTA do relatório (DOCX, fotos e PDF) para a assinatura manual.')
gm.bullet(doc, 'Cadeia de custódia: caixas de confirmação de recebimento na entrega (EMC) e na devolução (LUM).')

gm.heading_para(doc, '22.8 Pasta de cópias de PDF e arquivos do relatório', size=11, bold=True, space_before=8, space_after=3)
gm.bullet(doc, 'A cópia para a pasta de cópias ocorre só ao Assinar e Publicar pelo sistema, ou quando o PDF original (na pasta do DOCX) é assinado manualmente (detectado ao reabrir). Apenas gerar o PDF não cria cópia.')
gm.bullet(doc, '"Salvar arquivos" vincula fotos e DOCX ao relatório (sem duplicar na pasta); ao reabrir o protocolo eles voltam pro PDF.')
gm.bullet(doc, '"Baixar PDF" salva na pasta do DOCX (pasta da EUT), não em Documentos.')

gm.heading_para(doc, '22.9 Correções e desempenho', size=11, bold=True, space_before=8, space_after=3)
gm.bullet(doc, 'Status "Fora de uso", "Não requer calibração" e "Calibrar antes do uso" não exibem data de próxima calibração.')
gm.bullet(doc, 'Botão "Excluir tudo" (Equipamentos) com modal de senha próprio.')
gm.bullet(doc, 'Desempenho: a gravação de dados deixou de travar a digitação.')

doc.save(str(OUT))
print('OK ->', OUT)
