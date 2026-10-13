import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  vinculosDeObra, ehWcrFinalizado, rdosDaSemana, producaoDosRdos, divergenciasDoPlano,
} from './wcrParaFcp.ts'
import { BERTIOGA_SANTOS } from '@/features/dre-financeiro/utils/fcp/premissasBertiogaSantos'
import type { RDO, ConstructionSite } from '@/types'
import type { PlanoFcp } from '@/features/dre-financeiro/utils/fcp/reimportarPlano'
import type { Semana } from '@/features/dre-financeiro/utils/fcp/tipos'

const SEMANA_2: Semana = { numero: 2, inicio: '2026-08-31', fim: '2026-09-06' }

function rdoWcr(over: Partial<RDO> & { producao?: { sigla: string; quantidade: string; unidade: 'M' | 'UN' }[] }): RDO {
  const { producao, ...resto } = over
  return {
    id: 'r1', number: 1, date: '2026-09-01', responsible: 'Gilvan',
    weather: { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 0 },
    manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
    equipment: [], services: [], trechos: [], geolocation: null,
    observations: '', incidents: '', photos: [],
    createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T12:00:00Z',
    siteId: 'obra-bertioga',
    template: 'wcr',
    wcr: { imoveis: [], producao: producao ?? [{ sigla: 'LA', quantidade: '3', unidade: 'UN' }] },
    ...resto,
  } as RDO
}

const obra = (id: string, cidadeId?: string): ConstructionSite =>
  ({ id, name: id, contrato: cidadeId ? { fcpCidadeId: cidadeId } : undefined }) as ConstructionSite

const plano: PlanoFcp = {
  id: 'p1', nome: 'FCP', status: 'rascunho',
  premissas: BERTIOGA_SANTOS,
  realizado: {},
  criadoEm: '2026-08-24T00:00:00Z',
} as PlanoFcp

// ─────────────────────────────────────────────────────────────────────────────

test('só obra com cidade declarada alimenta o FCP', () => {
  const v = vinculosDeObra([obra('a', 'bertioga'), obra('b'), obra('c', 'santos')])
  assert.deepEqual(v, [{ siteId: 'a', cidadeId: 'bertioga' }, { siteId: 'c', cidadeId: 'santos' }])
})

test('⚠️ rascunho NÃO conta', () => {
  assert.equal(ehWcrFinalizado(rdoWcr({ status: 'finalizado' })), true)
  assert.equal(ehWcrFinalizado(rdoWcr({ status: 'rascunho' })), false)
  // RDO legado sem status é finalizado, como o resto do módulo entende.
  assert.equal(ehWcrFinalizado(rdoWcr({})), true)
})

test('RDO de outro template não entra', () => {
  assert.equal(ehWcrFinalizado(rdoWcr({ template: 'compizzo', wcr: undefined })), false)
})

test('⚠️ o mesmo RDO duas vezes na lista não dobra a produção', () => {
  const r = rdoWcr({ id: 'igual' })
  const achados = rdosDaSemana([r, r, r], ['obra-bertioga'], SEMANA_2)
  assert.equal(achados.length, 1)
})

test('RDO fora da semana não entra', () => {
  const dentro = rdoWcr({ id: 'a', date: '2026-09-06' })
  const fora   = rdoWcr({ id: 'b', date: '2026-09-07' })
  const antes  = rdoWcr({ id: 'c', date: '2026-08-30' })
  const r = rdosDaSemana([dentro, fora, antes], ['obra-bertioga'], SEMANA_2)
  assert.deepEqual(r.map((x) => x.id), ['a'])
})

test('RDO de outra obra não entra', () => {
  const outro = rdoWcr({ id: 'x', siteId: 'obra-santos' })
  assert.equal(rdosDaSemana([outro], ['obra-bertioga'], SEMANA_2).length, 0)
})

test('RDO sem obra não entra — não dá para saber a cidade', () => {
  assert.equal(rdosDaSemana([rdoWcr({ siteId: null })], ['obra-bertioga'], SEMANA_2).length, 0)
})

test('⚠️ metro NÃO entra na contagem de serviços', () => {
  const r = rdoWcr({
    producao: [
      { sigla: 'LA', quantidade: '3', unidade: 'UN' },
      { sigla: 'PV', quantidade: '2', unidade: 'UN' },
      { sigla: 'PRA', quantidade: '120', unidade: 'M' },
      { sigla: 'PRE', quantidade: '80', unidade: 'M' },
    ],
  })
  const p = producaoDosRdos([r])
  assert.equal(p.unidades, 5, 'só LA + PV')
  assert.equal(p.metros, 200, 'os metros voltam à parte')
})

test('⚠️ sigla sem número conta como "sem medida", não como zero', () => {
  const r = rdoWcr({
    producao: [
      { sigla: 'LA', quantidade: '3', unidade: 'UN' },
      { sigla: 'PV', quantidade: '', unidade: 'UN' },
      { sigla: 'CI', quantidade: '', unidade: 'UN' },
    ],
  })
  const p = producaoDosRdos([r])
  assert.equal(p.unidades, 3)
  assert.equal(p.semMedida, 2)
})

test('dois RDOs na mesma semana SOMAM', () => {
  const a = rdoWcr({ id: 'a', date: '2026-08-31', producao: [{ sigla: 'LA', quantidade: '3', unidade: 'UN' }] })
  const b = rdoWcr({ id: 'b', date: '2026-09-02', producao: [{ sigla: 'LE', quantidade: '4', unidade: 'UN' }] })
  const achados = rdosDaSemana([a, b], ['obra-bertioga'], SEMANA_2)
  assert.equal(producaoDosRdos(achados).unidades, 7)
})

test('quantidade em pt-BR na produção', () => {
  const r = rdoWcr({ producao: [{ sigla: 'LA', quantidade: '1.234', unidade: 'UN' }] })
  assert.equal(producaoDosRdos([r]).unidades, 1234)
})

// ─── divergências ────────────────────────────────────────────────────────────

const previsto = () => 96.7

test('semana SEM RDO não vira divergência', () => {
  const d = divergenciasDoPlano(plano, [], [{ siteId: 'obra-bertioga', cidadeId: 'bertioga' }], [SEMANA_2], previsto)
  assert.deepEqual(d, [], 'ausência de apontamento não é divergência — adotar zero seria o erro')
})

test('cidade sem obra vinculada é pulada', () => {
  const d = divergenciasDoPlano(plano, [rdoWcr({})], [], [SEMANA_2], previsto)
  assert.deepEqual(d, [])
})

test('divergência compara com o PREVISTO quando nada foi lançado', () => {
  const r = rdoWcr({ producao: [{ sigla: 'LA', quantidade: '100', unidade: 'UN' }] })
  const d = divergenciasDoPlano(plano, [r], [{ siteId: 'obra-bertioga', cidadeId: 'bertioga' }], [SEMANA_2], previsto)
  assert.equal(d.length, 1)
  assert.equal(d[0].dosRdos, 100)
  assert.equal(d[0].noPlano, undefined)
  assert.ok(Math.abs(d[0].diferenca - 3.3) < 0.001, 'compara com o previsto de 96,7')
})

test('divergência compara com o LANÇADO quando já existe', () => {
  const comLancado = { ...plano, realizado: { bertioga: { 2: 90 } } } as PlanoFcp
  const r = rdoWcr({ producao: [{ sigla: 'LA', quantidade: '100', unidade: 'UN' }] })
  const d = divergenciasDoPlano(comLancado, [r], [{ siteId: 'obra-bertioga', cidadeId: 'bertioga' }], [SEMANA_2], previsto)
  assert.equal(d[0].noPlano, 90)
  assert.equal(d[0].diferenca, 10)
})

test('a divergência carrega os metros e o sem-medida para a tela', () => {
  const r = rdoWcr({
    producao: [
      { sigla: 'LA', quantidade: '10', unidade: 'UN' },
      { sigla: 'PRA', quantidade: '55', unidade: 'M' },
      { sigla: 'CI', quantidade: '', unidade: 'UN' },
    ],
  })
  const d = divergenciasDoPlano(plano, [r], [{ siteId: 'obra-bertioga', cidadeId: 'bertioga' }], [SEMANA_2], previsto)
  assert.equal(d[0].metros, 55)
  assert.equal(d[0].semMedida, 1)
  assert.equal(d[0].rdos, 1)
})
