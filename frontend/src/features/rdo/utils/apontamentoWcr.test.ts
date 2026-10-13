import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseApontamentoWcr,
  quantidadeDeTexto,
  completarAno,
  resumirApontamento,
  normalizarChave,
  SIGLAS_WCR,
  limitarTextoOriginal,
  LIMITE_TEXTO_ORIGINAL,
} from './apontamentoWcr.ts'

/** O apontamento REAL que o cliente mandou, letra por letra — inclusive os espaços sobrando. */
const APONTAMENTO_REAL = `📋 APONTAMENTO DIÁRIO — MODELO

Produção - 31/08
Equipe - Gilvan 
Núcleo - Boi Malhado
Imóvel - rua santa rosa de sul 
Imóvel - Rua  Santa Rosa do Tocantins 
Imóvel - rua um 

SERVIÇO ÁGUA
PRA - 
LA - 
LIA - 
Caixa UMA - 
HM - 100
Interligação - 
Válvula - 

SERVIÇO ESGOTO
PRE - 
LE - 
LIE - 
PV - 
PI - 
CI - 

obs: qualquer coisa fora da lista escreve aqui


━━━━━━━━━━━━━━━`

const HOJE = '2026-09-04'

// ─────────────────────────────────────────────────────────────────────────────
// O arquivo real, de ponta a ponta
// ─────────────────────────────────────────────────────────────────────────────

test('lê o apontamento real do cliente', () => {
  const a = parseApontamentoWcr(APONTAMENTO_REAL, { hoje: HOJE })
  assert.equal(a.data, '2026-08-31')
  assert.equal(a.equipe, 'Gilvan')
  assert.equal(a.nucleo, 'Boi Malhado')
  assert.equal(a.observacoes, 'qualquer coisa fora da lista escreve aqui')
})

test('as 13 siglas aparecem, mesmo as vazias', () => {
  const a = parseApontamentoWcr(APONTAMENTO_REAL, { hoje: HOJE })
  assert.equal(a.linhas.length, 13)
  const siglas = a.linhas.map((l) => l.sigla).sort()
  assert.deepEqual(siglas, SIGLAS_WCR.map((s) => s.sigla).sort())
})

test('⚠️ campo vazio é AUSENTE — nenhuma linha vira zero', () => {
  const a = parseApontamentoWcr(APONTAMENTO_REAL, { hoje: HOJE })
  const zeros = a.linhas.filter((l) => l.quantidade === 0)
  assert.deepEqual(zeros, [], 'nenhuma sigla vazia pode virar 0')

  const comNumero = a.linhas.filter((l) => l.quantidade !== undefined)
  assert.equal(comNumero.length, 1)
  assert.equal(comNumero[0].sigla, 'HM')
  assert.equal(comNumero[0].quantidade, 100)
})

test('⚠️ "Imóvel" repete e TODOS contam', () => {
  const a = parseApontamentoWcr(APONTAMENTO_REAL, { hoje: HOJE })
  assert.equal(a.imoveis.length, 3)
  assert.deepEqual(a.imoveis, [
    'rua santa rosa de sul',
    'Rua  Santa Rosa do Tocantins',
    'rua um',
  ])
})

test('o título com emoji e a linha de traços não viram campo nem ruído', () => {
  const a = parseApontamentoWcr(APONTAMENTO_REAL, { hoje: HOJE })
  assert.deepEqual(a.naoEntendidas, [], 'o apontamento padrão tem de ser lido inteiro')
})

test('HM sai como unidade e PRA como metro', () => {
  const a = parseApontamentoWcr(APONTAMENTO_REAL, { hoje: HOJE })
  assert.equal(a.linhas.find((l) => l.sigla === 'HM')?.unidade, 'UN')
  assert.equal(a.linhas.find((l) => l.sigla === 'PRA')?.unidade, 'M')
  assert.equal(a.linhas.find((l) => l.sigla === 'PRE')?.unidade, 'M')
})

// ─────────────────────────────────────────────────────────────────────────────
// A data sem ano
// ─────────────────────────────────────────────────────────────────────────────

test('data sem ano assume o ano corrente e AVISA que inferiu', () => {
  const a = parseApontamentoWcr('Produção - 31/08', { hoje: '2026-09-04' })
  assert.equal(a.data, '2026-08-31')
  assert.equal(a.anoInferido, true)
  assert.equal(a.dataBruta, '31/08')
})

test('⚠️ virada de ano: 28/12 lançado em janeiro é do ano passado', () => {
  const a = parseApontamentoWcr('Produção - 28/12', { hoje: '2027-01-03' })
  assert.equal(a.data, '2026-12-28')
  assert.equal(a.anoInferido, true)
})

test('data COM ano não é inferida', () => {
  assert.deepEqual(completarAno('31/08/2025', '2026-09-04'), { data: '2025-08-31', inferido: false })
  assert.deepEqual(completarAno('31/08/25', '2026-09-04'), { data: '2025-08-31', inferido: false })
})

test('data impossível não vira data', () => {
  assert.equal(completarAno('31/13', '2026-09-04').data, undefined)
  assert.equal(completarAno('banana', '2026-09-04').data, undefined)
})

test('data que o parser não entende vai para naoEntendidas', () => {
  const a = parseApontamentoWcr('Produção - ontem', { hoje: HOJE })
  assert.equal(a.data, undefined)
  assert.equal(a.naoEntendidas.length, 1)
})

// ─────────────────────────────────────────────────────────────────────────────
// Números em português
// ─────────────────────────────────────────────────────────────────────────────

test('quantidade em pt-BR', () => {
  assert.equal(quantidadeDeTexto('100'), 100)
  assert.equal(quantidadeDeTexto('1.234'), 1234)
  assert.equal(quantidadeDeTexto('12,5'), 12.5)
  assert.equal(quantidadeDeTexto('1.234,50'), 1234.5)
  assert.equal(quantidadeDeTexto(' 7 '), 7)
})

test('⚠️ vazio e texto NÃO viram zero', () => {
  assert.equal(quantidadeDeTexto(''), undefined)
  assert.equal(quantidadeDeTexto('   '), undefined)
  assert.equal(quantidadeDeTexto('não fez'), undefined)
  assert.equal(quantidadeDeTexto('-'), undefined)
})

test('zero escrito de propósito CONTINUA sendo zero', () => {
  // "fizemos zero" é uma afirmação; vazio não é. A diferença importa.
  assert.equal(quantidadeDeTexto('0'), 0)
  const a = parseApontamentoWcr('SERVIÇO ÁGUA\nLA - 0', { hoje: HOJE })
  assert.equal(a.linhas[0].quantidade, 0)
})

// ─────────────────────────────────────────────────────────────────────────────
// Separadores e variações de escrita
// ─────────────────────────────────────────────────────────────────────────────

test('aceita ":" além de " - "', () => {
  const a = parseApontamentoWcr('Equipe: Gilvan\nNúcleo: Boi Malhado', { hoje: HOJE })
  assert.equal(a.equipe, 'Gilvan')
  assert.equal(a.nucleo, 'Boi Malhado')
})

test('endereço com traço no meio não é cortado', () => {
  const a = parseApontamentoWcr('Imóvel - Rua X - Fundos', { hoje: HOJE })
  assert.deepEqual(a.imoveis, ['Rua X - Fundos'])
})

test('sem acento e em caixa alta continua casando', () => {
  const a = parseApontamentoWcr('SERVICO AGUA\nVALVULA - 3\nINTERLIGACAO - 2', { hoje: HOJE })
  assert.equal(a.linhas.length, 2)
  assert.equal(a.linhas.find((l) => l.sigla === 'Válvula')?.quantidade, 3)
  assert.equal(a.linhas.find((l) => l.sigla === 'Interligação')?.quantidade, 2)
})

test('"Caixa UMA" tem espaço no nome e mesmo assim casa', () => {
  const a = parseApontamentoWcr('Caixa UMA - 4', { hoje: HOJE })
  assert.equal(a.linhas[0].sigla, 'Caixa UMA')
  assert.equal(a.linhas[0].quantidade, 4)
})

test('a sigla manda no bloco, não a seção escrita errada', () => {
  // "LE" é esgoto mesmo aparecendo sob o cabeçalho de água.
  const a = parseApontamentoWcr('SERVIÇO ÁGUA\nLE - 2', { hoje: HOJE })
  assert.equal(a.linhas[0].bloco, 'esgoto')
})

test('linha desconhecida aparece em naoEntendidas, não some', () => {
  const a = parseApontamentoWcr('Produção - 31/08\nGuindaste - 2', { hoje: HOJE })
  assert.deepEqual(a.naoEntendidas, ['Guindaste - 2'])
})

test('observação de várias linhas é preservada', () => {
  const a = parseApontamentoWcr('obs: primeira\nsegunda linha\nterceira', { hoje: HOJE })
  assert.equal(a.observacoes, 'primeira\nsegunda linha\nterceira')
})

test('texto vazio não quebra', () => {
  const a = parseApontamentoWcr('', { hoje: HOJE })
  assert.deepEqual(a.linhas, [])
  assert.deepEqual(a.imoveis, [])
  assert.equal(a.anoInferido, false)
})

// ─────────────────────────────────────────────────────────────────────────────
// O resumo — onde metro e unidade NÃO se somam
// ─────────────────────────────────────────────────────────────────────────────

test('⚠️ metro e unidade não entram na mesma conta', () => {
  const a = parseApontamentoWcr(
    'SERVIÇO ÁGUA\nPRA - 120\nLA - 3\nSERVIÇO ESGOTO\nPRE - 80\nPV - 2\nCI - ',
    { hoje: HOJE },
  )
  const r = resumirApontamento(a)
  assert.equal(r.metros, 200)     // 120 + 80
  assert.equal(r.unidades, 5)     // 3 + 2
  assert.equal(r.semMedida, 1)    // o CI vazio
})

test('resumo do apontamento real: só o HM conta', () => {
  const r = resumirApontamento(parseApontamentoWcr(APONTAMENTO_REAL, { hoje: HOJE }))
  assert.equal(r.unidades, 100)
  assert.equal(r.metros, 0)
  assert.equal(r.semMedida, 12)
})

test('normalizarChave tira acento e caixa', () => {
  assert.equal(normalizarChave('  Válvula  '), 'valvula')
  assert.equal(normalizarChave('Interligação'), 'interligacao')
  assert.equal(normalizarChave('Caixa  UMA'), 'caixa uma')
})

test('⚠️ texto colado gigante é cortado antes de virar campo do RDO', () => {
  const enorme = 'x'.repeat(LIMITE_TEXTO_ORIGINAL + 500)
  const cortado = limitarTextoOriginal(enorme)
  assert.ok(cortado.length < enorme.length)
  assert.match(cortado, /texto cortado/)
  // o tamanho normal passa intacto
  assert.equal(limitarTextoOriginal('Produção - 31/08'), 'Produção - 31/08')
})
