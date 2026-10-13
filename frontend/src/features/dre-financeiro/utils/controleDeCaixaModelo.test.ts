/**
 * O modelo que o sistema gera, lido pelo próprio sistema.
 *
 * ⚠️ Estes testes fazem a **ida e volta de verdade**: montam a planilha, serializam em .xlsx,
 * leem o arquivo de novo e conferem o que sobreviveu. Testar só a matriz em memória deixaria
 * passar tudo que se perde na serialização — que é onde data e número costumam quebrar.
 *
 * O contrato que eles travam é o mais importante do módulo: **o que o sistema escreve, o sistema
 * lê**. Se o gerador e o leitor discordarem, o cliente baixa o modelo, preenche e a importação
 * recusa o próprio arquivo do sistema.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import {
  montarPlanilhaModelo, COLUNAS_LANCAMENTOS, fimDeSemanaDoMes, rotuloDaCategoria,
} from './controleDeCaixaModelo'
import { lerLancamentos, lerHorasExtras, type Matriz } from './controleDeCaixaPlanilha'
import { conferir, lancamentoDaLinha } from './controleDeCaixaImport'
import type { FinanceiroEntry } from '@/types'

const ORG = '11111111-1111-1111-1111-111111111111'
const AGORA = '2026-08-29T12:00:00.000Z'

const entry = (p: Partial<FinanceiroEntry>): FinanceiroEntry => ({
  id: 'e1', tipo: 'saida', descricao: 'DIESEL', valor: 500, data: '2026-07-09',
  categoria: 'outro', origem: 'planilha', chavePlanilha: 'k1', createdAt: AGORA, ...p,
})

/** Serializa de verdade e lê de volta — é o que faz este teste valer. */
function idaEVolta(wb: XLSX.WorkBook, aba: string): Matriz {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const lido = XLSX.read(buf, { type: 'buffer', cellDates: true })
  return XLSX.utils.sheet_to_json(lido.Sheets[aba], { header: 1, raw: true, defval: null }) as Matriz
}

// ─── Forma do arquivo ─────────────────────────────────────────────────────────

test('o modelo tem as três abas, e a de horas extras leva o mês no nome', () => {
  const wb = montarPlanilhaModelo({ mes: 8, ano: 2026 })
  assert.deepEqual(wb.SheetNames, ['COMO USAR', 'LANÇAMENTOS', 'HORAS EXTRAS 08'])
})

test('a primeira aba é a de instruções — quem abre o arquivo pode nunca ter aberto o sistema', () => {
  const wb = montarPlanilhaModelo({ mes: 8, ano: 2026 })
  const texto = idaEVolta(wb, 'COMO USAR').flat().filter(Boolean).join(' ')
  assert.match(texto, /NÃO APAGUE nem edite a coluna ID/)
  assert.match(texto, /Nada é gravado sem você confirmar/)
  assert.match(texto, /01 A 10\/07\/2026/, 'ensina o período, que é caso real da planilha')
  assert.match(texto, /PESSOA F\/PESSOA A/, 'ensina o multi-solicitante')
  assert.match(texto, /valor NÃO é deduzido do cargo/)
})

test('⚠️ o cabeçalho gerado é o que o leitor reconhece — senão o sistema recusa o próprio arquivo', () => {
  const wb = montarPlanilhaModelo({ mes: 8, ano: 2026, entries: [entry({})] })
  const m = idaEVolta(wb, 'LANÇAMENTOS')
  assert.deepEqual(m[0], [...COLUNAS_LANCAMENTOS])

  const r = lerLancamentos(m)
  assert.equal(r.problemas.length, 0, 'o leitor entende o cabeçalho do gerador')
  assert.equal(r.lancamentos.length, 1)
})

// ─── A ida e volta ────────────────────────────────────────────────────────────

test('O CONTRATO: exportar e reimportar não muda nada — tudo INALTERADO', () => {
  const entries = [
    entry({ id: 'a', tipo: 'entrada', descricao: 'MEDIÇÃO 1', valor: 20000, data: '2026-07-06', categoria: 'medicao', chavePlanilha: 'ka' }),
    entry({ id: 'b', descricao: 'ÁGUA BICA', valor: 1000, data: '2026-07-07', solicitantes: ['PESSOA I'], conferido: true, chavePlanilha: 'kb' }),
    entry({ id: 'c', descricao: 'DIESEL - MÁQUINA', valor: 800.55, data: '2026-07-09', categoria: 'materiais', solicitantes: ['PESSOA C'], chavePlanilha: 'kc' }),
  ]
  const m = idaEVolta(montarPlanilhaModelo({ mes: 7, ano: 2026, entries }), 'LANÇAMENTOS')
  const leitura = lerLancamentos(m)
  const c = conferir(leitura.lancamentos, entries, leitura.problemas, ORG, {
    agora: AGORA, totaisDeclarados: leitura.totaisDeclarados,
  })

  assert.equal(leitura.problemas.length, 0)
  assert.equal(c.resumo.inalterado, 3, 'nada mudou na ida e volta')
  assert.equal(c.resumo.novo, 0)
  assert.equal(c.resumo['valor-alterado'], 0)
  assert.equal(c.resumo['cadastro-alterado'], 0)
  assert.equal(c.ausentes.length, 0)
})

test('o ID sobrevive à ida e volta, e é ele que casa — não a heurística', () => {
  const e = entry({ id: 'id-que-tem-de-voltar', descricao: 'DIESEL' })
  const m = idaEVolta(montarPlanilhaModelo({ mes: 7, ano: 2026, entries: [e] }), 'LANÇAMENTOS')
  const l = lerLancamentos(m).lancamentos[0]
  assert.equal(l.idExterno, 'id-que-tem-de-voltar')
  assert.equal(lancamentoDaLinha(l, ORG, { agora: AGORA }).id, 'id-que-tem-de-voltar')
})

test('centavos sobrevivem à serialização', () => {
  const m = idaEVolta(montarPlanilhaModelo({ mes: 7, ano: 2026, entries: [entry({ valor: 1234.56 })] }), 'LANÇAMENTOS')
  assert.equal(lerLancamentos(m).lancamentos[0].valor, 1234.56)
})

test('a data volta como a mesma data — sem escorregar um dia', () => {
  // O clássico: dd/mm/yyyy virando mm/dd/yyyy, ou o fuso comendo um dia na virada.
  const m = idaEVolta(montarPlanilhaModelo({ mes: 7, ano: 2026, entries: [entry({ data: '2026-07-09' })] }), 'LANÇAMENTOS')
  assert.equal(lerLancamentos(m).lancamentos[0].data, '2026-07-09')
})

test('o PERÍODO volta como período — "01 A 10/07/2026" é gerado e relido', () => {
  const e = entry({ data: '2026-07-01', dataFim: '2026-07-10', descricao: 'DEPÓSITO JK' })
  const m = idaEVolta(montarPlanilhaModelo({ mes: 7, ano: 2026, entries: [e] }), 'LANÇAMENTOS')
  const l = lerLancamentos(m).lancamentos[0]
  assert.equal(l.data, '2026-07-01')
  assert.equal(l.dataFim, '2026-07-10')
})

test('os multi-solicitantes voltam separados', () => {
  const e = entry({ solicitantes: ['PESSOA F', 'PESSOA A'] })
  const m = idaEVolta(montarPlanilhaModelo({ mes: 7, ano: 2026, entries: [e] }), 'LANÇAMENTOS')
  assert.deepEqual(lerLancamentos(m).lancamentos[0].solicitantes, ['PESSOA F', 'PESSOA A'])
})

test('o "Conferido" volta como conferido', () => {
  const m = idaEVolta(montarPlanilhaModelo({ mes: 7, ano: 2026, entries: [entry({ conferido: true })] }), 'LANÇAMENTOS')
  assert.equal(lerLancamentos(m).lancamentos[0].conferido, true)
})

test('a linha de SALDO gerada não vira lançamento na volta', () => {
  const entries = [
    entry({ id: 'a', tipo: 'entrada', descricao: 'MEDIÇÃO', valor: 5000, chavePlanilha: 'ka' }),
    entry({ id: 'b', descricao: 'DIESEL', valor: 800, chavePlanilha: 'kb' }),
  ]
  const m = idaEVolta(montarPlanilhaModelo({ mes: 7, ano: 2026, entries }), 'LANÇAMENTOS')
  const r = lerLancamentos(m)
  assert.equal(r.lancamentos.length, 2, 'só os dois lançamentos, sem a linha de fechamento')
  assert.equal(r.totaisDeclarados?.receitas, 5000)
  assert.equal(r.totaisDeclarados?.despesas, 800)
  assert.equal(r.totaisDeclarados?.saldo, 4200)
})

test('as linhas em branco do fim não viram lançamento vazio', () => {
  // O modelo sai com 40 linhas livres para a equipe preencher. Se virassem lançamento, cada
  // importação criaria 40 despesas de R$ 0,00.
  const m = idaEVolta(montarPlanilhaModelo({ mes: 7, ano: 2026, entries: [entry({})] }), 'LANÇAMENTOS')
  const r = lerLancamentos(m)
  assert.equal(r.lancamentos.length, 1)
  assert.equal(r.problemas.length, 0)
})

test('o modelo em BRANCO é lido sem erro e sem lançamento nenhum', () => {
  const m = idaEVolta(montarPlanilhaModelo({ mes: 8, ano: 2026 }), 'LANÇAMENTOS')
  const r = lerLancamentos(m)
  assert.equal(r.lancamentos.length, 0)
  assert.equal(r.problemas.length, 0, 'planilha vazia não é planilha com problema')
})

// ─── Horas extras ─────────────────────────────────────────────────────────────

test('a grade sai com os fins de semana do mês — que é quando a hora extra acontece', () => {
  // Agosto de 2026 começa num sábado.
  assert.deepEqual(fimDeSemanaDoMes(8, 2026), [1, 2, 8, 9, 15, 16, 22, 23, 29, 30])
  // Fevereiro de 2026 (28 dias, começa num domingo).
  assert.deepEqual(fimDeSemanaDoMes(2, 2026), [1, 7, 8, 14, 15, 21, 22, 28])
})

test('a grade gerada é lida de volta pelo leitor de horas extras', () => {
  const wb = montarPlanilhaModelo({
    mes: 8, ano: 2026,
    pessoas: [{ nome: 'PESSOA O GOMES', cargo: 'AJUDANTE GERAL I' }, { nome: 'ALINE SANTOS', cargo: 'AUXILIAR II' }],
  })
  const m = idaEVolta(wb, 'HORAS EXTRAS 08')
  assert.equal(m[0][0], 'NOME')
  assert.equal(m[0][1], 'Cargo')

  const r = lerHorasExtras(m, { mes: 8, ano: 2026, nomeDaAba: 'HORAS EXTRAS 08' })
  assert.equal(r.problemas.length, 0)
  assert.deepEqual(r.dias, [1, 2, 8, 9, 15, 16, 22, 23, 29, 30], 'os dez dias viram coluna')
  assert.equal(r.registros.length, 0, 'grade em branco não inventa hora extra')
})

test('a coluna de observação da grade nomeia os dois primeiros dias, como no arquivo do cliente', () => {
  const m = idaEVolta(montarPlanilhaModelo({ mes: 8, ano: 2026 }), 'HORAS EXTRAS 08')
  assert.equal(m[0][4], 'OBS. DIAS 01 E 02')
})

test('as pessoas do quadro já vêm na grade, em ordem alfabética', () => {
  const wb = montarPlanilhaModelo({
    mes: 8, ano: 2026,
    pessoas: [{ nome: 'ZEBEDEU', cargo: 'PEDREIRO I' }, { nome: 'ALINE', cargo: 'AUXILIAR' }],
  })
  const m = idaEVolta(wb, 'HORAS EXTRAS 08')
  assert.equal(m[1][0], 'ALINE')
  assert.equal(m[2][0], 'ZEBEDEU')
})

test('preencher a grade gerada e reler produz a hora extra certa', () => {
  const wb = montarPlanilhaModelo({ mes: 8, ano: 2026, pessoas: [{ nome: 'PESSOA O GOMES', cargo: 'AJUDANTE GERAL I' }] })
  const m = idaEVolta(wb, 'HORAS EXTRAS 08')
  m[1][2] = 300      // dia 01
  m[1][4] = 'PG'     // a coluna de observação
  const r = lerHorasExtras(m, { mes: 8, ano: 2026, nomeDaAba: 'HORAS EXTRAS 08' })
  assert.equal(r.registros.length, 1)
  assert.equal(r.registros[0].data, '2026-08-01')
  assert.equal(r.registros[0].valor, 300)
  assert.equal(r.registros[0].pago, true)
})

test('o rótulo de categoria é legível na planilha, e o desconhecido não vira vazio', () => {
  assert.equal(rotuloDaCategoria('mao_de_obra'), 'Mão de obra')
  assert.equal(rotuloDaCategoria('outro'), 'Outro')
  assert.equal(rotuloDaCategoria(undefined), '')
  assert.equal(rotuloDaCategoria('inventada'), 'inventada')
})
