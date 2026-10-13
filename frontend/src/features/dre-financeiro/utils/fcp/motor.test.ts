/**
 * O motor do FCP contra a planilha do cliente.
 *
 * Todo número esperado aqui foi lido de `FLUXO_CAIXA_PROJETADO_BERTIOGA_SANTOS_v2.xlsx` — das
 * FÓRMULAS, não só dos valores. A referência da célula está em cada teste.
 *
 * ⚠️ Há um ponto em que o motor **diverge de propósito** da planilha, e ele tem seção própria no
 * fim: a planilha atribui 1, 5 e 5 semanas aos três primeiros meses à mão e só depois passa a
 * ratear por dias. O motor rateia por dias desde o começo — e aí os DOIS caminhos da própria
 * planilha passam a concordar entre si.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BERTIOGA_SANTOS as P } from './premissasBertiogaSantos'
import {
  capitalNecessario, custoMensalDaCidade, custoMensalGlobal, custosPorRegime, descontoMensal,
  diasDaSemanaNoMes, fluxoEconomico, fluxoMensal, fluxoSemanal, impostoDaNota, mesesDoFluxo,
  piorPontoSemanal, primeiroDiaDoMes, producaoPrevistaSemanal, semanasDoFluxo, sensibilidade,
  somarDias, ticketDaCidade, totalDaFolha, ultimoDiaDoMes, viabilidadeDaCidade, viabilidadeGlobal,
} from './motor'
import type { PremissasFcp } from './tipos'

const BERTIOGA = P.cidades[0]
const SANTOS = P.cidades[1]
/** Ao real: a planilha arredonda na exibição, e centavo de diferença não é defeito. */
const perto = (a: number, e: number, rotulo: string, tol = 0.51) =>
  assert.ok(Math.abs(a - e) <= tol, `${rotulo}: ${a.toFixed(2)} ≠ ${e.toFixed(2)}`)

// ─── Datas ────────────────────────────────────────────────────────────────────

test('EOMONTH e a defasagem: a medição de agosto é paga em 20/09', () => {
  assert.equal(ultimoDiaDoMes('2026-08-24'), '2026-08-31')
  assert.equal(somarDias('2026-08-31', 20), '2026-09-20')
  assert.equal(ultimoDiaDoMes('2027-02-10'), '2027-02-28', 'fevereiro não bissexto')
  assert.equal(ultimoDiaDoMes('2028-02-10'), '2028-02-29', 'fevereiro bissexto')
  assert.equal(primeiroDiaDoMes('2026-08-24'), '2026-08-01')
})

test('as 12 semanas começam na segunda de início e não escorregam', () => {
  const s = semanasDoFluxo(P, 12)
  assert.equal(s.length, 12)
  assert.equal(s[0].inicio, '2026-08-24')
  assert.equal(s[0].fim, '2026-08-30')
  assert.equal(s[11].inicio, '2026-11-09', 'S12 — igual ao cabeçalho da planilha')
  assert.equal(s[11].fim, '2026-11-15')
})

test('os meses do horizonte, com dias de obra e data de pagamento — AUX!C3:Q9', () => {
  const m = mesesDoFluxo(P)
  assert.equal(m.length, 12)
  assert.equal(m[0].mes, '2026-08-01')
  assert.equal(m[0].diasDeObra, 8, 'de 24 a 31 de agosto')
  assert.equal(m[0].diasEquivalentes, 15, 'AUX!C9 — o 1º mês usa o fator 0,5 × 30 para CUSTO')
  assert.equal(m[0].dataPagamento, '2026-09-20')
  assert.equal(m[1].diasDeObra, 30)
  assert.equal(m[1].diasEquivalentes, 30, 'do 2º mês em diante, dias equivalentes = dias de obra')
  assert.equal(m[11].mes, '2027-07-01')
  assert.equal(m.reduce((s, x) => s + x.diasDeObra, 0), 342, 'ECONÔMICO!Q6')
})

// ─── Custos ───────────────────────────────────────────────────────────────────

test('a folha de Bertioga fecha nos R$ 106.692,84 das 15 pessoas', () => {
  assert.equal(BERTIOGA.custos.quadro.length, 15)
  perto(totalDaFolha(BERTIOGA.custos), 106692.84, 'folha')
})

test('os custos mensais fecham nas três linhas das PREMISSAS', () => {
  perto(custoMensalDaCidade(BERTIOGA), 237292.84, 'Bertioga — PREMISSAS!C28')
  perto(custoMensalDaCidade(SANTOS), 269561.48, 'Santos — PREMISSAS!C29')
  perto(custoMensalGlobal(P), 506854.32, 'GLOBAL — PREMISSAS!C30')
})

test('o regime separa o que o consórcio banca do que sai do caixa — PREMISSAS!C51:C56', () => {
  perto(custosPorRegime(P, BERTIOGA).consorcio, 217292.84, 'Bertioga consórcio')
  perto(custosPorRegime(P, BERTIOGA).empresa, 20000, 'Bertioga empresa')
  perto(custosPorRegime(P, SANTOS).consorcio, 249561.48, 'Santos consórcio')
  perto(custosPorRegime(P, SANTOS).empresa, 20000, 'Santos empresa')
})

test('⚠️ se o consórcio NÃO desconta, o desconto zera — é outra empresa', () => {
  // A diferença entre "ele adianta" e "ele patrocina". Muda tudo no caixa.
  assert.ok(descontoMensal(P, BERTIOGA) > 0)
  assert.equal(descontoMensal({ ...P, consorcioDescontaDaMedicao: false }, BERTIOGA), 0)
})

test('obra sem consórcio: tudo vira custo da empresa e o desconto some', () => {
  const semConsorcio: PremissasFcp = {
    ...P,
    regime: { folha: 'EMPRESA', engenheiro: 'EMPRESA', estrutura: 'EMPRESA', indiretos: 'EMPRESA', mobilizacao: 'EMPRESA' },
  }
  perto(custosPorRegime(semConsorcio, BERTIOGA).empresa, 237292.84, 'tudo da empresa')
  assert.equal(custosPorRegime(semConsorcio, BERTIOGA).consorcio, 0)
  assert.equal(descontoMensal(semConsorcio, BERTIOGA), 0)
})

test('o ticket ponderado de Santos: 1.856,40 × 50% + 821,25 × 50% — PREMISSAS!C25', () => {
  perto(ticketDaCidade(SANTOS), 1338.825, 'ticket ponderado')
  assert.equal(ticketDaCidade(BERTIOGA), 881.20, 'cidade sem mix usa o ticket direto')
})

test('mudar o mix muda o ticket — 100% esgoto é o ticket do esgoto', () => {
  const so = { ...SANTOS, mix: { ...SANTOS.mix!, fracaoB: 1 } }
  perto(ticketDaCidade(so), 1856.40, 'só esgoto')
  const nenhum = { ...SANTOS, mix: { ...SANTOS.mix!, fracaoB: 0 } }
  perto(ticketDaCidade(nenhum), 821.25, 'só água')
})

// ─── VIABILIDADE ──────────────────────────────────────────────────────────────

test('VIABILIDADE Bertioga, os quatro cenários — VIABILIDADE!C7:H10', () => {
  const v = viabilidadeDaCidade(P, BERTIOGA)
  const esperado = [
    { cenario: 'MINIMA', liquida: 237292.84, bruta: 304221.59, mes: 345.24, semana: 80.55, dia: 11.51 },
    { cenario: 'MEDIA',  liquida: 261022.12, bruta: 334643.75, mes: 379.76, semana: 88.61, dia: 12.66 },
    { cenario: 'BOA',    liquida: 272886.77, bruta: 349854.83, mes: 397.02, semana: 92.64, dia: 13.23 },
    { cenario: 'OTIMA',  liquida: 284751.41, bruta: 365065.91, mes: 414.28, semana: 96.67, dia: 13.81 },
  ]
  for (const e of esperado) {
    const l = v.find((x) => x.cenario === e.cenario)!
    perto(l.receitaLiquida, e.liquida, `${e.cenario} receita líquida`)
    perto(l.medicaoBruta, e.bruta, `${e.cenario} medição bruta`)
    perto(l.servicosMes, e.mes, `${e.cenario} serviços/mês`, 0.01)
    perto(l.servicosSemana, e.semana, `${e.cenario} serviços/semana`, 0.01)
    perto(l.servicosDia, e.dia, `${e.cenario} serviços/dia`, 0.01)
  }
  assert.ok(v.find((x) => x.cenario === 'OTIMA')!.adotado, 'ÓTIMA é o cenário adotado')
})

test('⚠️ o EMPATE cobre o imposto — sem isso a empresa fecha contrato no prejuízo', () => {
  // O aviso da planilha (LEIA-ME): a MÍNIMA aqui é 11,51 serviços/dia; sem descontar os 22% da
  // nota, a conta ingênua daria 8,98 e a obra empataria só no papel.
  const minima = viabilidadeDaCidade(P, BERTIOGA).find((x) => x.cenario === 'MINIMA')!
  perto(minima.servicosDia, 11.51, 'MÍNIMA com imposto', 0.01)
  const ingenuo = custoMensalDaCidade(BERTIOGA) / ticketDaCidade(BERTIOGA) / P.diasPorMes
  perto(ingenuo, 8.98, 'a referência antiga da planilha', 0.01)
  assert.ok(minima.servicosDia > ingenuo * 1.25, 'a diferença é grande, e é o ponto do aviso')
})

test('VIABILIDADE Santos: serviços/dia e a quebra água × esgoto — VIABILIDADE!F19:K19', () => {
  const l = viabilidadeDaCidade(P, SANTOS).find((x) => x.cenario === 'OTIMA')!
  perto(l.medicaoBruta, 414709.97, 'medição bruta')
  perto(l.servicosMes, 309.76, 'serviços/mês', 0.01)
  perto(l.servicosDia, 10.33, 'serviços/dia', 0.01)
  assert.equal(l.porServico?.length, 2)
  perto(l.porServico![0].porDia, 5.16, 'água/dia', 0.01)
  perto(l.porServico![1].porDia, 5.16, 'esgoto/dia', 0.01)
})

test('a viabilidade GLOBAL não inventa serviços por dia', () => {
  // Somar serviços de cidades com tickets diferentes daria um número que não é nada. A planilha
  // também só mostra receita e medição no bloco global (VIABILIDADE!C24:E27).
  const g = viabilidadeGlobal(P).find((x) => x.cenario === 'OTIMA')!
  perto(g.receitaLiquida, 608225.18, 'GLOBAL receita líquida')
  perto(g.medicaoBruta, 779775.88, 'GLOBAL medição bruta')
  assert.equal(g.servicosDia, 0, 'de propósito: não existe serviço/dia global')
})

// ─── Produção semanal ─────────────────────────────────────────────────────────

test('produção prevista por semana — FCP SEMANAL!D11 e D24', () => {
  perto(producaoPrevistaSemanal(P, BERTIOGA), 96.67, 'Bertioga', 0.01)
  perto(producaoPrevistaSemanal(P, SANTOS), 72.28, 'Santos', 0.01)
})

test('a medição da semana usa o REALIZADO quando lançado, e o previsto quando não', () => {
  const s = fluxoSemanal(P, { bertioga: { 1: 50 } })
  const b1 = s[0].porCidade.find((x) => x.cidadeId === 'bertioga')!
  assert.equal(b1.producaoRealizada, 50)
  perto(b1.medicao, 50 * 881.20, 'medição do realizado')
  perto(b1.aderencia!, 50 / 96.67, 'aderência', 0.001)

  const b2 = s[1].porCidade.find((x) => x.cidadeId === 'bertioga')!
  assert.equal(b2.producaoRealizada, undefined, 'semana sem lançamento')
  perto(b2.medicao, 96.67 * 881.20, 'usa o previsto', 5)
})

test('a aderência global é em R$, não em unidades', () => {
  // Somar 50 serviços de Bertioga com 50 de Santos daria 100 "serviços" que valem valores bem
  // diferentes. FCP SEMANAL!D49 pondera pelo ticket, e o motor faz igual.
  const s = fluxoSemanal(P, { bertioga: { 1: 48.335 }, santos: { 1: 72.28 } })
  assert.ok(s[0].aderencia! > 0.7 && s[0].aderencia! < 0.85,
    `aderência ponderada saiu ${s[0].aderencia}`)
})

// ─── FCP MENSAL, e o capital ──────────────────────────────────────────────────

test('o recebimento entra no mês em que a medição é PAGA, não no que ela foi feita', () => {
  // É esta defasagem que cria o buraco de caixa do começo da obra.
  const m = fluxoMensal(P)
  assert.equal(m[0].recebimento, 0, 'agosto não recebe nada — a medição dele é paga em 20/09')
  perto(m[1].recebimento, 207940.24, 'setembro recebe a medição de agosto')
  perto(m[1].medicaoBruta, 779775.88, 'e produz a medição de setembro')
})

test('CAIXA ACUMULADO ANTES do recebimento, mês a mês — AUX!C32:Q32 (cenário ÓTIMA)', () => {
  const esperado = [0, -20000, -157954.36, -57916.29, 48166.87]
  const m = fluxoMensal(P)
  for (let i = 0; i < esperado.length; i++) {
    perto(m[i].acumuladoAntesDoRecebimento, esperado[i], `mês ${i + 1}`, 1)
  }
})

test('CAIXA ACUMULADO DEPOIS do recebimento — AUX!C33:Q33', () => {
  const esperado = [0, -117954.36, -16583.06, 88166.87, 189538.15]
  const m = fluxoMensal(P)
  for (let i = 0; i < esperado.length; i++) {
    perto(m[i].acumuladoDepois, esperado[i], `mês ${i + 1}`, 1)
  }
})

test('⚠️ o capital é o pior ponto ANTES de entrar dinheiro, e não o pior saldo do mês', () => {
  // A diferença é o dinheiro que precisa estar no bolso no dia em que a folha vence e a medição
  // ainda não caiu. Usar o saldo do mês subestimaria a necessidade.
  const m = fluxoMensal(P)
  const c = capitalNecessario(P, m)
  perto(c.necessidadeMaxima, 157954.36, 'necessidade máxima', 1)
  perto(c.contingencia, 23693.15, 'contingência de 15%', 1)
  perto(c.capitalRecomendado, 181647.51, 'capital recomendado', 1)
  assert.equal(c.mesDoPiorPonto, '2026-10-01')
})

test('a contingência é premissa: mudá-la muda o capital, e nada mais', () => {
  const m = fluxoMensal(P)
  const sem = capitalNecessario({ ...P, contingencia: 0 }, m)
  perto(sem.capitalRecomendado, sem.necessidadeMaxima, 'sem contingência, capital = necessidade')
  const dobro = capitalNecessario({ ...P, contingencia: 0.30 }, m)
  perto(dobro.capitalRecomendado, sem.necessidadeMaxima * 1.30, '30% de contingência')
})

// ─── ECONÔMICO ────────────────────────────────────────────────────────────────

test('ECONÔMICO: o 1º mês fecha negativo, e é saldo devido ao consórcio', () => {
  // A planilha explica: no 1º mês o desconto supera a medição parcial. Não é prejuízo do
  // contrato — compensa no mês seguinte.
  const e = fluxoEconomico(P)
  perto(e[0].medicaoBruta, 207940.24, 'medição de agosto')
  perto(e[0].imposto, 45746.85, 'imposto sobre a medição cheia')
  perto(e[0].folha, 113377.16, 'folha × 15/30 — ECONÔMICO!C12')
  perto(e[0].engenheiro, 13000, 'engenheiro × 15/30')
  perto(e[0].estrutura, 107050, 'estrutura × 15/30')
  perto(e[0].indiretos, 20000, 'indiretos × 15/30')
  perto(e[0].mobilizacao, 26720, 'mobilização inteira no 1º mês')
  assert.ok(e[0].resultado < 0)
  assert.ok(e[1].resultado > 0, 'e o mês seguinte já é positivo')
})

test('ECONÔMICO: os custos rateiam pelos dias EQUIVALENTES do mês', () => {
  const e = fluxoEconomico(P)
  perto(e[1].folha, 226754.32, 'setembro: mês cheio')
  perto(e[2].folha, 234312.80, 'outubro tem 31 dias — ECONÔMICO!E12')
  perto(e[0].folha, e[1].folha / 2, 'agosto é metade, pelo fator do 1º mês')
})

test('o resultado acumulado e a medição total fecham no fim do horizonte', () => {
  const e = fluxoEconomico(P)
  assert.equal(e.length, 12)
  perto(e[e.length - 1].resultadoAcumulado, 1010642.44, 'resultado final — AUX!Q33', 2)
})

test('a margem do mês é resultado ÷ medição bruta, e o 1º mês é negativo', () => {
  const e = fluxoEconomico(P)
  assert.ok(e[0].margem < 0)
  assert.ok(e[1].margem > 0.10 && e[1].margem < 0.20, `margem de setembro: ${e[1].margem}`)
})

// ─── Imposto ──────────────────────────────────────────────────────────────────

test('⚠️ a base do imposto é premissa crítica: CHEIA × LÍQUIDA muda muito o caixa', () => {
  // A planilha manda confirmar com o contador. CHEIA é conservador.
  const cheia = impostoDaNota(P, 100000, 60000)
  const liquida = impostoDaNota({ ...P, baseDoImposto: 'LIQUIDA_DO_DESCONTO' }, 100000, 60000)
  assert.equal(cheia, 22000)
  assert.equal(liquida, 8800)
  assert.ok(cheia > liquida * 2, 'a diferença não é detalhe')
})

test('desconto maior que o recebimento não gera imposto negativo', () => {
  assert.equal(impostoDaNota({ ...P, baseDoImposto: 'LIQUIDA_DO_DESCONTO' }, 1000, 5000), 0)
})

test('trocar a base do imposto melhora o capital necessário', () => {
  const cheia = capitalNecessario(P, fluxoMensal(P))
  const alt: PremissasFcp = { ...P, baseDoImposto: 'LIQUIDA_DO_DESCONTO' }
  const liquida = capitalNecessario(alt, fluxoMensal(alt))
  assert.ok(liquida.capitalRecomendado < cheia.capitalRecomendado,
    'com base líquida entra mais caixa, e a necessidade cai')
})

// ─── Sensibilidade ────────────────────────────────────────────────────────────

test('SENSIBILIDADE: os quatro cenários batem com a grade da planilha — AUX!R14:R33', () => {
  const esperado = [
    { cenario: 'MINIMA', necessidade: 186319.34, capital: 214267.24, resultado: -144986.05 },
    { cenario: 'MEDIA',  necessidade: 171470.16, capital: 197190.68, resultado: 432827.78 },
    { cenario: 'BOA',    necessidade: 164712.10, capital: 189418.92, resultado: 721735.11 },
    { cenario: 'OTIMA',  necessidade: 157954.04, capital: 181647.15, resultado: 1010642.44 },
  ]
  const s = sensibilidade(P)
  for (const e of esperado) {
    const l = s.find((x) => x.cenario === e.cenario)!
    perto(l.capital.necessidadeMaxima, e.necessidade, `${e.cenario} necessidade`, 2)
    perto(l.capital.capitalRecomendado, e.capital, `${e.cenario} capital`, 2)
    perto(l.resultadoFinal, e.resultado, `${e.cenario} resultado`, 2)
  }
  assert.ok(s.find((x) => x.cenario === 'OTIMA')!.adotado)
})

test('⚠️ na MÍNIMA a empresa PERDE dinheiro — o empate não é empate no caixa', () => {
  // Margem zero e o resultado final é −144.986. É o número que justifica não fechar contrato
  // no cenário mínimo, e ele só aparece porque o imposto e a defasagem estão na conta.
  const minima = sensibilidade(P).find((x) => x.cenario === 'MINIMA')!
  assert.ok(minima.resultadoFinal < 0)
  assert.ok(minima.capital.capitalRecomendado > sensibilidade(P).find((x) => x.cenario === 'OTIMA')!.capital.capitalRecomendado,
    'e ainda exige MAIS capital do que a ÓTIMA')
})

// ─── O rateio semana → mês, onde o motor diverge da planilha ───────────────────

test('⚠️ a semana que atravessa o mês é rateada por DIA', () => {
  const s = semanasDoFluxo(P, 3)
  // S1: 24–30/08, toda em agosto.
  assert.equal(diasDaSemanaNoMes(P, s[0], '2026-08-01'), 7)
  assert.equal(diasDaSemanaNoMes(P, s[0], '2026-09-01'), 0)
  // S2: 31/08 a 06/09 — 1 dia em agosto, 6 em setembro.
  assert.equal(diasDaSemanaNoMes(P, s[1], '2026-08-01'), 1)
  assert.equal(diasDaSemanaNoMes(P, s[1], '2026-09-01'), 6)
})

test('O TESTE QUE RECONCILIA: agosto dá 8/7 de semana, que é o que a fórmula mensal produz', () => {
  // A planilha atribui 1 semana a agosto (AUX!C5 = 'FCP SEMANAL'!D12) e 5 a setembro. Mas agosto
  // tem 8 dias de obra, não 7 — e a própria fórmula mensal dela (AUX!C29) dá R$ 207.940.
  // Rateando por dia, os dois caminhos passam a concordar. É a prova de que a atribuição
  // 1/5/5 é a peça fora do lugar, não o rateio.
  const m = fluxoMensal(P)
  const porFormulaMensal = (custoMensalGlobal(P) * 1.20) / 0.78 * (8 / 30)
  perto(porFormulaMensal, 207940.24, 'a fórmula mensal da planilha', 1)
  perto(m[0].medicaoBruta, porFormulaMensal, 'e o motor chega no mesmo número', 1)
})

test('o horizonte inteiro não perde nem inventa dias de obra', () => {
  const meses = mesesDoFluxo(P)
  const semanas = semanasDoFluxo(P, 80)
  let dias = 0
  for (const s of semanas) for (const m of meses) dias += diasDaSemanaNoMes(P, s, m.mes)
  assert.equal(dias, 342, 'os mesmos 342 dias de obra, sem sobra e sem falta')
})

// ─── Bordas ───────────────────────────────────────────────────────────────────

test('cidade com ticket zero não estoura em divisão por zero', () => {
  const semTicket: PremissasFcp = {
    ...P, cidades: [{ ...BERTIOGA, ticket: 0, mix: undefined }],
  }
  assert.equal(producaoPrevistaSemanal(semTicket, semTicket.cidades[0]), 0)
  assert.doesNotThrow(() => fluxoMensal(semTicket))
  assert.equal(viabilidadeDaCidade(semTicket, semTicket.cidades[0])[0].servicosMes, 0)
})

test('obra de um mês só não quebra o calendário', () => {
  const curta: PremissasFcp = { ...P, inicioObra: '2026-08-03', fimOperacao: '2026-08-31' }
  const m = mesesDoFluxo(curta)
  assert.equal(m.length, 1)
  assert.equal(m[0].diasDeObra, 29)
  assert.doesNotThrow(() => fluxoMensal(curta))
})

test('sem cidade nenhuma o motor devolve zeros, não NaN', () => {
  const vazio: PremissasFcp = { ...P, cidades: [] }
  assert.equal(custoMensalGlobal(vazio), 0)
  const m = fluxoMensal(vazio)
  assert.ok(m.every((x) => Number.isFinite(x.saldoDoMes) && x.saldoDoMes === 0))
  assert.equal(capitalNecessario(vazio, m).capitalRecomendado, 0)
})

test('caixa que nunca fica negativo não exige capital', () => {
  const semDefasagem: PremissasFcp = { ...P, defasagemDias: 0, cenario: 'OTIMA' }
  const c = capitalNecessario(semDefasagem, fluxoMensal(semDefasagem))
  assert.ok(c.necessidadeMaxima >= 0, 'nunca negativo')
})

test('o pior ponto semanal é o menor acumulado da série', () => {
  const s = fluxoSemanal(P)
  const pior = piorPontoSemanal(s)
  assert.ok(pior <= 0)
  assert.equal(pior, Math.min(0, ...s.map((x) => x.saldoAcumulado)))
})
