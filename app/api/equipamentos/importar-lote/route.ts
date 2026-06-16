import { NextRequest, NextResponse } from 'next/server'
import { lerJSON, escreverJSON } from '@/lib/dados'
import type { EquipamentoEMC, GrupoId, SubgrupoId } from '@/lib/equipamentos/tipos'
import type { Certificado } from '@/lib/certificados/tipos'
import { parsearDadosPadrao, parsearMetadadosCertificado, classificarCertificadoLabelo, resolverTag, limparCampo } from '@/lib/certificados/parser'
import { extrairMetadadosGenerico, extrairAcreditacao, extrairNomeLaboratorio } from '@/lib/certificados/extrair-generico'
import { lerLaboratorios, salvarLaboratorios, nomeDoLab, registrarLab } from '@/lib/laboratorios/registro'
import { parsearCertificadoRBC } from '@/lib/interpolacao'
import { corrigirGrandezasPorLayout } from '@/lib/certificados/layout'
import { grandezasDoCertificado, mesclarGrandezas } from '@/lib/certificados/registrar-grandezas'
import { addM } from '@/lib/utils'

const ARQ_EQUIP    = 'equipamentos.json'
const ARQ_CERT     = 'certificados.json'
const ARQ_RASCUNHO = 'rascunho-equipamentos.json'

interface RascunhoItem {
  tag: string; folder: string; motivo: string; certPath?: string; em: string
  lab?: string; acreditacao?: string; equipamento?: string; cadastravel?: boolean
}

// Padrão de TAG: 2–4 dígitos + 3 letras (ex.: "1234EMC", "10TEL", "9999LUM").
const RE_TAG = /\b(\d{2,4})\s*([A-Za-z]{3})\b/

interface ItemScan {
  folder: string
  certPath: string | null
  text?: string
  items?: { s: string; x: number; y: number; page?: number }[]
  error?: string
}

// Classificação automática (grupo/subgrupo) por palavras-chave do nome/descrição.
// É só um chute inicial — o usuário reclassifica depois (e a taxonomia por sigla
// da TAG vai refinar isso). Default: medidor / analisador de espectro.
function inferTipo(txt: string): { grupoId: GrupoId; subgrupoId: SubgrupoId } {
  const t = (txt || '').toLowerCase()
  const r = (g: GrupoId, s: SubgrupoId) => ({ grupoId: g, subgrupoId: s })
  if (/gerador.*fun|function gen/.test(t))               return r('geradores', 'gerador-funcoes')
  if (/fonte|power supply|alimenta/.test(t))             return r('geradores', 'fonte-alimentacao-dc')
  if (/gerador|signal gen|sinal/.test(t))                return r('geradores', 'gerador-sinal-rf')
  if (/receptor|receiver|\bemi\b/.test(t))               return r('medidores', 'receptor-emi')
  if (/analisador.*espectro|spectrum/.test(t))           return r('medidores', 'analisador-espectro')
  if (/mult[íi]metro|multimeter|dmm/.test(t))            return r('medidores', 'multimetro')
  if (/lisn|rede.*impedan|impedance/.test(t))            return r('redes-impedancia', 'lisn-50uh')
  if (/antena.*log|log.?per[íi]od/.test(t))              return r('antenas', 'antena-log-periodica')
  if (/antena.*bic|bicon/.test(t))                       return r('antenas', 'antena-biconica')
  if (/antena.*loop|loop/.test(t))                       return r('antenas', 'antena-loop')
  if (/antena/.test(t))                                  return r('antenas', 'antena-log-periodica')
  if (/atenuador|attenuator/.test(t))                    return r('atenuacao', 'atenuador')
  if (/filtro|filter/.test(t))                           return r('atenuacao', 'filtro-rf')
  if (/term[oô]|hygro|higr[oô]|umidade|humid/.test(t))   return r('grandezas-ambientais', 'termoigrometro')
  if (/bar[ôo]metro|press[ãa]o|pressure/.test(t))        return r('grandezas-ambientais', 'barometro')
  return r('medidores', 'analisador-espectro')
}

export async function GET() {
  return NextResponse.json(lerJSON<RascunhoItem[]>(ARQ_RASCUNHO, []))
}

// Limpa o rascunho: body { all: true } apaga tudo; { folders: [...] } apaga os listados.
export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { all?: boolean; folders?: string[] }
    if (body.all) { escreverJSON(ARQ_RASCUNHO, []); return NextResponse.json({ ok: true, restantes: 0 }) }
    const alvo = new Set(body.folders ?? [])
    const prev = lerJSON<RascunhoItem[]>(ARQ_RASCUNHO, [])
    const nova = prev.filter(r => !alvo.has(r.folder) && !alvo.has(r.tag))
    escreverJSON(ARQ_RASCUNHO, nova)
    return NextResponse.json({ ok: true, restantes: nova.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { itens, modo } = (await req.json()) as { itens: ItemScan[]; modo?: 'certificado' | 'amostra' }
    if (!Array.isArray(itens) || !itens.length) {
      return NextResponse.json({ error: 'Nada para importar.' }, { status: 400 })
    }
    const soAmostra = modo === 'amostra'   // 2ª varredura: cadastra só os dados da amostra (sem cert/grandeza)

    const equipamentos = lerJSON<EquipamentoEMC[]>(ARQ_EQUIP, [])
    const certificados = lerJSON<Certificado[]>(ARQ_CERT, [])
    const byTag = new Map(equipamentos.map(e => [e.tag.toUpperCase(), e]))

    const sucessos: string[] = []   // novas TAGs cadastradas
    const atualizados: string[] = [] // TAG já existia → só anexou certificado
    const pulados: { tag: string; motivo: string }[] = []  // não-LABELO / inválido → rascunho
    const erros: { folder: string; motivo: string }[] = [] // sem PDF / ilegível
    const novosCerts: Certificado[] = []
    const rascunho: RascunhoItem[] = []
    const foldersOk = new Set<string>()   // pastas cadastradas nesta rodada (limpa do rascunho)
    const labs = lerLaboratorios()        // registro CAL → laboratório (auto-descoberta)
    let labsMudou = false
    const agora = new Date().toISOString()

    let seq = Date.now()
    const novoId = () => String(seq++)

    for (const it of itens) {
      if (it.error || !it.text) {
        // Sem PDF/texto: provável escaneado ou pasta vazia → não dá pra cadastrar.
        const motivo = it.certPath ? (it.error || 'PDF sem texto (provável escaneado)') : 'Sem PDF na pasta'
        erros.push({ folder: it.folder, motivo })
        rascunho.push({ tag: '', folder: it.folder, motivo, certPath: it.certPath || undefined, em: agora, cadastravel: false })
        continue
      }
      const dados = parsearDadosPadrao(it.text)
      // Radar: o PDF tem um padrão de TAG (ex.: 1234EMC)? Então é cadastrável.
      const temPadraoTag = RE_TAG.test(it.text)
      // TAG do padrão solto no texto (último recurso, usado na 2ª varredura).
      const tagSolta = (() => { const m = it.text.match(RE_TAG); return m ? (m[1] + m[2]).toUpperCase() : '' })()

      // TAG: vem do certificado (tem a sigla); pasta é só reserva. Exige sufixo de letras.
      const tag = resolverTag(it.folder, dados.tag, it.text)

      // 2ª VARREDURA (modo amostra): cadastra SÓ o equipamento pelos dados da folha
      // (ex.: análise crítica / cert. de terceiros), sem certificado e sem grandeza.
      // Usa extração de TAG mais flexível (rótulos genéricos + padrão solto).
      if (soAmostra) {
        const g = extrairMetadadosGenerico(it.text)
        const tagA = tag || resolverTag(it.folder, g.tag, it.text) || tagSolta
        if (!tagA) {
          const motivo = 'Sem TAG identificável (nem pelos dados da amostra)'
          pulados.push({ tag: it.folder, motivo })
          rascunho.push({ tag: it.folder, folder: it.folder, motivo, certPath: it.certPath || undefined, em: agora, cadastravel: false })
          continue
        }
        foldersOk.add(it.folder)
        if (byTag.has(tagA)) { atualizados.push(tagA); continue }
        const { grupoId, subgrupoId } = inferTipo(`${g.nome || dados.nome || ''} ${it.folder}`)
        const equipA: EquipamentoEMC = {
          id: novoId(), tag: tagA,
          nome: limparCampo(g.nome || dados.nome, 80) || tagA,
          grupoId, subgrupoId, status: 'ativo', grandezas: [],
          ultimaCalibracao: '', proximaCalibracao: '', intervaloCalibracao: 12,
          fabricante: limparCampo(g.fabricante || dados.fabricante, 50),
          modelo: limparCampo(g.modelo || dados.modelo, 40),
          serie: limparCampo(g.serie || dados.serie, 30),
          obs: 'Cadastrado pela 2ª varredura (dados da amostra, sem certificado)',
        }
        equipamentos.push(equipA); byTag.set(tagA, equipA)
        sucessos.push(tagA)
        continue
      }

      if (!tag) {
        const motivo = 'TAG não encontrada (padrão 1234ABC ausente no certificado)'
        pulados.push({ tag: it.folder, motivo })
        rascunho.push({ tag: it.folder, folder: it.folder, motivo, certPath: it.certPath || undefined, em: agora, cadastravel: temPadraoTag })
        continue
      }

      // Só cadastra se for MESMO certificado do LABELO (nº no padrão, não-formulário).
      const classif = classificarCertificadoLabelo(it.text)
      if (!classif.ok) {
        // Identifica o laboratório emissor pelo CAL (registro) + nome do texto.
        const g = extrairMetadadosGenerico(it.text)
        const nomeGuess = nomeDoLab(labs, g.acreditacao) || extrairNomeLaboratorio(it.text)
        if (g.acreditacao && registrarLab(labs, g.acreditacao, nomeGuess)) labsMudou = true
        const labTxt = nomeGuess || (g.acreditacao ? `Lab ${g.acreditacao}` : '')
        const motivo = labTxt
          ? `Outro laboratório — ${labTxt}`
          : (classif.motivo || 'Não é certificado do LABELO')
        pulados.push({ tag, motivo })
        rascunho.push({
          tag, folder: it.folder, motivo, certPath: it.certPath || undefined, em: agora,
          lab: nomeGuess, acreditacao: g.acreditacao, equipamento: g.nome, cadastravel: true,
        })
        continue
      }

      const meta = parsearMetadadosCertificado(it.text)
      const rbc  = parsearCertificadoRBC(it.text)
      const pontos = it.items?.length ? corrigirGrandezasPorLayout(rbc.pontos, it.items) : rbc.pontos
      const dataEmissao = meta.dataEmissao || dados.ultimaCalibracao || ''
      // Nº do certificado: o padrão LABELO validado tem prioridade.
      const numeroCert  = classif.numero || meta.numero || dados.numeroCertificado || ''

      // Equipamento: cria se a TAG é nova; senão reaproveita o existente.
      let equip = byTag.get(tag)
      const isNovo = !equip
      if (!equip) {
        const { grupoId, subgrupoId } = inferTipo(`${dados.nome || ''} ${it.folder}`)
        const intervalo = 12
        equip = {
          id: novoId(),
          tag,
          nome: limparCampo(dados.nome, 80) || tag,
          grupoId, subgrupoId,
          status: 'ativo',
          grandezas: [],
          ultimaCalibracao: dataEmissao,
          proximaCalibracao: dataEmissao ? addM(dataEmissao, intervalo) : '',
          intervaloCalibracao: intervalo,
          fabricante: limparCampo(dados.fabricante, 50),
          modelo: limparCampo(dados.modelo, 40),
          serie: limparCampo(dados.serie, 30),
          labCalibracao: 'LABELO/PUCRS',
          numeroCertificado: numeroCert,
          procedimentos: dados.procedimentos,
        }
        equipamentos.push(equip)
        byTag.set(tag, equip)
      }

      // Evita certificado duplicado (mesmo número no mesmo equipamento).
      const jaTem = [...certificados, ...novosCerts].some(
        c => c.equipamentoId === equip!.id && numeroCert && c.numero === numeroCert,
      )
      if (!jaTem && pontos.length) {
        const cert: Certificado = {
          id: novoId(),
          equipamentoId: equip.id,
          equipamentoTag: tag,
          numero: numeroCert,
          laboratorio: meta.laboratorio || 'LABELO/PUCRS',
          acreditacao: extrairAcreditacao(it.text),
          dataEmissao,
          dataValidade: dataEmissao ? addM(dataEmissao, equip.intervaloCalibracao || 12) : undefined,
          itens: [],
          grade2D: {
            eixo1Nome: rbc.eixo1Nome, eixo1Unidade: rbc.eixo1Unidade,
            eixo2Nome: rbc.eixo2Nome, eixo2Unidade: rbc.eixo2Unidade,
            pontos,
          },
          pdfPath: it.certPath || undefined,
          pdfNome: it.certPath ? it.certPath.split(/[\\/]/).pop() : undefined,
          criadoEm: new Date().toISOString(),
        }
        novosCerts.push(cert)
        // Registra as grandezas do certificado NO equipamento, em memória.
        equip.grandezas = mesclarGrandezas(equip.grandezas, grandezasDoCertificado(cert))
      }

      foldersOk.add(it.folder)
      if (isNovo) sucessos.push(tag)
      else atualizados.push(tag)
    }

    // Persistência em UMA escrita por arquivo (rápido mesmo com muitas TAGs).
    escreverJSON(ARQ_EQUIP, equipamentos)
    escreverJSON(ARQ_CERT, [...novosCerts, ...certificados])
    if (labsMudou) salvarLaboratorios(labs)   // novos laboratórios descobertos

    // Rascunho: acumula as não-cadastradas (dedupe por folder), e remove as que
    // acabaram de ser cadastradas com sucesso.
    if (rascunho.length || foldersOk.size) {
      const prev = lerJSON<RascunhoItem[]>(ARQ_RASCUNHO, [])
      const cadastradas = new Set([...sucessos, ...atualizados])
      const map = new Map<string, RascunhoItem>()
      for (const r of [...prev, ...rascunho]) {
        if (cadastradas.has(r.tag) || foldersOk.has(r.folder)) continue   // já cadastrada
        map.set(r.folder || r.tag, r)
      }
      escreverJSON(ARQ_RASCUNHO, [...map.values()])
    }

    return NextResponse.json({
      total: itens.length,
      sucessos, atualizados, pulados, erros,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
