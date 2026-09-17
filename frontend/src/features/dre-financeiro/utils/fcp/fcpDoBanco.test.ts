/**
 * A ponte tabelas do FCP → motor TS. O que se prova aqui: o número que a tela mostra, calculado a
 * partir das LINHAS DO BANCO (com os números vindo como texto, como o PostgREST devolve numeric),
 * é o mesmo que o motor calcula a partir da planilha.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BERTIOGA_SANTOS as P } from './premissasBertiogaSantos'
import { bancoDoFcp, fcpDoBanco, type LinhasDoFcp } from './fcpDoBanco'
import { capitalNecessario, fluxoMensal, fluxoSemanal, custoMensalDaCidade } from './motor'

/** O PostgREST devolve `numeric` como string ("881.20"). */
function comoPostgrest(l: LinhasDoFcp): LinhasDoFcp {
  const texto = <T extends object>(o: T): T =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v])) as T
  return {
    premissas: l.premissas ? texto(l.premissas) : null,
    obras: l.obras.map(texto), pessoas: l.pessoas.map(texto),
    gerais: l.gerais.map(texto), realizados: l.realizados.map(texto),
  }
}

test('linhas do banco (numeric como texto) dão o mesmo capital da planilha: R$ 181.646,84 em out/2026', () => {
  const { premissas, pendencias } = fcpDoBanco(comoPostgrest(bancoDoFcp(P, 'fcp-1')))
  assert.ok(premissas)
  assert.deepEqual(pendencias, [])
  const cap = capitalNecessario(premissas, fluxoMensal(premissas))
  assert.ok(Math.abs(cap.capitalRecomendado - 181646.84) < 0.01, String(cap.capitalRecomendado))
  assert.equal(cap.mesDoPiorPonto, '2026-10-01')
})

test('ida e volta: fcpDoBanco(bancoDoFcp(P)) é P', () => {
  const { premissas } = fcpDoBanco(bancoDoFcp(P, 'fcp-1'))
  assert.ok(premissas)
  assert.deepEqual(premissas, P)
  for (const c of P.cidades) {
    assert.equal(custoMensalDaCidade(premissas.cidades.find((x) => x.id === c.id)!), custoMensalDaCidade(c))
  }
})

test('realizado: 0 gravado é zero; semana sem linha usa o previsto', () => {
  const bertioga = P.cidades[0].id
  const linhas = bancoDoFcp(P, 'fcp-1', { [bertioga]: { 1: 0, 2: 12 } })
  const { realizado, premissas } = fcpDoBanco(comoPostgrest(linhas))
  assert.equal(realizado[bertioga][1], 0)
  assert.equal(realizado[bertioga][2], 12)
  assert.equal(realizado[bertioga][3], undefined)
  const s = fluxoSemanal(premissas!, realizado, 3)
  const linha = (n: number) => s[n - 1].porCidade.find((x) => x.cidadeId === bertioga)!
  assert.equal(linha(1).producaoRealizada, 0)
  assert.equal(linha(1).medicao, 0)
  assert.equal(linha(3).producaoRealizada, undefined)
  assert.ok(linha(3).medicao > 0)
})

test('obra sem ticket (o 0 com que o "Criar FCP" nasce): pendência, e os custos continuam no caixa', () => {
  const linhas = bancoDoFcp(P, 'fcp-1')
  linhas.obras = linhas.obras.map((o) => ({ ...o, ticket_unico: 0, ticket_agua: null, ticket_esgoto: null, pct_esgoto: null }))
  const { premissas, pendencias } = fcpDoBanco(linhas)
  assert.equal(pendencias.filter((p) => /sem ticket/.test(p.mensagem)).length, 2)
  const cap = capitalNecessario(premissas!, fluxoMensal(premissas!))
  // O SQL antigo pulava a obra e devolvia capital 0 "confiante". Sem receita, o capital é o custo.
  assert.ok(cap.capitalRecomendado > 0)
})

test('ticket único E mix ao mesmo tempo: vale o mix, com pendência explícita', () => {
  const linhas = bancoDoFcp(P, 'fcp-1')
  const santos = linhas.obras.find((o) => o.ticket_agua !== null)!
  santos.ticket_unico = 999
  const { premissas, pendencias } = fcpDoBanco(linhas)
  assert.ok(pendencias.some((p) => /ticket único E mix/.test(p.mensagem)))
  assert.ok(premissas!.cidades.find((c) => c.id === santos.id)!.mix)
})

test('linhas excluídas (deleted_at) não entram na conta', () => {
  const linhas = bancoDoFcp(P, 'fcp-1')
  const antes = capitalNecessario(fcpDoBanco(linhas).premissas!, fluxoMensal(fcpDoBanco(linhas).premissas!))
  const extra = { ...linhas.gerais[0], id: 'apagado', valor_unitario: 1_000_000, deleted_at: '2026-09-01' }
  linhas.gerais = [...linhas.gerais, extra as typeof linhas.gerais[0]]
  const { premissas } = fcpDoBanco(linhas)
  const depois = capitalNecessario(premissas!, fluxoMensal(premissas!))
  assert.equal(depois.capitalRecomendado, antes.capitalRecomendado)
})
