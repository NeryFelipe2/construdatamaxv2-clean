/**
 * A conferência antes de gravar.
 *
 * O roteiro destes testes é o que o cliente vai fazer de verdade, na ordem em que vai fazer:
 * importar, importar de novo, mexer numa célula, acrescentar linhas, apagar uma linha. Cada passo
 * tem de dar o resultado óbvio — e o passo 2 é o que separa este motor de um que duplica tudo.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  conferir, lancamentoDaLinha, idDoLancamento, lerCategoria, linhasAGravar,
  lancamentoDaHoraExtra, horasExtrasQueViramDespesa, CATEGORIA_PADRAO,
} from './controleDeCaixaImport'
import { lerLancamentos, lerHorasExtras, type Matriz } from './controleDeCaixaPlanilha'
import type { FinanceiroEntry } from '@/types'

const ORG = '11111111-1111-1111-1111-111111111111'
const AGORA = '2026-08-29T12:00:00.000Z'
const OPC = { agora: AGORA }

const CAB: Matriz = [
  ['RECEITAS', null, 'DESPESAS', null, null, null, null],
  ['ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', 'CONFERIDO'],
]
const d = (s: string) => new Date(`${s}T00:00:00`)

/** Roda o caminho inteiro: planilha → leitura → conferência. */
function importar(linhas: Matriz, existentes: FinanceiroEntry[] = []) {
  const leitura = lerLancamentos(linhas)
  return conferir(leitura.lancamentos, existentes, leitura.problemas, ORG, {
    ...OPC, totaisDeclarados: leitura.totaisDeclarados,
  })
}

/** O que o "confirmar" gravaria. */
function gravar(c: ReturnType<typeof importar>): FinanceiroEntry[] {
  return linhasAGravar(c).map((l) => lancamentoDaLinha(l.lida, ORG, OPC))
}

const PLANILHA: Matriz = [...CAB,
  [2000, d('2026-07-06'), 'CONSERTO DE 2 PNEUS DA RETRO', 1000, d('2026-07-06'), 'PESSOA P', 'Conferido'],
  [0, null, 'ÁGUA BICA', 1000, d('2026-07-07'), 'PESSOA I', 'Conferido'],
  [0, null, 'HORA EXTRA PESSOA Q', 1000, d('2026-07-08'), 'PESSOA B', 'Conferido'],
]

// ─── O roteiro do cliente ─────────────────────────────────────────────────────

test('1ª importação: tudo é novo', () => {
  const c = importar(PLANILHA)
  assert.equal(c.resumo.novo, 4, '3 despesas + 1 receita')
  assert.equal(c.resumo.inalterado, 0)
  assert.equal(c.ausentes.length, 0)
  // ⚠️ Um aviso, e ele é esperado: a 1ª linha da fixture tem receita E despesa, e nessa forma a
  // coluna DESCRIÇÃO é da despesa — a receita fica sem descrição própria e a tela pede que se
  // preencha. Antes o leitor copiava a descrição da despesa para a receita e não avisava nada.
  assert.equal(c.problemas.length, 1)
  assert.match(c.problemas[0].motivo, /Receita sem descrição própria/)
})

test('⚠️ O TESTE QUE DECIDE — reimportar o MESMO arquivo: zero novo, zero duplicado', () => {
  // É o gesto que o cliente repete várias vezes por mês. Se isto falhar, cada importação recria
  // as 120 linhas e o caixa vira ficção.
  const primeira = gravar(importar(PLANILHA))
  const c = importar(PLANILHA, primeira)

  assert.equal(c.resumo.novo, 0, 'nada é novo na segunda vez')
  assert.equal(c.resumo.duplicado, 0)
  assert.equal(c.resumo['valor-alterado'], 0)
  assert.equal(c.resumo['cadastro-alterado'], 0)
  assert.equal(c.resumo.inalterado, 4, 'tudo inalterado')
  assert.equal(linhasAGravar(c).length, 0, 'nada a gravar — "nada mudou"')
  assert.equal(c.ausentes.length, 0)
})

test('3º passo: mudar um valor e acrescentar três linhas dá 1 alterado e 3 novos, e mais nada', () => {
  const antes = gravar(importar(PLANILHA))
  const depois: Matriz = [...CAB,
    [2000, d('2026-07-06'), 'CONSERTO DE 2 PNEUS DA RETRO', 1500, d('2026-07-06'), 'PESSOA P', 'Conferido'],
    [0, null, 'ÁGUA BICA', 1000, d('2026-07-07'), 'PESSOA I', 'Conferido'],
    [0, null, 'HORA EXTRA PESSOA Q', 1000, d('2026-07-08'), 'PESSOA B', 'Conferido'],
    [0, null, 'DIESEL - MÁQUINA', 800, d('2026-07-09'), 'PESSOA C', 'Conferido'],
    [0, null, 'MATERIAL DE LIMPEZA', 300, d('2026-07-10'), 'PESSOA C', 'Conferido'],
    [0, null, 'UBER EQUIPE', 90, d('2026-07-10'), 'PESSOA B', 'Conferido'],
  ]
  const c = importar(depois, antes)

  assert.equal(c.resumo['valor-alterado'], 1)
  assert.equal(c.resumo.novo, 3)
  assert.equal(c.resumo.inalterado, 3, 'a receita e as duas despesas que não mudaram')
  assert.equal(c.resumo['cadastro-alterado'], 0)

  const alterada = c.linhas.find((l) => l.situacao === 'valor-alterado')!
  assert.equal(alterada.mudancas[0].campo, 'valor')
  assert.equal(alterada.mudancas[0].antes, 1000, 'mostra o ANTES')
  assert.equal(alterada.mudancas[0].depois, 1500, 'e o DEPOIS')
})

test('4º passo: apagar uma linha da planilha aponta "sumiu" — e NÃO apaga', () => {
  const antes = gravar(importar(PLANILHA))
  const semAguaBica: Matriz = [...CAB,
    [2000, d('2026-07-06'), 'CONSERTO DE 2 PNEUS DA RETRO', 1000, d('2026-07-06'), 'PESSOA P', 'Conferido'],
    [0, null, 'HORA EXTRA PESSOA Q', 1000, d('2026-07-08'), 'PESSOA B', 'Conferido'],
  ]
  const c = importar(semAguaBica, antes)

  assert.equal(c.ausentes.length, 1)
  assert.equal(c.ausentes[0].entry.descricao, 'ÁGUA BICA')
  assert.match(c.ausentes[0].observacao, /Não foi apagado/)
  // A prova de que não apaga: o lançamento sumido não está em NENHUMA lista de gravação.
  assert.ok(!linhasAGravar(c).some((l) => l.lida.descricao === 'ÁGUA BICA'))
})

test('⚠️ "sumiu" é limitado ao PERÍODO do arquivo — julho não acusa agosto', () => {
  // Sem este corte, importar a planilha de julho listaria todo agosto como sumido, e a tela
  // pediria para conferir centenas de linhas que estão certas.
  const agosto: FinanceiroEntry = {
    id: 'de-agosto', tipo: 'saida', descricao: 'DESPESA DE AGOSTO', valor: 500,
    data: '2026-08-15', categoria: 'outro', origem: 'planilha', chavePlanilha: 'x', createdAt: AGORA,
  }
  const c = importar(PLANILHA, [...gravar(importar(PLANILHA)), agosto])
  assert.equal(c.ausentes.length, 0, 'agosto está fora do período do arquivo de julho')
  assert.deepEqual(c.periodo, { de: '2026-07-06', ate: '2026-07-08' })
})

test('lançamento DIGITADO NA TELA nunca aparece como "sumiu da planilha"', () => {
  // Ele não deveria estar na planilha — a tela é a via de correção. Acusá-lo seria pedir para a
  // pessoa "conferir" algo que ela criou de propósito fora do arquivo.
  const manual: FinanceiroEntry = {
    id: 'digitado', tipo: 'saida', descricao: 'CORREÇÃO MANUAL', valor: 50,
    data: '2026-07-07', categoria: 'outro', origem: 'manual', createdAt: AGORA,
  }
  const c = importar(PLANILHA, [...gravar(importar(PLANILHA)), manual])
  assert.equal(c.ausentes.length, 0)
})

// ─── Identidade ───────────────────────────────────────────────────────────────

test('o id é determinístico: a mesma linha dá sempre o mesmo id', () => {
  // É o que faz o `addEntry` (upsert por id) atualizar em vez de criar outro lançamento.
  const a = gravar(importar(PLANILHA)).map((e) => e.id)
  const b = gravar(importar(PLANILHA)).map((e) => e.id)
  assert.deepEqual(a, b)
  assert.equal(new Set(a).size, a.length, 'id repetido faria dois lançamentos virarem um')
})

test('organizações diferentes geram ids diferentes para a mesma linha', () => {
  assert.notEqual(idDoLancamento(ORG, 'x'), idDoLancamento('outra-org', 'x'))
})

test('⚠️ duas linhas IDÊNTICAS no arquivo viram DOIS lançamentos, não um', () => {
  // Caso real: as linhas 27 e 32 da planilha do cliente são iguais em tudo. São dois Ubers.
  const uber = 'UBER EQUIPE PESSOA B - MORRO DOCE PARA CANTEIRO'
  const c = importar([...CAB,
    [0, null, uber, 1000, d('2026-07-17'), 'PESSOA B', 'Conferido'],
    [0, null, uber, 1000, d('2026-07-17'), 'PESSOA B', 'Conferido'],
  ])
  assert.equal(c.resumo.novo, 2)
  assert.equal(c.resumo.duplicado, 0, 'não são duplicata: são dois gastos de verdade')
  assert.equal(new Set(gravar(c).map((e) => e.id)).size, 2)
})

test('mas o mesmo ID duas vezes no arquivo É duplicata — é linha copiada do modelo', () => {
  const comId: Matriz = [
    ['ID', 'ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', 'CONFERIDO'],
    ['abc-123', 0, null, 'DIESEL', 500, d('2026-07-09'), 'PESSOA C', 'Conferido'],
    ['abc-123', 0, null, 'DIESEL', 500, d('2026-07-09'), 'PESSOA C', 'Conferido'],
  ]
  const c = importar(comId)
  assert.equal(c.resumo.novo, 1)
  assert.equal(c.resumo.duplicado, 1)
})

test('a planilha que o sistema gera casa por ID, sem heurística nenhuma', () => {
  const comId: Matriz = [
    ['ID', 'ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', 'CONFERIDO'],
    ['id-fixo-1', 0, null, 'DIESEL', 500, d('2026-07-09'), 'PESSOA C', 'Conferido'],
  ]
  const primeira = gravar(importar(comId))
  assert.equal(primeira[0].id, 'id-fixo-1', 'o ID da planilha vence o calculado')

  // Agora a pessoa muda a DESCRIÇÃO — que faria a chave por conteúdo mudar. Com ID, continua
  // sendo o MESMO lançamento, editado. Sem ID, viraria um lançamento novo e um "sumiu".
  const editada: Matriz = [
    ['ID', 'ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', 'CONFERIDO'],
    ['id-fixo-1', 0, null, 'DIESEL DA MÁQUINA DO PESSOA C', 500, d('2026-07-09'), 'PESSOA C', 'Conferido'],
  ]
  const c = importar(editada, primeira)
  assert.equal(c.resumo['cadastro-alterado'], 1)
  assert.equal(c.resumo.novo, 0)
  assert.equal(c.ausentes.length, 0)
})

// ─── Mudança de cadastro ──────────────────────────────────────────────────────

test('mudar o solicitante é "cadastro alterado", não "valor alterado"', () => {
  const antes = gravar(importar(PLANILHA))
  const c = importar([...CAB,
    [2000, d('2026-07-06'), 'CONSERTO DE 2 PNEUS DA RETRO', 1000, d('2026-07-06'), 'PESSOA P/PESSOA H', 'Conferido'],
    [0, null, 'ÁGUA BICA', 1000, d('2026-07-07'), 'PESSOA I', 'Conferido'],
    [0, null, 'HORA EXTRA PESSOA Q', 1000, d('2026-07-08'), 'PESSOA B', 'Conferido'],
  ], antes)
  // A despesa mudou de solicitante; a receita da mesma linha não tem solicitante e não muda.
  const alterada = c.linhas.find((l) => l.situacao === 'cadastro-alterado')!
  assert.equal(alterada.mudancas[0].campo, 'solicitantes')
  assert.deepEqual(alterada.mudancas[0].depois, ['PESSOA P', 'PESSOA H'])
})

test('marcar como Conferido na planilha é mudança de cadastro, e chega ao sistema', () => {
  const semConferir = [...CAB, [0, null, 'DIESEL', 500, d('2026-07-09'), 'PESSOA C', null]]
  const antes = gravar(importar(semConferir))
  assert.equal(antes[0].conferido, undefined)

  const c = importar([...CAB, [0, null, 'DIESEL', 500, d('2026-07-09'), 'PESSOA C', 'Conferido']], antes)
  assert.equal(c.resumo['cadastro-alterado'], 1)
  assert.equal(gravar(c)[0].conferido, true)
})

test('acento e caixa não criam mudança falsa', () => {
  const antes = gravar(importar([...CAB, [0, null, 'ÁGUA BICA', 100, d('2026-07-07'), 'PESSOA I', 'Conferido']]))
  // A chave normaliza, então a linha casa; e a comparação de campo também normaliza, então não
  // acusa "cadastro alterado" só porque alguém tirou o acento.
  const c = importar([...CAB, [0, null, 'AGUA BICA', 100, d('2026-07-07'), 'PESSOA I', 'Conferido']], antes)
  assert.equal(c.resumo.inalterado, 1)
  assert.equal(c.resumo.novo, 0)
})

// ─── Categoria ────────────────────────────────────────────────────────────────

test('a planilha do cliente não tem categoria: cai em "outro", que diz não-classificado', () => {
  assert.equal(lerCategoria(undefined, 'saida'), CATEGORIA_PADRAO.saida)
  assert.equal(gravar(importar(PLANILHA)).find((e) => e.tipo === 'saida')!.categoria, 'outro')
})

test('a categoria escrita na planilha é aceita em várias grafias', () => {
  assert.equal(lerCategoria('Materiais', 'saida'), 'materiais')
  assert.equal(lerCategoria('material', 'saida'), 'materiais')
  assert.equal(lerCategoria('MÃO DE OBRA', 'saida'), 'mao_de_obra')
  assert.equal(lerCategoria('Mao-de-obra', 'saida'), 'mao_de_obra')
  assert.equal(lerCategoria('Medição', 'entrada'), 'medicao')
})

test('categoria inventada não quebra nem entra: vira "outro"', () => {
  assert.equal(lerCategoria('BANANA', 'saida'), 'outro')
})

// ─── Divergência com o rodapé da planilha ─────────────────────────────────────

test('a soma que o sistema calcula é conferida contra o rodapé da planilha', () => {
  // O rodapé diz 999 de despesa, mas as linhas somam 1000. Alguém mexeu numa célula sem mexer na
  // fórmula — e é melhor descobrir agora do que na reunião.
  const c = importar([...CAB,
    [0, null, 'DIESEL', 1000, d('2026-07-09'), 'PESSOA C', 'Conferido'],
    [0, null, null, 999, 'SALDO==>>', -999, null],
  ])
  assert.equal(c.divergenciaDeTotais.length, 1)
  assert.equal(c.divergenciaDeTotais[0].oQue, 'Despesas')
  assert.equal(c.divergenciaDeTotais[0].calculado, 1000)
  assert.equal(c.divergenciaDeTotais[0].declarado, 999)
})

test('quando a soma bate, não há divergência a mostrar', () => {
  const c = importar([...CAB,
    [0, null, 'DIESEL', 1000, d('2026-07-09'), 'PESSOA C', 'Conferido'],
    [0, null, null, 1000, 'SALDO==>>', -1000, null],
  ])
  assert.deepEqual(c.divergenciaDeTotais, [])
})

// ─── Horas extras ─────────────────────────────────────────────────────────────

const HE: Matriz = [
  ['NOME', 'Cargo', '01', '02', 'OBS. DIAS 01 E 02', '08'],
  ['PESSOA O GOMES', 'AJUDANTE GERAL I', 300, 300, 'PG', null],
  ['ALINE SANTOS', 'AUXILIAR DE CADASTRO II', null, null, null, 250],
]

test('⚠️ só a hora extra PAGA vira despesa — a lançada e não paga é previsão', () => {
  // Jogar tudo no caixa faria a despesa aparecer antes de a empresa desembolsar, e o saldo do mês
  // ficaria pior do que é.
  const r = lerHorasExtras(HE, { mes: 8, ano: 2026, nomeDaAba: 'HORAS EXTRAS 08' })
  assert.equal(r.registros.length, 3)
  const viram = horasExtrasQueViramDespesa(r.registros)
  assert.equal(viram.length, 2, 'só os dois dias marcados PG')
  assert.ok(viram.every((x) => x.nome === 'PESSOA O GOMES'))
})

test('a hora extra paga vira saída de mão de obra, com o nome de quem recebeu', () => {
  const r = lerHorasExtras(HE, { mes: 8, ano: 2026 })
  const e = lancamentoDaHoraExtra(horasExtrasQueViramDespesa(r.registros)[0], ORG, OPC)
  assert.equal(e.tipo, 'saida')
  assert.equal(e.categoria, 'mao_de_obra')
  assert.equal(e.valor, 300)
  assert.equal(e.data, '2026-08-01')
  assert.equal(e.funcionarioNome, 'PESSOA O GOMES')
  assert.match(e.descricao, /PESSOA O GOMES/)
  assert.equal(e.origem, 'horas-extras')
})

test('reprocessar a mesma grade de horas extras não duplica despesa', () => {
  const r = lerHorasExtras(HE, { mes: 8, ano: 2026 })
  const pagas = horasExtrasQueViramDespesa(r.registros)
  const a = pagas.map((x) => lancamentoDaHoraExtra(x, ORG, OPC).id)
  const b = lerHorasExtras(HE, { mes: 8, ano: 2026 }).registros
    .filter((x) => x.pago).map((x) => lancamentoDaHoraExtra(x, ORG, OPC).id)
  assert.deepEqual(a, b)
  assert.equal(new Set(a).size, a.length)
})

test('hora extra e lançamento de planilha nunca colidem de id', () => {
  // São dois espaços de id diferentes de propósito: um "HORA EXTRA PESSOA Q" digitado na planilha de
  // despesas não pode virar o mesmo lançamento da grade de horas extras.
  const daPlanilha = gravar(importar(PLANILHA)).map((e) => e.id)
  const r = lerHorasExtras(HE, { mes: 8, ano: 2026 })
  const daGrade = horasExtrasQueViramDespesa(r.registros).map((x) => lancamentoDaHoraExtra(x, ORG, OPC).id)
  assert.equal(new Set([...daPlanilha, ...daGrade]).size, daPlanilha.length + daGrade.length)
})

// ─── Bordas ───────────────────────────────────────────────────────────────────

test('planilha vazia não quebra e não inventa período', () => {
  const c = importar(CAB)
  assert.equal(c.linhas.length, 0)
  assert.equal(c.periodo, null)
  assert.equal(c.ausentes.length, 0)
})

test('os problemas de leitura chegam à conferência — a pessoa vê o que foi recusado', () => {
  const c = importar([...CAB, [0, null, 'ALGO', 'muito', d('2026-07-15'), 'X', null]])
  assert.equal(c.problemas.length, 1)
  assert.equal(c.problemas[0].coluna, 'VALOR')
})

test('o inalterado NÃO é gravado — reescrever geraria linha de auditoria vazia', () => {
  const antes = gravar(importar(PLANILHA))
  const c = importar(PLANILHA, antes)
  assert.equal(c.resumo.inalterado, 4)
  assert.equal(linhasAGravar(c).length, 0)
})
