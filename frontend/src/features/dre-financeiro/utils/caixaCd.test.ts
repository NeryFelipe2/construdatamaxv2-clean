/**
 * A ponte entre o motor de caixa do pacote e o banco do ConstruData.
 *
 * Cada teste é um defeito que o importador antigo do ConstruData tinha de verdade
 * (ImportarCaixaModal + planilhaCaixa + diff.ts, até 16/09/2026). Se um destes voltar a falhar,
 * o defeito voltou.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lerLancamentos, type Matriz } from './controleDeCaixaPlanilha'
import {
  conferirCd, linhasCdAGravar, paraGravar, obraConfere,
  type ContextoCd, type LancamentoCd,
} from './caixaCd'
import { categoriaPorDescricao } from '../components/importador/planilhaCaixa'

const CATEGORIAS = [
  'Combustível', 'Transporte/Uber', 'Materiais', 'Manutenção de veículo', 'Alimentação/VR',
  'Hora extra', 'Outros', 'Medição', 'Adiantamento',
].map((nome, i) => ({ id: `cat-${i}`, nome, tipo: 'DESPESA' }))

const CTX: ContextoCd = {
  projetoId: '22222222-2222-4222-8222-222222222222',
  nomeProjeto: 'WCR — Boi Malhado',
  categorias: CATEGORIAS,
  agora: '2026-09-16T12:00:00.000Z',
  colunasDeImportacao: true,
}

const CAB: Matriz = [
  ['RECEITAS', null, 'DESPESAS', null, null, null, null],
  ['ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', 'CONFERIDO'],
]
const d = (s: string) => new Date(`${s}T00:00:00`)

function importar(m: Matriz, banco: LancamentoCd[] = [], ctx: ContextoCd = CTX) {
  return conferirCd(lerLancamentos(m), m, banco, ctx, categoriaPorDescricao)
}

/** O que o "confirmar" deixaria no banco, já no formato em que o importador relê. */
function gravar(c: ReturnType<typeof importar>, banco: LancamentoCd[] = [], ctx: ContextoCd = CTX): LancamentoCd[] {
  const novos = linhasCdAGravar(c).map((l) => {
    const g = paraGravar(l, ctx)
    return {
      ...g,
      created_at: ctx.agora,
      deleted_at: null,
      chave_importacao: ctx.colunasDeImportacao ? g.chave_importacao : null,
      solicitantes_texto: ctx.colunasDeImportacao ? g.solicitantes_texto : null,
    }
  })
  const ids = new Set(novos.map((n) => n.id))
  return [...banco.filter((b) => !ids.has(b.id)), ...novos]
}

test('dois Ubers idênticos no mesmo dia são DOIS lançamentos — e reimportar não duplica', () => {
  // Antigo: chave obra|data|descrição sem ordem → o segundo sobrescrevia o primeiro no diff.
  const m: Matriz = [...CAB,
    [null, null, 'UBER EQUIPE - CANTEIRO', 35.9, d('2026-07-17'), 'PESSOA B', null],
    [null, null, 'UBER EQUIPE - CANTEIRO', 35.9, d('2026-07-17'), 'PESSOA B', null],
  ]
  const c1 = importar(m)
  assert.equal(c1.resumo.novo, 2)
  assert.notEqual(c1.linhas[0].id, c1.linhas[1].id)

  const banco = gravar(c1)
  assert.equal(banco.length, 2)
  const c2 = importar(m, banco)
  assert.equal(c2.resumo.inalterado, 2)
  assert.equal(linhasCdAGravar(c2).length, 0)
})

test('receita na mesma linha da despesa não herda categoria, status nem descrição da vizinha', () => {
  // Antigo: planilhaCaixa.ts:315-319 dava à receita a categoria/obra/status da despesa.
  const m: Matriz = [...CAB,
    [2000, d('2026-07-06'), 'CONSERTO DE 2 PNEUS DA RETRO', 1000, d('2026-07-06'), 'PESSOA P', 'PG'],
  ]
  const c = importar(m)
  const receita = c.linhas.find((l) => l.lida.tipo === 'receita')!
  const despesa = c.linhas.find((l) => l.lida.tipo === 'despesa')!
  assert.equal(receita.categoriaNome, 'Medição')
  assert.equal(receita.status, 'pendente')
  assert.notEqual(receita.lida.descricao, despesa.lida.descricao)
  assert.equal(despesa.categoriaNome, 'Manutenção de veículo', 'deduzida da descrição')
  assert.equal(despesa.status, 'pago', 'PG é pago, não só conferido')
})

test('arquivo sem coluna OBRA grava na obra selecionada (antes: projeto_id nulo e a linha sumia)', () => {
  const m: Matriz = [...CAB, [null, null, 'DIESEL - MÁQUINA', 800, d('2026-07-09'), 'PESSOA C', null]]
  const [l] = linhasCdAGravar(importar(m))
  const g = paraGravar(l, CTX)
  assert.equal(g.projeto_id, CTX.projetoId)
  assert.equal(g.obra_texto, 'WCR — Boi Malhado')
  assert.equal(g.categoria_nome, 'Combustível')
})

test('coluna OBRA de outra obra bloqueia a linha; o nome curto da obra certa passa', () => {
  assert.equal(obraConfere('BOI MALHADO', 'WCR — Boi Malhado'), true)
  assert.equal(obraConfere('wcr - boi malhado', 'WCR — Boi Malhado'), true)
  assert.equal(obraConfere(undefined, 'WCR — Boi Malhado'), true)
  assert.equal(obraConfere('SAKURA', 'WCR — Boi Malhado'), false)

  const cab: Matriz = [CAB[0], [...CAB[1], 'OBRA']]
  const m: Matriz = [...cab, [null, null, 'DIESEL', 800, d('2026-07-09'), 'PESSOA C', null, 'SAKURA']]
  const c = importar(m)
  assert.equal(c.linhas[0].problemasCd.some((p) => p.bloqueia), true)
  assert.equal(linhasCdAGravar(c).length, 0)
})

test('importar agosto com julho no banco: julho não "some" e nada duplica', () => {
  // Antigo: o diff olhava só o mês da tela; importar outro mês recriava tudo.
  const julho: Matriz = [...CAB, [null, null, 'ÁGUA BICA', 1000, d('2026-07-07'), 'PESSOA I', null]]
  const banco = gravar(importar(julho))
  const agosto: Matriz = [...CAB,
    [null, null, 'ÁGUA BICA', 1000, d('2026-08-07'), 'PESSOA I', null],
  ]
  const c = importar(agosto, banco)
  assert.equal(c.resumo.novo, 1, 'a água de agosto é outra conta')
  assert.equal(c.ausentes.length, 0, 'julho está fora do período do arquivo')
  // E reimportar julho com agosto já gravado continua sem duplicar.
  const banco2 = gravar(c, banco)
  const c2 = importar(julho, banco2)
  assert.equal(c2.resumo.inalterado, 1)
  assert.equal(c2.resumo.novo, 0)
})

test('antes da migration 033: solicitante não vira "cadastro alterado" a cada reimportação', () => {
  const ctx = { ...CTX, colunasDeImportacao: false }
  const m: Matriz = [...CAB, [null, null, 'VR REF. JANTA', 1000, d('2026-07-10'), 'FELIPE RH/DAMIÃO', null]]
  const banco = gravar(importar(m, [], ctx), [], ctx)
  assert.equal(banco[0].chave_importacao, null, 'sem coluna, nada é gravado nela')
  const c = importar(m, banco, ctx)
  assert.equal(c.resumo.inalterado, 1, 'o id determinístico casa mesmo sem a coluna de chave')
})

test('trocar PG por "Conferido" é mudança de status (pago → conferido), não linha nova', () => {
  const pg: Matriz = [...CAB, [null, null, 'DIESEL', 800, d('2026-07-09'), 'PESSOA C', 'PG']]
  const banco = gravar(importar(pg))
  const conf: Matriz = [...CAB, [null, null, 'DIESEL', 800, d('2026-07-09'), 'PESSOA C', 'Conferido']]
  const c = importar(conf, banco)
  assert.equal(c.resumo['cadastro-alterado'], 1)
  assert.deepEqual(c.linhas[0].mudancas.map((x) => [x.campo, x.antes, x.depois]), [['status', 'pago', 'conferido']])
})

test('lançamento excluído no sistema não é ressuscitado pela planilha', () => {
  const m: Matriz = [...CAB, [null, null, 'DIESEL', 800, d('2026-07-09'), 'PESSOA C', null]]
  const banco = gravar(importar(m)).map((b) => ({ ...b, deleted_at: '2026-09-01T10:00:00Z' }))
  const c = importar(m, banco)
  assert.equal(c.linhas[0].problemasCd.some((p) => p.bloqueia && /excluído/.test(p.mensagem)), true)
  assert.equal(linhasCdAGravar(c).length, 0)
})

test('categoria escrita e não cadastrada é apontada, não bloqueia; a reclassificada no sistema aparece como mudança', () => {
  const cab: Matriz = [CAB[0], [...CAB[1], 'CATEGORIA']]
  const m: Matriz = [...cab, [null, null, 'LOCAÇÃO DE BANHEIRO', 450, d('2026-07-11'), 'PESSOA C', null, 'Locação']]
  const c = importar(m)
  assert.equal(c.linhas[0].categoriaNova, true)
  assert.equal(c.linhas[0].problemasCd.some((p) => p.bloqueia), false)

  const banco = gravar(c).map((b) => ({ ...b, categoria_nome: 'Outros' }))
  const c2 = importar(m, banco)
  assert.equal(c2.resumo['cadastro-alterado'], 1)
  assert.equal(c2.linhas[0].mudancas[0].campo, 'categoria')
})

test('rodapé que bate também é mostrado (não só o que diverge)', () => {
  const m: Matriz = [...CAB,
    [null, null, 'DIESEL', 800, d('2026-07-09'), 'PESSOA C', null],
    [null, null, 'ÁGUA', 200, d('2026-07-10'), 'PESSOA C', null],
    [null, null, null, 1000, 'SALDO==>>', null, null],
  ]
  const c = importar(m)
  assert.deepEqual(c.totaisQueBateram, [{ oQue: 'Despesas', valor: 1000 }])
  assert.equal(c.divergenciaDeTotais.length, 0)
})
