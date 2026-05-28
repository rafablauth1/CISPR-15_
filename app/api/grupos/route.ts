import { NextResponse } from 'next/server'
import { lerJSON } from '@/lib/dados'

const GRUPOS_DEFAULT = [
  { id: 'geradores', nome: 'Geradores', descricao: 'Geradores de sinal e fontes de alimentação calibradas', cor: 'blue',
    subgrupos: [
      { id: 'gerador-sinal-rf',    nome: 'Sinal / RF', numero: '1.1' },
      { id: 'gerador-funcoes',     nome: 'Funções',    numero: '1.2' },
      { id: 'fonte-alimentacao-dc', nome: 'Fonte DC',  numero: '1.3' },
    ] },
  { id: 'medidores', nome: 'Medidores', descricao: 'Analisadores de espectro, receptores EMI e instrumentos de medição', cor: 'gold',
    subgrupos: [
      { id: 'analisador-espectro', nome: 'Analisador de Espectro', numero: '2.1' },
      { id: 'receptor-emi',        nome: 'Receptor EMI',           numero: '2.2' },
      { id: 'multimetro',          nome: 'Multímetro',             numero: '2.3' },
    ] },
  { id: 'redes-impedancia', nome: 'Redes de Impedância', descricao: 'LISNs e redes de estabilização de impedância de linha', cor: 'purple',
    subgrupos: [
      { id: 'lisn-50uh', nome: 'LISN 50µH', numero: '3.1' },
      { id: 'lisn-5uh',  nome: 'LISN 5µH',  numero: '3.2' },
    ] },
  { id: 'antenas', nome: 'Antenas', descricao: 'Antenas de medição para ensaios radiados', cor: 'green',
    subgrupos: [
      { id: 'antena-loop',          nome: 'Loop Tripla',   numero: '4.1' },
      { id: 'antena-log-periodica', nome: 'Log-Periódica', numero: '4.2' },
      { id: 'antena-biconica',      nome: 'Bicônica',      numero: '4.3' },
    ] },
  { id: 'atenuacao', nome: 'Atenuação', descricao: 'Atenuadores, adaptadores e filtros de RF', cor: 'coral',
    subgrupos: [
      { id: 'atenuador', nome: 'Atenuador RF', numero: '5.1' },
      { id: 'filtro-rf', nome: 'Filtro RF',    numero: '5.2' },
    ] },
  { id: 'grandezas-ambientais', nome: 'Grandezas Ambientais', descricao: 'Instrumentos para monitoramento de condições ambientais', cor: 'gray',
    subgrupos: [
      { id: 'termoigrometro', nome: 'Termoigrômetro', numero: '6.1' },
      { id: 'barometro',      nome: 'Barômetro',      numero: '6.2' },
    ] },
]

export async function GET() {
  return NextResponse.json(lerJSON('grupos.json', GRUPOS_DEFAULT))
}
