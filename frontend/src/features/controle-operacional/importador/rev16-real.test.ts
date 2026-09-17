/**
 * Contra as planilhas REAIS, lidas do disco — nunca copiadas para o repositório
 * (têm nomes e salários). Cada teste só roda com a sua variável definida:
 *
 *   PLANILHA_REAL  = a PREENCHIDA (fonte oficial):
 *                    "…/CONTROLE OPERACIONAL SABESP - BERTIOGA GUARUJA E SANTOS - WCR-rev15-PLANEJADOxREALIZADO-.xlsx"
 *   PLANILHA_REV16 = o modelo rev16 (quase vazio; referência de layout)
 *   PLANILHA_ZN    = "…/CONTROLE OPERACIONAL - CONSORCIO ZN - WCR-v1.xlsx" (tem que ser recusada)
 *
 *   npm test -- "src/features/controle-operacional/importador/rev16-real.test.ts"
 *
 * O diagnóstico imprime SÓ contagens, códigos de serviço e avisos (nenhum nome, nenhum salário).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test, type TestContext } from 'node:test'
import { avisosDaLeitura, contagensDaLeitura, lerArquivoRev16, type LeituraRev16 } from './lerPlanilhaRev16'
import { reconciliar, resumoGeral, type ProjetoRef } from './reconciliar'
import { aplicarPlanoEmMemoria, contarEscritas, planejarEscritas } from './gravarImportacao'
import { dadosVazios } from '../dominio/tipos'
import { indexar, totaisPorBoletim } from '../dominio/calculos'

const REAL = process.env.PLANILHA_REAL
const REV16 = process.env.PLANILHA_REV16
const ZN = process.env.PLANILHA_ZN

const PROJETOS: ProjetoRef[] = [
  { id: 'ber', nome: 'WCR — Bertioga', org_id: 'wcr' },
  { id: 'san', nome: 'WCR — Santos', org_id: 'wcr' },
]
const bancoVazio = () => new Map(PROJETOS.map((p) => [p.id, dadosVazios(p.id)]))

function ler(caminho: string): LeituraRev16 {
  const { assinatura, leitura } = lerArquivoRev16(readFileSync(caminho))
  assert.equal(assinatura.ok, true, assinatura.mensagem)
  return leitura!
}

/** prévia contra banco vazio + reimportação do mesmo arquivo (tem que dar zero escritas) */
function previaEReimportacao(t: TestContext, caminho: string) {
  const l = ler(caminho)
  const r = reconciliar({ leitura: l, projetos: PROJETOS, pessoas: [], ehAdmin: false, existentes: bancoVazio() })
  assert.deepEqual(r.contratosSemProjeto, [])
  const tot = resumoGeral(r)
  t.diagnostic(`prévia (banco vazio): ${JSON.stringify(tot)}`)
  for (const p of r.projetos) {
    for (const g of p.grupos) {
      const partes = Object.entries(g.resumo).filter(([, n]) => n > 0).map(([v, n]) => `${v} ${n}`)
      if (partes.length) t.diagnostic(`  ${p.projetoNome} · aba ${g.aba} ${g.rotulo}: ${partes.join(', ')}`)
    }
  }
  const plano = planejarEscritas(r)
  t.diagnostic(`escritas planejadas: ${contarEscritas(plano).gravar}`)
  assert.equal(tot.CONFLITO, 0)
  assert.equal(tot.AUSENTE, 0)
  assert.equal(tot.ERRO, 0)

  const depois = aplicarPlanoEmMemoria(plano, bancoVazio())
  const r2 = reconciliar({ leitura: ler(caminho), projetos: PROJETOS, pessoas: [], ehAdmin: false, existentes: depois })
  const tot2 = resumoGeral(r2)
  t.diagnostic(`reimportação do mesmo arquivo: ${JSON.stringify(tot2)}`)
  assert.equal(contarEscritas(planejarEscritas(r2)).total, 0)
  assert.equal(tot2.IGUAL, tot.NOVO)
  return { l, depois }
}

function diagnosticoLeitura(t: TestContext, l: LeituraRev16) {
  for (const c of contagensDaLeitura(l)) t.diagnostic(`aba ${c.aba} · ${c.rotulo}: ${c.n}`)
  t.diagnostic(`não entendidas: ${l.naoEntendidas.length}`)
  for (const n of l.naoEntendidas) t.diagnostic(`  [não entrou] aba ${n.aba} · linha ${n.linha ?? '—'}: ${n.motivo}`)
  for (const a of l.avisos) t.diagnostic(`  [aviso geral] ${a}`)
  const av = avisosDaLeitura(l)
  t.diagnostic(`avisos de linha: ${av.length}`)
  for (const a of av) t.diagnostic(`  [aviso] aba ${a.aba} · linha ${a.linha}: ${a.mensagem}`)
}

test('planilha REAL preenchida: 44 serviços, BM-09/2026 = R$ 35.916,56 em 50 itens, avisos das datas e boletins', { skip: REAL ? false : 'defina PLANILHA_REAL' }, (t) => {
  const l = ler(REAL!)
  diagnosticoLeitura(t, l)

  // 03 — 44 serviços; as 10 linhas só com CONTRATO não viram serviço
  assert.equal(l.servicos.length, 44)
  assert.deepEqual(l.servicos.map((s) => s.dados.codigo), Array.from({ length: 44 }, (_, i) => `BER-${String(i + 1).padStart(4, '0')}`))
  assert.ok(l.naoEntendidas.some((n) => n.aba === '03' && /10 linha\(s\) só com CONTRATO/.test(n.motivo)))
  // 03 R36 digitada por cima da fórmula
  assert.ok(l.servicos.find((s) => s.linha === 36)!.avisos.some((a) => /coluna R.*digitada por cima/.test(a)))

  // 05 — OS concluídas incluem as de 16/09
  const concluidas = new Set(l.ordens.filter((o) => o.dados.data_conclusao).map((o) => o.dados.servico_codigo))
  for (const c of ['BER-0031', 'BER-0032', 'BER-0044']) assert.ok(concluidas.has(c), c)

  // 06 / 10 — apontamento e diário de 16/09
  assert.ok(l.apontamentos.some((a) => a.dados.data === '2026-09-16'))
  assert.ok(l.pendentes.some((p) => p.dados.aba === '10' && p.dados.data === '2026-09-16'))

  // 01A — benefícios por pessoa
  assert.equal(l.parametros.beneficios_pessoa, 1904.32)

  // 08 — a coluna X (instruções) é ignorada
  assert.equal(l.membros.length, 31)
  assert.ok(!JSON.stringify(l.membros.map((m) => ({ ...m.dados, nome: '' }))).includes('= salário'))

  // 09 — 53 itens com valor; 3 boletins do ano seguinte; G digitada nas linhas 54–59 e 71–74
  assert.equal(l.medicoes.length, 53)
  const linhasBm2027 = l.medicoes.filter((m) => m.dados.n_boletim === 'BM-09/2027').map((m) => m.linha)
  assert.deepEqual(linhasBm2027, [36, 37, 55])
  for (const ln of linhasBm2027) {
    assert.ok(l.medicoes.find((m) => m.linha === ln)!.avisos.some((a) => /ano seguinte ao da data de execução/.test(a)), `linha ${ln}`)
  }
  const gDigitada = l.medicoes.filter((m) => m.dados.data_execucao_digitada).map((m) => m.linha)
  assert.deepEqual(gDigitada, [54, 55, 56, 57, 58, 59, 71, 72, 73, 74])
  assert.ok(l.medicoes.find((m) => m.linha === 55)!.avisos.some((a) => /divergência.*17\/09\/2026.*16\/09\/2026/.test(a)))
  // 53 e 60–70: "sem item" (e nenhum R$ 0 gravado)
  const semItem = l.naoEntendidas.filter((n) => n.aba === '09' && /sem item/.test(n.motivo)).map((n) => n.linha)
  for (const ln of [53, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70]) assert.ok(semItem.includes(ln), `linha ${ln}`)

  const { depois } = previaEReimportacao(t, REAL!)
  const boletins = totaisPorBoletim(indexar(depois.get('ber')!))
  for (const b of boletins) t.diagnostic(`boletim ${b.boletim}: ${b.itens} itens, R$ ${b.valor.toFixed(2)} (${b.sem_valor} sem valor calculável)`)
  const bm = boletins.find((b) => b.boletim === 'BM-09/2026')!
  assert.equal(bm.itens, 50)
  assert.equal(bm.valor, 35916.56)
  assert.equal(bm.sem_valor, 0)
})

test('modelo rev16 (referência): 43 serviços + 11 linhas-modelo só com CONTRATO', { skip: REV16 ? false : 'defina PLANILHA_REV16' }, (t) => {
  const l = ler(REV16!)
  diagnosticoLeitura(t, l)
  assert.equal(l.servicos.length, 43)
  assert.ok(l.naoEntendidas.some((n) => n.aba === '03' && /11 linha\(s\) só com CONTRATO/.test(n.motivo)))
  assert.ok(l.precos.some((p) => p.dados.chave === 'BER-72000044' && p.dados.preco === 785.07 && p.dados.un === 'un'))
  const soma = l.tributos.reduce((s, x) => s + (x.dados.aliquota ?? 0), 0)
  assert.ok(Math.abs(soma - 0.22) < 1e-9, `tributos somam ${soma}`)
  previaEReimportacao(t, REV16!)
})

test('ZN real: recusada pela assinatura, nada lido', { skip: ZN ? false : 'defina PLANILHA_ZN' }, () => {
  const { assinatura, leitura } = lerArquivoRev16(readFileSync(ZN!))
  assert.equal(assinatura.ok, false)
  assert.equal(assinatura.modelo, 'zn')
  assert.equal(leitura, null)
})
