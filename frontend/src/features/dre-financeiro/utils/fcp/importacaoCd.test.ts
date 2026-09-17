/**
 * A prévia da importação do FCP: o que muda, o que é preservado e o que a planilha confere.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LeituraFcp } from '../../components/importador/planilhaFcp'
import { BERTIOGA_SANTOS as P } from './premissasBertiogaSantos'
import { bancoDoFcp } from './fcpDoBanco'
import { conferirImportacao, linhasDaLeitura, type FcpExistente } from './importacaoCd'
import { capitalNecessario, custoMensalDaCidade, fluxoMensal } from './motor'
import type { Abas } from './importarFcp'

/** A leitura do ConstruData (planilhaFcp.ts) de uma planilha com as premissas da fixture. */
function leituraDaFixture(sem: Partial<Record<keyof LeituraFcp['premissas'], true>> = {}): LeituraFcp {
  const b = bancoDoFcp(P, 'x')
  const pr = b.premissas!
  const premissas = Object.fromEntries(
    Object.entries(pr).filter(([k]) => k !== 'fcp_id').map(([k, v]) => [k, sem[k as keyof LeituraFcp['premissas']] ? null : v]),
  ) as unknown as LeituraFcp['premissas']
  return {
    premissas,
    obras: b.obras.map((o) => ({
      nome: o.nome, ticket_unico: o.ticket_unico, ticket_agua: o.ticket_agua, ticket_esgoto: o.ticket_esgoto,
      pct_esgoto: o.pct_esgoto, mobilizacao: o.mobilizacao,
      pessoas: b.pessoas.filter((p) => p.fcp_obra_id === o.id).map((p) => ({
        equipe: p.equipe, nome: p.nome, cargo: p.cargo, salario: p.salario, encargos: p.encargos, beneficios: p.beneficios,
      })),
      gerais: b.gerais.filter((g) => g.fcp_obra_id === o.id).map((g) => ({
        item: g.item, categoria: g.categoria, quantidade: g.quantidade, valor_unitario: g.valor_unitario,
      })),
      precos: [],
    })),
    obrasIgnoradas: [],
    avisos: [],
  }
}

/** O FCP como está no banco depois de uma importação anterior. */
function existenteDe(leitura: LeituraFcp, extra: Partial<FcpExistente> = {}): FcpExistente {
  const { linhas } = linhasDaLeitura(leitura, null, 'fcp-1')
  // ids "do banco" para as obras
  const ids = new Map(linhas.obras.map((o) => [o.id, `db-${o.nome}`]))
  return {
    id: 'fcp-1', nome: 'WCR — Bertioga + Santos', status: 'rascunho',
    linhas: {
      premissas: linhas.premissas,
      obras: linhas.obras.map((o) => ({ ...o, id: ids.get(o.id)! })),
      pessoas: linhas.pessoas.map((p) => ({ ...p, fcp_obra_id: ids.get(p.fcp_obra_id)! })),
      gerais: linhas.gerais.map((g) => ({ ...g, fcp_obra_id: ids.get(g.fcp_obra_id)! })),
      realizados: [],
    },
    ...extra,
  }
}

const semanal = (linhas: Array<[string, Record<number, number>]>): Abas['x'] => [
  [null, 'SEMANA', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  ...linhas.map(([rotulo, v]) => [null, rotulo, ...[1, 2, 3, 4, 5, 6].map((s) => v[s] ?? null)]),
]

test('primeira importação: capital da planilha, nenhum padrão usado, nada "antes"', () => {
  const c = conferirImportacao(leituraDaFixture(), {}, null)
  assert.ok(c.premissas)
  assert.deepEqual(c.padroesUsados, [])
  assert.equal(c.capitalAntes, null)
  assert.ok(Math.abs((c.capitalDepois ?? 0) - 181646.84) < 0.01)
})

test('campo que a planilha não traz e não existia: vai com o padrão do banco, e a prévia DIZ qual', () => {
  const c = conferirImportacao(leituraDaFixture({ contingencia: true, defasagem_dias: true }), {}, null)
  assert.deepEqual(c.padroesUsados.map((p) => p.campo).sort(), ['Contingência', 'Defasagem de recebimento'])
})

test('campo ausente na planilha mas já gravado no FCP: vale o que estava (é o que o gravador faz)', () => {
  const existente = existenteDe(leituraDaFixture())
  existente.linhas.premissas = { ...existente.linhas.premissas!, contingencia: 0.3 }
  const c = conferirImportacao(leituraDaFixture({ contingencia: true }), {}, existente)
  assert.deepEqual(c.padroesUsados, [])
  assert.equal(c.premissas!.contingencia, 0.3)
})

test('realizado: a planilha preenche o vazio, o sistema vence no conflito, e o capital usa a mistura', () => {
  const existente = existenteDe(leituraDaFixture())
  existente.linhas.realizados = [{ id: 'r1', fcp_obra_id: 'db-Bertioga', n_semana: 3, producao: 80, observacao: null }]
  const abas: Abas = { 'FCP SEMANAL': semanal([['Bertioga — produção realizada', { 3: 50, 4: 60 }]]) }

  const c = conferirImportacao(leituraDaFixture(), abas, existente)
  assert.deepEqual(c.realizadoNovo, [{ obra: 'Bertioga', semana: 4, producao: 60 }])
  assert.deepEqual(c.realizadoConflitante, [{ obra: 'Bertioga', semana: 3, planilha: 50, sistema: 80 }])

  // O capital da prévia é o do realizado MISTURADO (sistema na S3, planilha na S4).
  const esperado = capitalNecessario(c.premissas!, fluxoMensal(c.premissas!, { 'db-Bertioga': { 3: 80, 4: 60 } }))
  assert.equal(c.capitalDepois, esperado.capitalRecomendado)
})

test('obra que está no FCP e não veio na planilha é apontada, não apagada', () => {
  const existente = existenteDe(leituraDaFixture())
  existente.linhas.obras = [...existente.linhas.obras, { ...existente.linhas.obras[0], id: 'db-cubatao', nome: 'CUBATÃO' }]
  const c = conferirImportacao(leituraDaFixture(), {}, existente)
  assert.deepEqual(c.obrasAusentes, ['CUBATÃO'])
})

test('FCP enviado que recebe premissa nova volta para rascunho — e a prévia mostra o antes → depois', () => {
  const existente = existenteDe(leituraDaFixture(), { status: 'enviado' })
  const nova = leituraDaFixture()
  nova.premissas = { ...nova.premissas, defasagem_dias: 45 }
  const c = conferirImportacao(nova, {}, existente)
  assert.equal(c.voltaParaRascunho, true)
  assert.ok(c.mudancas.some((m) => m.rotulo === 'Defasagem de recebimento' && m.antes === '20 dias' && m.depois === '45 dias'))
  assert.ok(c.capitalAntes !== null && c.capitalDepois !== null && c.capitalAntes !== c.capitalDepois)

  // Mesma planilha de novo: nada muda, não volta para rascunho.
  const igual = conferirImportacao(leituraDaFixture(), {}, existente)
  assert.deepEqual(igual.mudancas, [])
  assert.equal(igual.voltaParaRascunho, false)
})

test('conferências: mostra o que bateu, o que divergiu e o que não achou na planilha', () => {
  const bertioga = P.cidades.find((c) => c.nome === 'Bertioga')!
  const abas: Abas = {
    PREMISSAS: [
      [null, 'Bertioga — custo mensal total', custoMensalDaCidade(bertioga)],
      [null, 'Santos — custo mensal total', 1],
    ],
  }
  const c = conferirImportacao(leituraDaFixture(), abas, null)
  const status = (oQue: string) => c.conferencias.find((x) => x.oQue === oQue)?.status
  assert.equal(status('Custo mensal — Bertioga'), 'bateu')
  assert.equal(status('Custo mensal — Santos'), 'divergiu')
  assert.equal(status('Custo mensal GLOBAL'), 'nao_encontrado')
  assert.equal(c.divergencias.length, 1)
})
