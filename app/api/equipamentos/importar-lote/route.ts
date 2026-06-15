import { NextRequest, NextResponse } from 'next/server'
import { lerJSON, escreverJSON } from '@/lib/dados'
import type { EquipamentoEMC, GrupoId, SubgrupoId } from '@/lib/equipamentos/tipos'
import type { Certificado } from '@/lib/certificados/tipos'
import { parsearDadosPadrao, parsearMetadadosCertificado } from '@/lib/certificados/parser'
import { parsearCertificadoRBC } from '@/lib/interpolacao'
import { corrigirGrandezasPorLayout } from '@/lib/certificados/layout'
import { grandezasDoCertificado, mesclarGrandezas } from '@/lib/certificados/registrar-grandezas'
import { addM } from '@/lib/utils'

const ARQ_EQUIP = 'equipamentos.json'
const ARQ_CERT  = 'certificados.json'

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

function tagDeFolder(folder: string, dadosTag?: string): string {
  if (dadosTag) return dadosTag.toUpperCase().replace(/\s+/g, '')
  const m = folder.match(/(\d{2,6}\s*[A-Za-z]{2,5})/)
  return (m ? m[1] : folder).toUpperCase().replace(/\s+/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const { itens } = (await req.json()) as { itens: ItemScan[] }
    if (!Array.isArray(itens) || !itens.length) {
      return NextResponse.json({ error: 'Nada para importar.' }, { status: 400 })
    }

    const equipamentos = lerJSON<EquipamentoEMC[]>(ARQ_EQUIP, [])
    const certificados = lerJSON<Certificado[]>(ARQ_CERT, [])
    const byTag = new Map(equipamentos.map(e => [e.tag.toUpperCase(), e]))

    const sucessos: string[] = []   // novas TAGs cadastradas
    const atualizados: string[] = [] // TAG já existia → só anexou certificado
    const pulados: { tag: string; motivo: string }[] = []  // não-LABELO
    const erros: { folder: string; motivo: string }[] = [] // sem PDF / ilegível
    const novosCerts: Certificado[] = []

    let seq = Date.now()
    const novoId = () => String(seq++)

    for (const it of itens) {
      if (it.error || !it.text) {
        erros.push({ folder: it.folder, motivo: it.error || 'PDF sem texto legível' })
        continue
      }
      const dados = parsearDadosPadrao(it.text)
      const tag   = tagDeFolder(it.folder, dados.tag)

      // Só cadastra se o certificado for do LABELO; senão, avisa (cadastro manual).
      if (!/LABELO/i.test(it.text)) {
        pulados.push({ tag, motivo: 'Certificado não é do LABELO — cadastrar manualmente' })
        continue
      }

      const meta = parsearMetadadosCertificado(it.text)
      const rbc  = parsearCertificadoRBC(it.text)
      const pontos = it.items?.length ? corrigirGrandezasPorLayout(rbc.pontos, it.items) : rbc.pontos
      const dataEmissao = meta.dataEmissao || dados.ultimaCalibracao || ''
      const numeroCert  = meta.numero || dados.numeroCertificado || rbc.numeroCert || ''

      // Equipamento: cria se a TAG é nova; senão reaproveita o existente.
      let equip = byTag.get(tag)
      const isNovo = !equip
      if (!equip) {
        const { grupoId, subgrupoId } = inferTipo(`${dados.nome || ''} ${it.folder}`)
        const intervalo = 12
        equip = {
          id: novoId(),
          tag,
          nome: dados.nome || it.folder,
          grupoId, subgrupoId,
          status: 'ativo',
          grandezas: [],
          ultimaCalibracao: dataEmissao,
          proximaCalibracao: dataEmissao ? addM(dataEmissao, intervalo) : '',
          intervaloCalibracao: intervalo,
          fabricante: dados.fabricante,
          modelo: dados.modelo,
          serie: dados.serie,
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

      if (isNovo) sucessos.push(tag)
      else atualizados.push(tag)
    }

    // Persistência em UMA escrita por arquivo (rápido mesmo com muitas TAGs).
    escreverJSON(ARQ_EQUIP, equipamentos)
    escreverJSON(ARQ_CERT, [...novosCerts, ...certificados])

    return NextResponse.json({
      total: itens.length,
      sucessos, atualizados, pulados, erros,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
