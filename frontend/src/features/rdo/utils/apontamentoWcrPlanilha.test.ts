import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acharCabecalhoWcr, textoDaLinha, textoDaCelula, lerPlanilhaWcr, type MatrizWcr } from './apontamentoWcrPlanilha.ts'
import { parseApontamentoWcr, resumirApontamento } from './apontamentoWcr.ts'

const HOJE = '2026-09-04'

/** Cabeçalho na linha 2, com banner em cima — como as planilhas reais deste cliente. */
const COM_BANNER: MatrizWcr = [
  ['APONTAMENTO DIÁRIO WCR', null, null, null, null, null, null, null],
  ['DATA', 'EQUIPE', 'NÚCLEO', 'IMÓVEIS', 'PRA', 'LA', 'HM', 'OBS'],
  ['31/08/2026', 'Gilvan', 'Boi Malhado', 'rua santa rosa de sul; rua um', null, null, 100, 'sem intercorrência'],
]

test('acha o cabeçalho mesmo com banner na primeira linha', () => {
  const cab = acharCabecalhoWcr(COM_BANNER)
  assert.ok(cab)
  assert.equal(cab.linha, 1)
  assert.equal(cab.mapa.data, 0)
  assert.equal(cab.mapa.equipe, 1)
  assert.equal(cab.mapa.HM, 6)
})

test('planilha sem cabeçalho reconhecível avisa em português', () => {
  const r = lerPlanilhaWcr([['bla', 'ble'], [1, 2]])
  assert.equal(r.apontamentos.length, 0)
  assert.match(r.problemas[0], /cabeçalho/i)
})

test('lê a linha e monta o apontamento', () => {
  const r = lerPlanilhaWcr(COM_BANNER, { hoje: HOJE })
  assert.equal(r.apontamentos.length, 1)
  const a = r.apontamentos[0]
  assert.equal(a.data, '2026-08-31')
  assert.equal(a.equipe, 'Gilvan')
  assert.equal(a.nucleo, 'Boi Malhado')
  assert.equal(a.observacoes, 'sem intercorrência')
  assert.equal(a.linhaDaPlanilha, 3)
})

test('⚠️ vários imóveis numa célula só viram vários imóveis', () => {
  const a = lerPlanilhaWcr(COM_BANNER, { hoje: HOJE }).apontamentos[0]
  assert.deepEqual(a.imoveis, ['rua santa rosa de sul', 'rua um'])
})

test('⚠️ célula vazia continua sendo "não informado", nunca zero', () => {
  const a = lerPlanilhaWcr(COM_BANNER, { hoje: HOJE }).apontamentos[0]
  const pra = a.linhas.find((l) => l.sigla === 'PRA')
  const la  = a.linhas.find((l) => l.sigla === 'LA')
  assert.equal(pra?.quantidade, undefined)
  assert.equal(la?.quantidade, undefined)
  assert.equal(a.linhas.find((l) => l.sigla === 'HM')?.quantidade, 100)
  assert.equal(a.linhas.filter((l) => l.quantidade === 0).length, 0)
})

test('sigla sem coluna na planilha não é inventada', () => {
  const a = lerPlanilhaWcr(COM_BANNER, { hoje: HOJE }).apontamentos[0]
  // A planilha só tem PRA, LA e HM.
  assert.deepEqual(a.linhas.map((l) => l.sigla).sort(), ['HM', 'LA', 'PRA'])
})

test('⭐ o mesmo apontamento pela planilha e colado dão O MESMO resultado', () => {
  const daPlanilha = lerPlanilhaWcr(COM_BANNER, { hoje: HOJE }).apontamentos[0]
  const colado = parseApontamentoWcr(
    ['Produção - 31/08/2026',
     'Equipe - Gilvan',
     'Núcleo - Boi Malhado',
     'Imóvel - rua santa rosa de sul',
     'Imóvel - rua um',
     'PRA - ',
     'LA - ',
     'HM - 100',
     'obs: sem intercorrência'].join('\n'),
    { hoje: HOJE },
  )
  assert.equal(daPlanilha.data, colado.data)
  assert.equal(daPlanilha.equipe, colado.equipe)
  assert.equal(daPlanilha.nucleo, colado.nucleo)
  assert.deepEqual(daPlanilha.imoveis, colado.imoveis)
  assert.equal(daPlanilha.observacoes, colado.observacoes)
  assert.deepEqual(daPlanilha.linhas, colado.linhas)
  assert.deepEqual(resumirApontamento(daPlanilha), resumirApontamento(colado))
})

test('linha de grade vazia é ignorada e contada, não vira erro por linha', () => {
  const m: MatrizWcr = [
    ['DATA', 'EQUIPE', 'HM'],
    ['31/08/2026', 'Gilvan', 5],
    [null, null, null],
    [null, null, null],
  ]
  const r = lerPlanilhaWcr(m, { hoje: HOJE })
  assert.equal(r.apontamentos.length, 1)
  assert.equal(r.problemas.length, 1)
  assert.match(r.problemas[0], /2 linhas em branco/)
})

test('data do Excel como Date vira dd/MM/yyyy', () => {
  assert.equal(textoDaCelula(new Date(Date.UTC(2026, 7, 31))), '31/08/2026')
  assert.equal(textoDaCelula(null), '')
  assert.equal(textoDaCelula(100), '100')
})

test('textoDaLinha escreve sigla vazia, para o vazio sobreviver', () => {
  const cab = acharCabecalhoWcr(COM_BANNER)!
  const t = textoDaLinha(cab, COM_BANNER[2])
  assert.match(t, /^PRA - $/m)
  assert.match(t, /^LA - $/m)
  assert.match(t, /^HM - 100$/m)
})

test('várias linhas viram vários apontamentos, cada um com a sua linha', () => {
  const m: MatrizWcr = [
    ['DATA', 'EQUIPE', 'LE'],
    ['01/09/2026', 'Gilvan', 3],
    ['02/09/2026', 'Humberto', 4],
  ]
  const r = lerPlanilhaWcr(m, { hoje: HOJE })
  assert.equal(r.apontamentos.length, 2)
  assert.equal(r.apontamentos[0].linhaDaPlanilha, 2)
  assert.equal(r.apontamentos[1].equipe, 'Humberto')
})
