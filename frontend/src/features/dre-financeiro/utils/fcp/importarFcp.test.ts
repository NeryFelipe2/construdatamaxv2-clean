/**
 * O leitor da planilha do FCP.
 *
 * A diferença para o leitor do Controle de Caixa é o que estes testes cercam: aqui o sistema lê
 * só as **entradas** e **recalcula** o resto — as abas calculadas viram conferência, não dado.
 *
 * Os casos vieram de defeitos reais encontrados rodando contra o arquivo do cliente
 * (`npm run qa:fcp`), não de imaginação.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  acharPremissa, acharUltimoNumero, blocoDoItem, conferirContraAPlanilha, lerAbaDeCustos,
  lerAbaDePrecos, lerPlanilhaFcp, lerRealizado, type Abas,
} from './importarFcp'
import { custoMensalDaCidade, totalDaFolha } from './motor'
import type { Matriz } from '../controleDeCaixaPlanilha'

// ─── Achar premissa pelo rótulo ───────────────────────────────────────────────

test('a premissa é achada pelo RÓTULO, não pela posição', () => {
  // De propósito: a planilha vai ganhar linha, e ler C28 fixo importaria o número errado em
  // silêncio no dia em que alguém inserir uma linha acima.
  const m: Matriz = [
    [null, 'Início da obra / Semana 1 do fluxo', '2026-08-24', 'data'],
    [null, 'Dias por mês (convenção de rateio)', 30, 'dias'],
    [null, 'Bertioga — custo mensal total', 237292.84, 'R$/mês'],
  ]
  assert.equal(acharPremissa(m, 'Dias por mês'), 30)
  assert.equal(acharPremissa(m, 'Bertioga', 'custo mensal'), 237292.84)
  assert.equal(acharPremissa(m, 'não existe'), null)
})

test('acento e caixa não atrapalham a busca da premissa', () => {
  const m: Matriz = [[null, 'CONTINGÊNCIA SOBRE A NECESSIDADE', 0.15]]
  assert.equal(acharPremissa(m, 'contingência'), 0.15)
  assert.equal(acharPremissa(m, 'CONTINGENCIA'), 0.15)
})

test('⚠️ o ÚLTIMO número da linha, para as linhas de TOTAL', () => {
  // Defeito real: a linha "TOTAL / 15 pessoas" tem salário, encargos, benefícios e SÓ ENTÃO o
  // total. Pegar a primeira célula à direita dava R$ 51.585 em vez de R$ 106.692,84, e a
  // conferência acusava 96% de divergência que não existia.
  const m: Matriz = [[null, 'TOTAL', '15 pessoas', null, 51585, 29922.84, 25185, 106692.84]]
  assert.equal(acharUltimoNumero(m, 'pessoas'), 106692.84)
  assert.equal(acharPremissa(m, 'pessoas'), 51585, 'a busca comum pega a primeira — é a diferença')
})

// ─── Aba de custos ────────────────────────────────────────────────────────────

const CUSTOS: Matriz = [
  [null, 'CUSTOS — BERTIOGA'],
  [],
  [null, 'EQUIPE — QUADRO NOMINAL'],
  [null, 'EQUIPE', 'NOME', 'CARGO', 'SALÁRIO', 'ENCARGOS', 'BENEFÍCIOS', 'TOTAL / MÊS'],
  [null, 'A', 'Funcionário 01', 'Ajudante Geral', 2951, 1712, 1679, 6342],
  [null, 'A', 'Funcionário 02', 'Encanador Motorista', 3932, 2281, 1679, 7892],
  // ⚠️ Linha REAL da planilha: vaga sem nome, com cargo e salário.
  [null, '—', null, 'Programador', 2548, 1477.84, 1679, 5704.84],
  [null, 'TOTAL', '3 pessoas', null, 9431, 5470.84, 5037, 19938.84],
  [],
  [null, 'CUSTOS GERAIS DA OBRA (R$/mês)'],
  [null, 'ITEM', null, 'QNT', 'VALOR UNIT.', 'TOTAL MÊS'],
  [null, 'Salário engenheiro', null, 1, 13000, 13000],
  [null, 'Kit ferramenta equipes', null, 4, 7200, 28800],
  [null, 'Custos indiretos', null, 1, 20000, 20000],
  // ⚠️ Esta linha é o total do quadro repetido, para a soma da PLANILHA fechar.
  [null, 'Equipe (folha + encargos + benefícios)', null, 1, 19938.84, 19938.84],
  [null, 'TOTAL MENSAL — BERTIOGA', null, null, null, 81738.84],
]

test('⚠️ vaga SEM NOME conta na folha — é gente que ainda vai ser contratada', () => {
  // Defeito real: exigir nome perdia a linha do Programador, e o custo mensal saía R$ 5.704,84
  // menor do que o real. Quem manda é o salário.
  const { quadro } = lerAbaDeCustos(CUSTOS, 'CUSTOS BERTIOGA')
  assert.equal(quadro.length, 3)
  assert.equal(quadro[2].nome, '(vaga a contratar)')
  assert.equal(quadro[2].cargo, 'Programador')
  assert.equal(quadro[2].salario, 2548)
  assert.equal(totalDaFolha({ quadro, gerais: [] }), 19938.84)
})

test('a linha TOTAL do quadro não vira pessoa', () => {
  const { quadro } = lerAbaDeCustos(CUSTOS, 'x')
  assert.ok(!quadro.some((p) => /^TOTAL/i.test(p.nome)))
})

test('⚠️ a linha "Equipe (folha…)" dos gerais é ignorada — senão a folha CONTA DUAS VEZES', () => {
  // Ela existe na planilha só para a soma dela fechar. Contá-la aqui dobraria a folha e o custo
  // mensal sairia com R$ 19.938,84 a mais.
  const { gerais } = lerAbaDeCustos(CUSTOS, 'x')
  assert.ok(!gerais.some((g) => /^Equipe \(folha/i.test(g.item)))
  assert.equal(gerais.length, 3)
})

test('o custo mensal da aba fecha com o TOTAL MENSAL que ela declara', () => {
  const { quadro, gerais } = lerAbaDeCustos(CUSTOS, 'x')
  const cidade = { id: 'x', nome: 'X', ticket: 1, mobilizacao: 0, custos: { quadro, gerais } }
  assert.equal(custoMensalDaCidade(cidade), 81738.84)
})

test('cada item de custo cai no bloco certo — é o que decide quem paga', () => {
  assert.equal(blocoDoItem('Salário engenheiro'), 'engenheiro')
  assert.equal(blocoDoItem('Custos indiretos'), 'indiretos')
  assert.equal(blocoDoItem('Mobilização inicial'), 'mobilizacao')
  assert.equal(blocoDoItem('Caminhão 3/4 + munck'), 'estrutura')
  assert.equal(blocoDoItem('Alojamento'), 'estrutura')
  assert.equal(blocoDoItem('coisa que ninguém previu'), 'estrutura', 'o desconhecido vira estrutura')
})

test('aba de custo sem quadro nem gerais avisa, em vez de devolver zero em silêncio', () => {
  const { problemas } = lerAbaDeCustos([['nada', 'aqui']], 'CUSTOS VAZIA')
  assert.equal(problemas.length, 2)
  assert.ok(problemas.every((p) => p.aba === 'CUSTOS VAZIA'))
})

// ─── Preços ───────────────────────────────────────────────────────────────────

test('as duas abas de preço têm formas DIFERENTES e as duas são lidas', () => {
  // Bertioga tem 4 colunas; Santos tem 6, com ITEM e OBS. As colunas são achadas pelo nome.
  const bertioga: Matriz = [
    [null, 'PREÇOS DO CONTRATO — BERTIOGA'],
    [null, 'DESCRIÇÃO', 'N. PREÇO', 'UN', 'R$ UNIT.'],
    [null, 'LAG PA SUCES S/REP SF', '72000033', 'un', 60.9462],
  ]
  const santos: Matriz = [
    [null, 'PREÇOS DO CONTRATO — SANTOS'],
    [null, 'ITEM', 'DESCRIÇÃO', 'N. PREÇO', 'UN', 'R$ UNIT.', 'OBS'],
    [null, '2090501', 'CONST PI ATE 2M S/REP', '72000759', 'un', 1597.75, null],
    [null, '2090502', 'CONST PI DE 2 A 3M', '72000760', 'un', 176.75, 'foto cortada — conferir centavos'],
  ]
  const b = lerAbaDePrecos(bertioga)
  assert.equal(b.length, 1)
  assert.equal(b[0].valorUnitario, 60.9462)
  assert.equal(b[0].item, undefined, 'Bertioga não tem coluna ITEM')

  const s = lerAbaDePrecos(santos)
  assert.equal(s.length, 2)
  assert.equal(s[0].item, '2090501')
  assert.equal(s[0].precisaConferir, false)
  assert.equal(s[1].precisaConferir, true, 'o item transcrito de foto é marcado')
})

test('linha de seção (sem preço) não vira item de preço', () => {
  const m: Matriz = [
    [null, 'DESCRIÇÃO', 'N. PREÇO', 'UN', 'R$ UNIT.'],
    [null, 'EXECUÇÃO DE LIGAÇÃO DE ÁGUA SUCESSIVA -', null, null, null],
    [null, 'LAG PA SUCES', '72000033', 'un', 60.94],
  ]
  assert.equal(lerAbaDePrecos(m).length, 1)
})

// ─── Produção realizada ───────────────────────────────────────────────────────

test('lê a produção realizada casando cidade pelo nome e semana pelo cabeçalho', () => {
  const m: Matriz = [
    [null, null, 'Anterior', 'S1', 'S2', 'S3', 'S4'],
    [null, 'PLANEJADO × REALIZADO'],
    [null, 'BERTIOGA — produção realizada', null, 90, null, 105, null],
    [null, 'SANTOS — produção realizada', null, 70, 68, null, null],
  ]
  const cidades = [
    { id: 'bertioga', nome: 'Bertioga', ticket: 881.2, mobilizacao: 0, custos: { quadro: [], gerais: [] } },
    { id: 'santos', nome: 'Santos', ticket: 1338.8, mobilizacao: 0, custos: { quadro: [], gerais: [] } },
  ]
  const r = lerRealizado(m, cidades)
  assert.equal(r.bertioga[1], 90)
  assert.equal(r.bertioga[2], undefined, 'semana sem lançamento fica sem valor')
  assert.equal(r.bertioga[3], 105)
  assert.equal(r.santos[2], 68)
})

test('planilha sem a seção de realizado não quebra', () => {
  assert.deepEqual(lerRealizado([['nada']], []), {})
})

// ─── A leitura inteira, e a conferência ───────────────────────────────────────

const PREMISSAS: Matriz = [
  [null, 'FLUXO DE CAIXA PROJETADO'],
  [null, 'Início da obra / Semana 1 do fluxo', '2026-08-24', 'data'],
  [null, 'Fim da operação projetada', '2027-07-31', 'data'],
  [null, 'Dias por mês (convenção de rateio)', 30, 'dias'],
  [null, 'Defasagem de recebimento', 20, 'dias'],
  [null, 'Imposto da nota', 0.22, '%'],
  [null, 'Cenário adotado no fluxo', 'ÓTIMA', '—'],
  ['MÍNIMA', 'Margem do cenário MÍNIMA', 0, '%'],
  ['MÉDIA', 'Margem do cenário MÉDIA', 0.10, '%'],
  ['BOA', 'Margem do cenário BOA', 0.15, '%'],
  ['ÓTIMA', 'Margem do cenário ÓTIMA', 0.20, '%'],
  [null, 'Bertioga — ticket médio por serviço', 881.20, 'R$/un'],
  [null, 'Bertioga — custos iniciais (Adiantamento)', 13360, 'R$'],
  [null, 'Contingência sobre a necessidade máxima', 0.15, '%'],
  [null, 'Fator de custos do 1º mês', 0.5, '%'],
  [null, 'Folha das equipes — quem paga', 'CONSÓRCIO'],
  [null, 'Engenheiro — quem paga', 'CONSÓRCIO'],
  [null, 'Estrutura e locações — quem paga', 'CONSÓRCIO'],
  [null, 'Custos indiretos — quem paga', 'WCR'],
  [null, 'Mobilização — quem paga', 'CONSÓRCIO'],
  [null, 'O consórcio desconta da medição o que ele paga?', 'SIM'],
  [null, 'Base do imposto da nota', 'MEDIÇÃO CHEIA'],
]

const ABAS: Abas = { PREMISSAS, 'CUSTOS Bertioga': CUSTOS }

test('a leitura monta as premissas inteiras a partir da planilha', () => {
  const r = lerPlanilhaFcp(ABAS)
  const p = r.premissas!
  assert.equal(p.inicioObra, '2026-08-24')
  assert.equal(p.fimOperacao, '2027-07-31')
  assert.equal(p.defasagemDias, 20)
  assert.equal(p.imposto, 0.22)
  assert.equal(p.cenario, 'OTIMA')
  assert.deepEqual(p.margens, { MINIMA: 0, MEDIA: 0.10, BOA: 0.15, OTIMA: 0.20 })
  assert.equal(p.contingencia, 0.15)
  assert.equal(p.fatorPrimeiroMes, 0.5)
  assert.equal(p.consorcioDescontaDaMedicao, true)
  assert.equal(p.baseDoImposto, 'CHEIA')
  assert.equal(p.cidades.length, 1)
  assert.equal(p.cidades[0].nome, 'Bertioga')
  assert.equal(p.cidades[0].ticket, 881.20)
  assert.equal(p.cidades[0].mobilizacao, 13360)
})

test('⚠️ "WCR" é a empresa, e qualquer coisa que não seja consórcio também', () => {
  // O padrão seguro é a empresa pagar: erra deixando o caixa mais apertado, não mais folgado.
  const p = lerPlanilhaFcp(ABAS).premissas!
  assert.equal(p.regime.indiretos, 'EMPRESA')
  assert.equal(p.regime.folha, 'CONSORCIO')
})

test('cada aba CUSTOS <cidade> vira uma cidade', () => {
  const duas = lerPlanilhaFcp({ ...ABAS, 'CUSTOS Santos': CUSTOS })
  assert.equal(duas.premissas!.cidades.length, 2)
  assert.deepEqual(duas.premissas!.cidades.map((c) => c.nome).sort(), ['Bertioga', 'Santos'])
})

test('planilha sem PREMISSAS avisa e não tenta calcular', () => {
  const r = lerPlanilhaFcp({ 'CUSTOS Bertioga': CUSTOS })
  assert.equal(r.premissas, null)
  assert.match(r.problemas[0].motivo, /aba PREMISSAS/)
})

test('planilha sem aba de custo nenhuma avisa', () => {
  const r = lerPlanilhaFcp({ PREMISSAS })
  assert.ok(r.problemas.some((p) => /CUSTOS <cidade>/.test(p.motivo)))
})

test('a conferência aponta a divergência com o antes e o depois', () => {
  // A planilha diz que o custo mensal é 99.999; o motor calcula 81.738,84 a partir das linhas.
  const comErro: Matriz = [...PREMISSAS, [null, 'Bertioga — custo mensal total', 99999, 'R$/mês']]
  const d = conferirContraAPlanilha(
    lerPlanilhaFcp({ ...ABAS, PREMISSAS: comErro }).premissas!,
    { ...ABAS, PREMISSAS: comErro },
  )
  const achada = d.find((x) => x.oQue.includes('Custo mensal — Bertioga'))!
  assert.ok(achada, 'a divergência tem de aparecer')
  assert.equal(achada.naPlanilha, 99999)
  assert.ok(Math.abs(achada.calculado - 81738.84) < 0.01)
  assert.ok(achada.diferenca < 0)
})

test('sem divergência, a lista vem vazia — e é isso que "confere" quer dizer', () => {
  const d = conferirContraAPlanilha(lerPlanilhaFcp(ABAS).premissas!, ABAS)
  assert.ok(!d.some((x) => x.oQue.includes('Custo mensal — Bertioga')),
    `divergências inesperadas: ${JSON.stringify(d)}`)
})

test('a divergência é ordenada pela PROPORÇÃO, não pelo valor absoluto', () => {
  // Uma diferença de R$ 100 num total de R$ 200 importa mais do que R$ 5.000 em R$ 5 milhões.
  const comDoisErros: Matriz = [
    ...PREMISSAS,
    [null, 'Bertioga — custo mensal total', 81838.84, 'R$/mês'],   // Δ 100, ~0,1%
    [null, 'GLOBAL — custo mensal total', 40000, 'R$/mês'],        // Δ grande, ~104%
  ]
  const abas = { ...ABAS, PREMISSAS: comDoisErros }
  const d = conferirContraAPlanilha(lerPlanilhaFcp(abas).premissas!, abas)
  assert.ok(d.length >= 2)
  assert.ok(d[0].proporcao >= d[1].proporcao, 'a maior proporção vem primeiro')
})
