/**
 * Reimportar a planilha do FCP.
 *
 * O roteiro é o que o cliente faz: importa, mexe na planilha, importa de novo. O que estes testes
 * travam é que a segunda importação **atualiza** — e que ela não leva junto a produção que a
 * equipe lançou no meio do caminho.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conferirPlano, idDoPlano, mesclarRealizado, planoParaGravar } from './reimportarPlano'
import { BERTIOGA_SANTOS as P } from './premissasBertiogaSantos'
import type { PlanoFcp } from '@/store/fcpStore'
import type { PremissasFcp } from './tipos'

const ORG = '11111111-1111-1111-1111-111111111111'

const plano = (p: Partial<PlanoFcp> = {}): PlanoFcp => ({
  id: 'plano-1', nome: 'Fluxo Bertioga', status: 'rascunho',
  premissas: P, realizado: {}, criadoEm: '2026-08-01T00:00:00.000Z', ...p,
})

// ─── A identidade ─────────────────────────────────────────────────────────────

test('O QUE DECIDE: o mesmo arquivo dá o mesmo id — reimportar não cria outro plano', () => {
  assert.equal(
    idDoPlano(ORG, 'obra-1', 'Fluxo_Bertioga.xlsx'),
    idDoPlano(ORG, 'obra-1', 'Fluxo_Bertioga.xlsx'),
  )
})

test('⚠️ o "(1)" que o navegador acrescenta não cria plano novo', () => {
  // Baixar a planilha duas vezes deixa `Fluxo (1).xlsx` na pasta. Se o "(1)" contasse, o cliente
  // teria dois planos sem entender por quê.
  assert.equal(
    idDoPlano(ORG, 'obra-1', 'Fluxo Bertioga.xlsx'),
    idDoPlano(ORG, 'obra-1', 'Fluxo Bertioga (1).xlsx'),
  )
  assert.equal(
    idDoPlano(ORG, 'obra-1', 'Fluxo_Bertioga.xlsx'),
    idDoPlano(ORG, 'obra-1', 'fluxo-bertioga.XLSX'),
    'espaço, traço, sublinhado e caixa são a mesma coisa',
  )
})

test('obras diferentes e organizações diferentes NÃO colidem', () => {
  const ids = new Set([
    idDoPlano(ORG, 'obra-1', 'F.xlsx'),
    idDoPlano(ORG, 'obra-2', 'F.xlsx'),
    idDoPlano('outra-org', 'obra-1', 'F.xlsx'),
    idDoPlano(ORG, undefined, 'F.xlsx'),
  ])
  assert.equal(ids.size, 4)
})

test('arquivos com nomes diferentes são planos diferentes', () => {
  assert.notEqual(idDoPlano(ORG, 'o', 'Bertioga.xlsx'), idDoPlano(ORG, 'o', 'Santos.xlsx'))
})

// ─── A conferência ────────────────────────────────────────────────────────────

test('sem plano existente é criação, e não há nada a comparar', () => {
  const c = conferirPlano({ premissas: P, nome: 'F' }, null)
  assert.equal(c.ehNovo, true)
  assert.equal(c.existente, null)
  assert.deepEqual(c.mudancas, [])
  assert.equal(c.capitalAntes, null)
  assert.ok(c.capitalDepois > 0)
})

test('reimportar a MESMA planilha: zero mudança', () => {
  const c = conferirPlano({ premissas: P, nome: 'F' }, plano())
  assert.equal(c.ehNovo, false)
  assert.deepEqual(c.mudancas, [], 'nada mudou')
  assert.equal(c.capitalAntes, c.capitalDepois)
})

test('mudar o cenário aparece com antes e depois, e move o capital', () => {
  const nova: PremissasFcp = { ...P, cenario: 'MINIMA' }
  const c = conferirPlano({ premissas: nova, nome: 'F' }, plano())
  const m = c.mudancas.find((x) => x.rotulo === 'Cenário adotado')!
  assert.equal(m.antes, 'Ótima')
  assert.equal(m.depois, 'Mínima')
  assert.notEqual(c.capitalAntes, c.capitalDepois)
  assert.ok(c.capitalDepois! > c.capitalAntes!, 'na Mínima a empresa precisa de MAIS capital')
})

test('mudar a defasagem e o imposto aparece um por linha', () => {
  const nova: PremissasFcp = { ...P, defasagemDias: 45, imposto: 0.15 }
  const c = conferirPlano({ premissas: nova, nome: 'F' }, plano())
  const rotulos = c.mudancas.map((x) => x.rotulo)
  assert.ok(rotulos.includes('Defasagem de recebimento'))
  assert.ok(rotulos.includes('Imposto da nota'))
  assert.equal(c.mudancas.find((x) => x.rotulo === 'Defasagem de recebimento')!.depois, '45 dias')
})

test('⚠️ cidade que SAI da planilha aparece como mudança, não some em silêncio', () => {
  const semSantos: PremissasFcp = { ...P, cidades: [P.cidades[0]] }
  const c = conferirPlano({ premissas: semSantos, nome: 'F' }, plano())
  const cidades = c.mudancas.find((x) => x.rotulo === 'Cidades')!
  assert.match(cidades.antes, /Santos/)
  assert.ok(!/Santos/.test(cidades.depois))
  // E o custo mensal dela, que existia antes, aparece indo para "—".
  assert.ok(c.mudancas.some((x) => x.rotulo === 'Custo mensal — Santos' && x.depois === '—'))
})

test('mudança de custo dentro de uma cidade aparece pelo nome dela', () => {
  const maisCaro: PremissasFcp = {
    ...P,
    cidades: [
      { ...P.cidades[0], custos: { ...P.cidades[0].custos, gerais: [...P.cidades[0].custos.gerais, { item: 'Novo item', quantidade: 1, valorUnitario: 5000, bloco: 'estrutura' }] } },
      P.cidades[1],
    ],
  }
  const c = conferirPlano({ premissas: maisCaro, nome: 'F' }, plano())
  assert.ok(c.mudancas.some((x) => x.rotulo === 'Custo mensal — Bertioga'))
  assert.ok(c.mudancas.some((x) => x.rotulo === 'Custo mensal GLOBAL'))
})

test('plano APROVADO trava a importação por cima', () => {
  const c = conferirPlano({ premissas: { ...P, cenario: 'BOA' }, nome: 'F' }, plano({ status: 'aprovado' }))
  assert.equal(c.travadoPorAprovacao, true)
})

test('a conferência conta os lançamentos que serão preservados', () => {
  const comProducao = plano({ realizado: { bertioga: { 1: 90, 2: 105 }, santos: { 1: 70 } } })
  assert.equal(conferirPlano({ premissas: P, nome: 'F' }, comProducao).lancamentosPreservados, 3)
})

// ─── O que é gravado ──────────────────────────────────────────────────────────

test('⚠️ O TESTE QUE IMPORTA: a produção lançada SOBREVIVE à reimportação', () => {
  // A planilha traz premissas. A produção realizada é trabalho que a equipe registrou semana a
  // semana e não existe em lugar nenhum além do sistema. Apagar seria destruir dado.
  const existente = plano({ realizado: { bertioga: { 1: 90, 2: 105 } } })
  const gravado = planoParaGravar(
    { nome: 'F', premissas: { ...P, cenario: 'BOA' }, precos: {}, realizadoDaPlanilha: {} },
    existente, 'plano-1', 'obra-1',
  )
  assert.equal(gravado.realizado.bertioga[1], 90)
  assert.equal(gravado.realizado.bertioga[2], 105)
  assert.equal(gravado.premissas.cenario, 'BOA', 'e a premissa nova entrou')
})

test('o realizado do SISTEMA vence o da planilha; o da planilha preenche o vazio', () => {
  // O lançado na tela (ou vindo do Last Planner) é mais recente que a exportação da planilha.
  const r = mesclarRealizado(
    { bertioga: { 1: 50, 3: 80 } },                 // da planilha
    { bertioga: { 1: 90 } },                        // do sistema
  )
  assert.equal(r.bertioga[1], 90, 'o do sistema vence')
  assert.equal(r.bertioga[3], 80, 'o da planilha preenche onde não havia nada')
})

test('o id, a data de criação e o rastro de aprovação são preservados', () => {
  const existente = plano({
    criadoEm: '2026-01-01T00:00:00.000Z',
    enviadoPor: 'Ana', enviadoEm: '2026-02-01T00:00:00.000Z',
  })
  const g = planoParaGravar(
    { nome: 'F novo', premissas: P, precos: {}, realizadoDaPlanilha: {} },
    existente, 'plano-1', 'obra-9',
  )
  assert.equal(g.id, 'plano-1')
  assert.equal(g.criadoEm, '2026-01-01T00:00:00.000Z')
  assert.equal(g.enviadoPor, 'Ana')
})

test('a obra do plano existente vence a do contexto; sem ela, herda a ativa', () => {
  // Importar com outra obra selecionada na barra lateral não pode sequestrar o plano para ela.
  const comObra = planoParaGravar(
    { nome: 'F', premissas: P, precos: {}, realizadoDaPlanilha: {} },
    plano({ obraId: 'obra-do-plano' }), 'plano-1', 'obra-ativa-agora',
  )
  assert.equal(comObra.obraId, 'obra-do-plano')

  const semObra = planoParaGravar(
    { nome: 'F', premissas: P, precos: {}, realizadoDaPlanilha: {} },
    plano(), 'plano-1', 'obra-ativa-agora',
  )
  assert.equal(semObra.obraId, 'obra-ativa-agora', 'plano sem obra herda a do contexto')
})

test('⚠️ plano aprovado que recebe premissa NOVA volta para rascunho', () => {
  // O número que a diretoria aprovou deixou de ser o número da tela. Manter "aprovado" seria
  // mentir sobre o que foi aprovado.
  const g = planoParaGravar(
    { nome: 'F', premissas: { ...P, cenario: 'MINIMA' }, precos: {}, realizadoDaPlanilha: {} },
    plano({ status: 'aprovado', aprovadoPor: 'Ana' }), 'plano-1', undefined,
  )
  assert.equal(g.status, 'rascunho')
})

test('plano aprovado que recebe a MESMA planilha continua aprovado', () => {
  const g = planoParaGravar(
    { nome: 'F', premissas: P, precos: {}, realizadoDaPlanilha: {} },
    plano({ status: 'aprovado', aprovadoPor: 'Ana' }), 'plano-1', undefined,
  )
  assert.equal(g.status, 'aprovado', 'nada mudou — não há por que reabrir')
})

test('o ciclo inteiro: importar, importar de novo, mexer e importar — sempre UM plano', () => {
  const id = idDoPlano(ORG, 'obra-1', 'Fluxo.xlsx')
  const planos: PlanoFcp[] = []
  const importar = (premissas: PremissasFcp) => {
    const existente = planos.find((p) => p.id === id) ?? null
    const g = planoParaGravar({ nome: 'Fluxo', premissas, precos: {}, realizadoDaPlanilha: {} }, existente, id, 'obra-1')
    const i = planos.findIndex((p) => p.id === id)
    if (i >= 0) planos[i] = g; else planos.push(g)
    return g
  }

  importar(P)
  assert.equal(planos.length, 1)
  importar(P)
  assert.equal(planos.length, 1, 'a segunda importação não cria outro')

  // A equipe lança produção entre as importações.
  planos[0] = { ...planos[0], realizado: { bertioga: { 1: 90 } } }

  const terceira = importar({ ...P, cenario: 'BOA' })
  assert.equal(planos.length, 1, 'e a terceira também não')
  assert.equal(terceira.premissas.cenario, 'BOA')
  assert.equal(terceira.realizado.bertioga[1], 90, 'com a produção lançada intacta')
})
