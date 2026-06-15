# Próximos passos — Módulo Qualidade/Lab

Versão atual no pendrive: **1.0.62** (`D:\dist\win-unpacked\CISPR 15 LABELO.exe`)

## ✅ Já feito (1.0.60 → 1.0.62)
- **#1** Excluir amostra do lote — lixeira por amostra.
- **#2** Importar pontos do certificado traz **VR + MM** para a checagem.
- **#4** Baixar PDFs do lote nas pastas.
- **#5** **Cadastro de equipamentos em lote** via pasta-mãe → 1 subpasta/TAG → `…Certificado.pdf`. Só cadastra se for **LABELO**; relatório de sucesso/atualizado/pular(não-LABELO)/erro. Persiste em 1 escrita (aguenta lote grande).
- **#8** **Taxonomia configurável** (menu "Áreas & Siglas"): áreas (cor), siglas das TAGs (3 letras → significado → área), tipos de equipamento (ícone + várias áreas). Filtro por sigla na lista de equipamentos.
- **#9** Situação do equipamento (Ativo/Fora de uso/Calibrar antes) + "Abrir PDF" no card do certificado.

## ⬜ Pendentes

### #3 — Data não salva no trânsito das janelas  *(precisa de info)*
- **Falta confirmar QUAL tela**: lote (corrigido antes via arquivo), checagem, ou outra.
- Ação: reproduzir, achar o `useState` da data que não persiste entre navegações e salvar em arquivo/contexto (não só no componente).

### #6 — Configurações seccionadas por diretório
- Hoje há `dataFolder` / `agendaFolder` / `pdfCopyFolder` / `backupFolder` em `SETTINGS_DEFAULTS` (electron/main.js).
- Fazer a tela de Configurações em **seções por função** (Agenda, Relatórios CISPR, Qualidade…), cada uma com seu seletor de diretório (botão "Procurar…" usa `browseFolder`).
- Ler/gravar via `settings:get`/`settings:set`. As rotas de dados já leem `dataFolder`; estender para os demais módulos lerem o diretório da sua seção.

### #7 — Exe único portátil
- A `win-unpacked` **já roda sem instalar** (é só abrir o .exe). 
- Se quiser **1 arquivo só**: `electron-builder --win portable` (gera um .exe que extrai a cada abertura — fica mais lento ao abrir). Avaliar se compensa vs. a pasta atual.

### #10 — Performance para ~3000 equipamentos
- A escrita já é O(n) (importação em lote grava 1×).
- Falta no **render**: a lista de equipamentos carrega tudo de uma vez. Para 3000:
  - paginação ou **lista virtualizada** (react-window) na tabela;
  - carregar só a "folha de rosto" (campos leves), abrir o detalhe sob demanda;
  - PDFs ficam por **referência** (`pdfPath` na rede) — já é assim, não copia arquivo.
- Conectar o **#5/#8**: cadastro em lote deve classificar por **sigla da TAG** (taxonomia) em vez do chute por palavra-chave.

## A verificar
- **Travamento dos campos digitáveis**: já houve 2 correções (backup assíncrono + OCR em 1 passada). Confirmar com o Dionata se ainda trava ao processar certificado grande.

## Deploy (lembrete)
```
npx tsc --noEmit
npx next build
npx electron-builder --win dir        # -> C:\Temp\cispr15-dist\win-unpacked
robocopy C:\Temp\cispr15-dist\win-unpacked D:\dist\win-unpacked /MIR
```
Git: `git push origin main` + `git push check main --force`.
