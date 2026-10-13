/**
 * As fórmulas da CONTROLE OPERACIONAL rev16, em TypeScript.
 *
 * O primeiro teste é a porta de `test_cadastrar_e_medir` do app Python: serviço → OS
 * concluída com fotos → medição no BER-72000044 → R$ 785,07, status MEDIDO.
 *
 * Os demais FIXAM onde a planilha e o app Python divergem. Em toda divergência vale
 * a PLANILHA — cada teste diz o que o Python fazia, para ninguém "consertar" de volta.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  alertaPessoa, alertasEquipe, apontamentoCalc, custoMensal, faturamentoCalc, folhaMensal, hhDoApontamento,
  impostoTotal, indexar, lookaheadCalc, medicaoCalc, metas, montarContexto, nEquipesAtivas, osCalc,
  paretoCausas, planejadoRealizadoSemana, ppcSemana, programacaoCalc, quantidadesPorUnidade, resumoMes,
  semanaOperacao, servicoCalc, ataCalc, rdoResumoDia,
} from './calculos'
import {
  dadosVazios, type DadosOp, type OpApontamento, type OpEquipeMembro, type OpMedicaoItem, type OpOrdemServico,
  type OpParametros, type OpPlanoItem, type OpProgramacao, type OpServico, type PessoaVencimento,
} from './tipos'
import { fimDoMes, isoParaSerial, segundaDaSemana, semanaIso, serialParaISO, textoParaISO, addDias } from './datas'
import { fonteOp } from './fonteCusto'

const P = 'p-ber'

function parametros(o: Partial<OpParametros> = {}): OpParametros {
  return {
    id: P, projeto_id: P, empresa: null, responsavel: null, coordenador: null, contrato_nome: 'BERTIOGA',
    contrato_descricao: null, prefixo: 'BER', inicio_operacao: '2026-08-31', mes_referencia: '2026-09-01',
    desconto_consorcio: 0, dia_fechamento: 30, defasagem_recebimento: 20, dias_uteis_mes: 22, jornada_h: 8.8,
    prazo_padrao_dias: 5, alerta_prazo_dias: 2, margem_alvo: 0.2, fator_encargos: 0.58, beneficios_pessoa: 1000,
    ...o,
  }
}

let seq = 0
const id = (p: string) => `${p}-${++seq}`

function servico(o: Partial<OpServico> = {}): OpServico {
  return {
    id: id('srv'), projeto_id: P, codigo: `BER-S${String(seq).padStart(4, '0')}`, n_os_sabesp: null,
    data_solicitacao: '2026-09-16', prazo_dias: 5, prioridade: null, tipo: 'Troca de ramal de água',
    endereco: 'Rua Teste', numero: '1', bairro: null, cidade: null, referencia: null, pavimento: null,
    descricao: null, tratativa_manual: null, observacao: null, ...o,
  }
}

function os(servico_id: string, o: Partial<OpOrdemServico> = {}): OpOrdemServico {
  return {
    id: id('os'), projeto_id: P, servico_id, equipe: 'BER-A', encarregado: null, data_inicio: '2026-09-16',
    data_conclusao: '2026-09-16', profundidade_m: null, extensao_m: null, pavimento_reposto: 'SIM',
    foto_antes: 'SIM', foto_depois: 'SIM', n_rdo: null, pendencia: null, ...o,
  }
}

function medicao(servico_id: string, o: Partial<OpMedicaoItem> = {}): OpMedicaoItem {
  return {
    id: id('med'), projeto_id: P, servico_id, cod_preco: 'BER-72000044', ordem: 1, n_boletim: 'BM-09/2026',
    qtd: 1, status: null, data_apresentacao: null, valor_glosado: null, motivo_glosa: null, reapresentar: null,
    observacao: null, ...o,
  }
}

function prog(servico_id: string, data: string, o: Partial<OpProgramacao> = {}): OpProgramacao {
  return {
    id: id('prog'), projeto_id: P, servico_id, data, equipe: 'BER-A', seq: 1, h_previstas: 8, executou: null,
    data_execucao: null, motivo_nao_execucao: null, reprogramar_para: null, observacao: null, ...o,
  }
}

function apont(data: string, o: Partial<OpApontamento> = {}): OpApontamento {
  return {
    id: id('ap'), projeto_id: P, data, equipe: 'BER-A', n_pessoas: 4, h_normais: 8, h_extras: null, retro_h: null,
    cam34_munck_h: null, caminhao_hr_h: null, compressor_h: null, rompedor_h: null, bomba_h: null, km_rodado: null,
    status_dia: null, motivo_parada: null, observacao: null, ...o,
  }
}

function base(): DadosOp {
  const d = dadosVazios(P)
  d.parametros = parametros()
  d.precos = [
    { id: 'pr1', projeto_id: P, chave: 'BER-72000044', contrato: 'BERTIOGA', grupo: null, item_sabesp: null, descricao: 'TROCA DE RAMAL', n_preco: '72000044', un: 'un', preco: 785.07 },
    { id: 'pr2', projeto_id: P, chave: 'BER-72001226', contrato: 'BERTIOGA', grupo: null, item_sabesp: null, descricao: 'REPOSIÇÃO DE PASSEIO', n_preco: '72001226', un: 'M', preco: 16.33 },
  ]
  d.tributos = [
    ['PIS', 0.0065], ['COFINS', 0.03], ['IRPJ', 0.048], ['Adicional de IRPJ', 0.01], ['CSLL', 0.0288], ['ISS', 0.05], ['INSS', 0.0467],
  ].map(([nome, aliquota], i) => ({ id: `t${i}`, projeto_id: P, nome: nome as string, aliquota: aliquota as number, memoria: null, fonte: null, ordem: i }))
  return d
}

// ─── a porta do teste do Python ─────────────────────────────────────────────

test('cadastrar e medir (porta de test_cadastrar_e_medir): R$ 785,07 no BER-72000044, status MEDIDO', () => {
  const d = base()
  const s = servico()
  d.servicos = [s]
  d.ordens = [os(s.id)]
  d.medicoes = [medicao(s.id)]
  const ctx = montarContexto(d, null, '2026-09-16')

  const sc = servicoCalc(s, ctx.idx, ctx.p, ctx.hoje)
  assert.equal(sc.status, 'MEDIDO')
  assert.equal(sc.valor_medido, 785.07)
  assert.equal(sc.data_execucao, '2026-09-16')
  assert.equal(sc.data_limite, '2026-09-21')
  assert.equal(sc.situacao_prazo, 'NO PRAZO')
  assert.equal(sc.equipe, 'BER-A')

  const oc = osCalc(d.ordens[0], ctx.idx)
  assert.equal(oc.pronta_para_medir, true)
  assert.equal(oc.valor, 785.07)
  assert.equal(oc.n_itens, 1)
  assert.equal(oc.mes_medicao, '2026-09-30')

  const mc = medicaoCalc(d.medicoes[0], ctx.idx)
  assert.equal(mc.valor, 785.07)
  assert.equal(mc.valor_aprovado, 785.07)
  assert.equal(mc.un, 'un')
})

test('faturamento do mês com imposto 0,22: bruto 785,07 → imposto 172,72 → líquido 612,35', () => {
  const d = base()
  const s = servico()
  d.servicos = [s]; d.ordens = [os(s.id)]; d.medicoes = [medicao(s.id)]
  const f = { id: 'f1', projeto_id: P, mes: '2026-09-01', n_nf: null, data_nf: null, data_recebimento: null, valor_recebido: null }
  const ctx = montarContexto(d, null, '2026-09-20')
  assert.equal(ctx.imposto, 0.22)
  const fc = faturamentoCalc(f, ctx)
  assert.equal(fc.bruto, 785.07)
  assert.equal(fc.glosa, 0)
  assert.equal(fc.aprovado, 785.07)
  assert.ok(Math.abs(fc.imposto! - 172.7154) < 1e-9)
  assert.ok(Math.abs(fc.liquido! - 612.3546) < 1e-9)
  // K RECEBIMENTO PREVISTO = último dia do mês + 20
  assert.equal(fc.previsto, '2026-10-20')
  assert.equal(fc.status, 'A FATURAR')
  assert.equal(fc.dias_atraso, 0)
})

// ─── divergências planilha × Python (vale a planilha) ───────────────────────

test('03 DATA PROGRAMADA é a PRIMEIRA programação (MATCH), não a mais recente como no Python', () => {
  // Python: order_by(Programacao.data.desc()).first() → 2026-09-08
  // Planilha: INDEX(PROG_DATA; MATCH(A; PROG_ID; 0)) → a primeira linha, a programação original
  const d = base()
  const s = servico({ data_solicitacao: '2026-09-01' })
  d.servicos = [s]
  d.programacoes = [
    prog(s.id, '2026-09-08', { equipe: 'BER-B' }),
    prog(s.id, '2026-09-05', { equipe: 'BER-A', executou: 'NÃO', motivo_nao_execucao: 'Chuva', reprogramar_para: '2026-09-08' }),
  ]
  const ctx = montarContexto(d, null, '2026-09-06')
  const sc = servicoCalc(s, ctx.idx, ctx.p, ctx.hoje)
  assert.equal(sc.data_programada, '2026-09-05')
  // P EQUIPE DESIGNADA sem OS: a da primeira programação
  assert.equal(sc.equipe, 'BER-A')
  assert.equal(sc.status, 'PROGRAMADO')
})

test('03 EQUIPE DESIGNADA: havendo OS, é a equipe da OS — mesmo em branco (a planilha não cai para a programação)', () => {
  const d = base()
  const s = servico()
  d.servicos = [s]
  d.programacoes = [prog(s.id, '2026-09-16', { equipe: 'BER-B' })]
  d.ordens = [os(s.id, { equipe: null, data_conclusao: null })]
  const ctx = montarContexto(d, null, '2026-09-16')
  assert.equal(servicoCalc(s, ctx.idx, ctx.p, ctx.hoje).equipe, null)
})

test('01 margem-alvo: 0 continua 0 (o Python fazia `margem or 0.2` e virava 20%); vazio é "não informado"', () => {
  const custo = 100000
  const m0 = metas(parametros({ margem_alvo: 0 }), custo, 4, 0.22)
  assert.equal(m0.margem, 0)
  assert.ok(Math.abs(m0.meta_mes! - custo / 0.78) < 1e-6)

  const mVazia = metas(parametros({ margem_alvo: null }), custo, 4, 0.22)
  assert.equal(mVazia.margem, null)
  assert.equal(mVazia.meta_mes, null)

  const m20 = metas(parametros({ margem_alvo: 0.2 }), custo, 4, 0.22)
  assert.ok(Math.abs(m20.meta_mes! - custo * 1.2 / 0.78) < 1e-6)
  // C38 meta por equipe/dia = meta ÷ 22 ÷ 4
  assert.ok(Math.abs(m20.meta_equipe_dia! - custo * 1.2 / 0.78 / 22 / 4) < 1e-6)
})

test('01 nº de equipes zero: custo por equipe é "não calculável" (planilha #DIV/0!; Python usava `or 1`)', () => {
  const m = metas(parametros(), 100000, 0, 0.22)
  assert.equal(m.custo_equipe_dia, null)
  assert.equal(m.meta_equipe_dia, null)
})

test('09 VALOR = ROUND(QTD × PREÇO; 2) — o Python não arredondava', () => {
  const d = base()
  const s = servico()
  d.servicos = [s]; d.ordens = [os(s.id)]
  d.medicoes = [medicao(s.id, { cod_preco: 'BER-72001226', qtd: 12.345 })]   // 12,345 × 16,33 = 201,59385
  const ctx = montarContexto(d, null, '2026-09-16')
  assert.equal(medicaoCalc(d.medicoes[0], ctx.idx).valor, 201.59)
})

test('05 STATUS DA OS segue a planilha (MEDIDA / EM EXECUÇÃO / AGUARDANDO PAVIMENTO / CONCLUÍDA / CANCELADA)', () => {
  // Python: CONCLUÍDA se tem conclusão, EM ANDAMENTO se tem início, senão ABERTA
  const d = base()
  const [s1, s2, s3, s4, s5] = [servico(), servico(), servico(), servico(), servico()]
  d.servicos = [s1, s2, s3, s4, s5]
  d.ordens = [
    os(s1.id),                                             // com medição → MEDIDA
    os(s2.id, { data_conclusao: null }),                   // → EM EXECUÇÃO
    os(s3.id, { foto_depois: 'NÃO' }),                     // → AGUARDANDO PAVIMENTO
    os(s4.id),                                             // → CONCLUÍDA
    os(s5.id, { pendencia: 'CANCELADA' }),                 // → CANCELADA
  ]
  d.medicoes = [medicao(s1.id)]
  const ctx = montarContexto(d, null, '2026-09-16')
  assert.deepEqual(d.ordens.map((o) => osCalc(o, ctx.idx).status),
    ['MEDIDA', 'EM EXECUÇÃO', 'AGUARDANDO PAVIMENTO', 'CONCLUÍDA', 'CANCELADA'])
  assert.equal(osCalc(d.ordens[2], ctx.idx).pronta_para_medir, false)
})

test('12 FATURAMENTO segue a planilha: EM ATRASO conta até hoje, RECEBIDA PARCIAL, MARGEM sobre a BRUTA', () => {
  // Python: status RECEBIDO/FATURADO/MEDIDO; atraso só com data de recebimento; margem ÷ líquido
  const d = base()
  const s = servico()
  d.servicos = [s]; d.ordens = [os(s.id)]; d.medicoes = [medicao(s.id)]
  const mes = '2026-09-01'
  const ctx = montarContexto(d, { n_com_salario: 0, soma_salario: 0 }, '2026-10-25')   // previsto 20/10
  const semNada = faturamentoCalc({ id: 'f', projeto_id: P, mes, n_nf: null, data_nf: null, data_recebimento: null, valor_recebido: null }, ctx)
  assert.equal(semNada.dias_atraso, 5)
  assert.equal(semNada.status, 'EM ATRASO')

  const parcial = faturamentoCalc({ id: 'f', projeto_id: P, mes, n_nf: 'NF 1', data_nf: '2026-10-01', data_recebimento: '2026-10-22', valor_recebido: 500 }, ctx)
  assert.equal(parcial.status, 'RECEBIDA PARCIAL')
  assert.equal(parcial.dias_atraso, 2)

  const cheia = faturamentoCalc({ id: 'f', projeto_id: P, mes, n_nf: 'NF 1', data_nf: '2026-10-01', data_recebimento: '2026-10-19', valor_recebido: 612 }, ctx)
  assert.equal(cheia.status, 'RECEBIDA')   // 612 ≥ 612,35 × 0,995
  assert.equal(cheia.dias_atraso, 0)

  // sem custo cadastrado a folha é 0 (ninguém ativo) e os itens são 0: resultado = líquido; margem ÷ BRUTA
  assert.ok(Math.abs(cheia.margem! - cheia.liquido! / 785.07) < 1e-9)
})

test('12 mês sem medição: status em branco (IF(E=0;"")), não "SEM MEDIÇÃO" como no Python', () => {
  const ctx = montarContexto(base(), null, '2026-10-25')
  const f = faturamentoCalc({ id: 'f', projeto_id: P, mes: '2026-08-01', n_nf: null, data_nf: null, data_recebimento: null, valor_recebido: null }, ctx)
  assert.equal(f.status, null)
  assert.equal(f.dias_atraso, null)
})

test('13 resumo: programação conta pela OBRA do serviço (o Python comparava o prefixo `n[:3]`)', () => {
  const d = base()
  // serviço com código fora do padrão BER-: na planilha PROG_CONTR vem do cadastro, não do prefixo
  const s = servico({ codigo: 'XYZ-0001', data_solicitacao: '2026-09-02' })
  d.servicos = [s]
  d.programacoes = [prog(s.id, '2026-09-03', { executou: 'SIM', data_execucao: '2026-09-03' }), prog('servico-de-outra-obra', '2026-09-03')]
  const ctx = montarContexto(d, null, '2026-09-30')
  const r = resumoMes('2026-09-01', ctx)
  assert.equal(r.programados, 1)
  assert.equal(r.recebidos, 1)
})

test('17 Pareto conta TODA causa lançada (COUNTIF da planilha), não só as de NÃO como no Python', () => {
  const item = (o: Partial<OpPlanoItem>): OpPlanoItem => ({
    id: id('pl'), projeto_id: P, op_servico_id: 's', semana: '2026-09-07', semana_iso: '2026-W37', equipe: 'BER-A',
    compromisso: null, concluido: null, data_conclusao: null, causa_nc: null, reprogramado_para: null, observacao: null, ...o,
  })
  const plano = [
    item({ concluido: 'NÃO', causa_nc: 'Chuva / clima' }),
    item({ concluido: 'SIM', causa_nc: 'Chuva / clima' }),    // concluiu atrasado, causa anotada
    item({ concluido: 'NÃO', causa_nc: 'Falta de material' }),
  ]
  assert.deepEqual(paretoCausas(plano).map((x) => [x.causa, x.n]), [['Chuva / clima', 2], ['Falta de material', 1]])
  const ppc = ppcSemana(plano, '2026-09-07')
  assert.equal(ppc.programado, 3)
  assert.equal(ppc.concluido, 1)
  assert.ok(Math.abs(ppc.ppc! - 1 / 3) < 1e-9)
})

// ─── regras do produto ──────────────────────────────────────────────────────

test('vazio nunca é zero: sem equipe, produção "não informada"; sem nº de pessoas, HH não informado', () => {
  const d = base()
  const ctx = montarContexto(d, null, '2026-09-16')
  const semEquipe = apontamentoCalc(apont('2026-09-16', { equipe: null }), ctx)
  assert.equal(semEquipe.serv_programados, null)
  assert.equal(semEquipe.valor_produzido, null)
  assert.equal(semEquipe.resultado_dia, null)
  assert.equal(hhDoApontamento(apont('2026-09-16', { n_pessoas: null })), null)
  // hora extra em branco = sem hora extra (a soma da planilha); 0 digitado = 0
  assert.equal(hhDoApontamento(apont('2026-09-16', { n_pessoas: 4, h_normais: 8, h_extras: null })), 32)
  assert.equal(hhDoApontamento(apont('2026-09-16', { n_pessoas: 0, h_normais: 8 })), 0)
})

test('vazio nunca é zero: medição sem QTD ou com código inexistente não vale R$ 0 — fica sem valor e marcada', () => {
  const d = base()
  const s = servico()
  d.servicos = [s]; d.ordens = [os(s.id)]
  d.medicoes = [medicao(s.id, { qtd: null }), medicao(s.id, { cod_preco: 'BER-00000000' })]
  const ctx = montarContexto(d, null, '2026-09-16')
  assert.equal(medicaoCalc(d.medicoes[0], ctx.idx).valor, null)
  const inexistente = medicaoCalc(d.medicoes[1], ctx.idx)
  assert.equal(inexistente.valor, null)
  assert.equal(inexistente.descricao, 'CÓDIGO NÃO ENCONTRADO')
  const sc = servicoCalc(s, ctx.idx, ctx.p, ctx.hoje)
  assert.equal(sc.valor_medido, 0)
  assert.equal(sc.valor_medido_incompleto, true)
  assert.equal(sc.status, 'EXECUTADO')
})

test('vazio nunca é zero: sem tributo cadastrado o imposto é "não informado", não 0%', () => {
  assert.equal(impostoTotal([]), null)
  const d = base(); d.tributos = []
  const ctx = montarContexto(d, null, '2026-09-16')
  assert.equal(ctx.metas.meta_mes, null)
})

test('metro não soma com unidade: quantidade medida é totalizada por UN', () => {
  const d = base()
  const s = servico()
  d.servicos = [s]
  d.medicoes = [medicao(s.id, { qtd: 2 }), medicao(s.id, { cod_preco: 'BER-72001226', qtd: 12.5 }), medicao(s.id, { qtd: 1 })]
  const q = quantidadesPorUnidade(d.medicoes, indexar(d))
  assert.equal(q.get('un'), 3)
  assert.equal(q.get('M'), 12.5)
  assert.equal(q.size, 2)
})

test('folha: Σ salário × (1 + encargos) + benefício × ativos; ativo sem salário é apontado, não vira salário 0', () => {
  const membro = (pessoa_id: string, o: Partial<OpEquipeMembro> = {}): OpEquipeMembro => ({
    id: id('m'), projeto_id: P, pessoa_id, matricula: pessoa_id, equipe: 'BER-A', funcao: null, admissao: null, ativo: true, ...o,
  })
  const membros = [membro('a'), membro('b'), membro('c', { equipe: 'BER-B' }), membro('d', { ativo: false }), membro('e', { equipe: 'APOIO' }), membro('f', { ativo: null })]
  const folha = folhaMensal(membros, { n_com_salario: 3, soma_salario: 9000 }, parametros())
  assert.equal(folha.n_ativos, 4)
  assert.equal(folha.n_sem_salario, 1)
  assert.equal(folha.valor, 9000 * 1.58 + 1000 * 4)
  // C24 nº de equipes: só com gente ATIVA ("SIM"), sem APOIO
  assert.equal(nEquipesAtivas(membros), 2)

  const custo = custoMensal([{ id: 'c1', projeto_id: P, item: 'Alojamento', qtd: 1, valor_unit: 8000, fonte: null, ordem: 0 },
    { id: 'c2', projeto_id: P, item: 'Caminhão', qtd: null, valor_unit: 5000, fonte: null, ordem: 1 }], folha)
  assert.equal(custo.itens, 8000)
  assert.equal(custo.total, 8000 + folha.valor!)
  assert.ok(custo.pendencias.some((p) => /Caminhão/.test(p)))
  assert.ok(custo.pendencias.some((p) => /sem salário/.test(p)))

  // sem acesso à soma dos salários: custo "não calculável", nunca um número inventado
  assert.equal(folhaMensal(membros, null, parametros()).valor, null)
})

test('fonteOp devolve custo, imposto, margem, defasagem e dias úteis do banco op_*', () => {
  const d = base()
  d.custos = [{ id: 'c1', projeto_id: P, item: 'Alojamento', qtd: 1, valor_unit: 8000, fonte: null, ordem: 0 }]
  const f = fonteOp(d, { n_com_salario: 0, soma_salario: 0 })
  assert.equal(f.custoMensal, 8000)
  assert.equal(f.imposto, 0.22)
  assert.equal(f.margemAlvo, 0.2)
  assert.equal(f.defasagemDias, 20)
  assert.equal(f.diasUteisMes, 22)
})

test('03 SITUAÇÃO DO PRAZO: VENCIDO, VENCE EM BREVE (alerta 2 dias), EM DIA, FORA DO PRAZO', () => {
  const d = base()
  const venc = servico({ data_solicitacao: '2026-09-01' })       // limite 06/09
  const breve = servico({ data_solicitacao: '2026-09-13' })      // limite 18/09
  const emDia = servico({ data_solicitacao: '2026-09-15' })      // limite 20/09
  const fora = servico({ data_solicitacao: '2026-09-01' })
  d.servicos = [venc, breve, emDia, fora]
  d.ordens = [os(fora.id, { data_inicio: '2026-09-10', data_conclusao: '2026-09-10' })]
  const ctx = montarContexto(d, null, '2026-09-16')
  assert.deepEqual(d.servicos.map((s) => servicoCalc(s, ctx.idx, ctx.p, ctx.hoje).situacao_prazo),
    ['VENCIDO', 'VENCE EM BREVE', 'EM DIA', 'FORA DO PRAZO'])
  assert.equal(servicoCalc(venc, ctx.idx, ctx.p, ctx.hoje).dias_em_aberto, 15)
})

test('04 STATUS e ADERÊNCIA da programação', () => {
  assert.deepEqual(programacaoCalc(prog('s', '2026-09-05', { executou: 'SIM', data_execucao: '2026-09-05' })), { status: 'EXECUTADO', aderencia: 'NO DIA' })
  assert.deepEqual(programacaoCalc(prog('s', '2026-09-05', { executou: 'SIM', data_execucao: '2026-09-06' })), { status: 'EXECUTADO', aderencia: 'FORA DO DIA' })
  assert.deepEqual(programacaoCalc(prog('s', '2026-09-05', { executou: 'NÃO', reprogramar_para: '2026-09-08' })), { status: 'REPROGRAMADO', aderencia: null })
  assert.deepEqual(programacaoCalc(prog('s', '2026-09-05', { executou: 'NÃO' })), { status: 'NÃO EXECUTADO', aderencia: null })
  assert.deepEqual(programacaoCalc(prog('s', '2026-09-05')), { status: 'PROGRAMADO', aderencia: null })
})

test('06 apontamento com equipe: programados, executados, R$ produzido, resultado e R$/HH', () => {
  const d = base()
  const s = servico()
  d.servicos = [s]
  d.programacoes = [prog(s.id, '2026-09-16')]
  d.ordens = [os(s.id)]
  d.medicoes = [medicao(s.id)]
  d.membros = [{ id: 'm', projeto_id: P, pessoa_id: 'x', matricula: 'BER-001', equipe: 'BER-A', funcao: null, admissao: null, ativo: true }]
  d.custos = [{ id: 'c1', projeto_id: P, item: 'Estrutura', qtd: 1, valor_unit: 22000, fonte: null, ordem: 0 }]
  const ctx = montarContexto(d, { n_com_salario: 1, soma_salario: 0 }, '2026-09-16')
  const a = apontamentoCalc(apont('2026-09-16', { equipe: 'ber-a' }), ctx)
  assert.equal(a.serv_programados, 1)
  assert.equal(a.serv_executados, 1)
  assert.equal(a.aderencia, 1)
  assert.equal(a.valor_produzido, 785.07)
  assert.equal(a.hh_total, 32)
  // custo mensal 22.000 + folha (0 × 1,58 + 1.000 × 1) = 23.000 → ÷ 22 dias ÷ 1 equipe
  assert.ok(Math.abs(a.custo_equipe! - 23000 / 22) < 1e-9)
  assert.ok(Math.abs(a.resultado_dia! - (785.07 * 0.78 - 23000 / 22)) < 1e-9)
  assert.ok(Math.abs(a.rs_por_hh! - 785.07 / 32) < 1e-9)
  assert.equal(a.dia, 'QUA')
  assert.equal(a.semana, 'S3')
})

test('06 SEMANA: "S" & INT((data − início)/7)+1; sem início da operação é "não informado"', () => {
  assert.equal(semanaOperacao('2026-08-31', '2026-08-31'), 'S1')
  assert.equal(semanaOperacao('2026-09-06', '2026-08-31'), 'S1')
  assert.equal(semanaOperacao('2026-09-07', '2026-08-31'), 'S2')
  assert.equal(semanaOperacao('2026-09-07', null), null)
})

test('10 resumo do RDO do dia (efetivo, equipes, HH, executados, R$, ocorrências)', () => {
  const d = base()
  const s = servico()
  d.servicos = [s]; d.ordens = [os(s.id)]; d.medicoes = [medicao(s.id)]
  d.apontamentos = [apont('2026-09-16'), apont('2026-09-16', { equipe: 'BER-B', n_pessoas: 3 })]
  const ctx = montarContexto(d, null, '2026-09-16')
  const r = rdoResumoDia('2026-09-16', ctx)
  assert.equal(r.efetivo, 7)
  assert.equal(r.equipes, 2)
  assert.equal(r.hh, 56)
  assert.equal(r.servicos_executados, 1)
  assert.equal(r.valor_produzido, 785.07)
  assert.equal(r.texto_ocorrencias, 'Sem ocorrências')
  assert.equal(rdoResumoDia('2026-09-17', ctx).efetivo, null)
})

test('15 atas: nº da ata pela data; dias em aberto só com pendência não concluída', () => {
  const ata = { id: 'a', projeto_id: P, data: '2026-09-15', hora: null, tipo: null, local: null, participantes_wcr: null,
    participantes_ext: null, assunto: 'x', falado: null, decisao: null, pendencia: 'fazer', responsavel: null, prazo: null,
    prioridade: null, status: 'ABERTA', gera_pleito: null, link_gravacao: null, transcricao: null, porque: null, onde: null,
    como: null, quanto: null, ordem: 1 }
  assert.deepEqual(ataCalc(ata, '2026-09-20'), { n_ata: 'ATA-20260915', dias_em_aberto: 5 })
  assert.equal(ataCalc({ ...ata, status: 'CONCLUÍDA' }, '2026-09-20').dias_em_aberto, null)
  assert.equal(ataCalc({ ...ata, pendencia: null }, '2026-09-20').dias_em_aberto, null)
})

test('16 lookahead: conta os "NÃO" e diz a situação', () => {
  const lk = { id: 'l', projeto_id: P, servico_id: 's', semana: '2026-09-07', material_ok: 'NÃO', equipamento_ok: 'SIM',
    mao_de_obra_ok: null, os_emitida: 'não', licenca_ok: 'SIM', acesso_ok: 'SIM', responsavel: null, prazo: null, lps_restricao_id: null }
  const c = lookaheadCalc(lk)
  assert.equal(c.pendencias, 2)
  assert.equal(c.situacao, 'COM RESTRIÇÃO — 2 pendência(s)')
  assert.deepEqual(c.pendentes, ['Material', 'OS emitida'])
  assert.equal(lookaheadCalc({ ...lk, material_ok: 'SIM', os_emitida: 'SIM' }).situacao, 'LIVRE PARA PROGRAMAR')
})

test('18 planejado × realizado da semana: leitura pelo PPC', () => {
  const d = base()
  const s = servico()
  d.servicos = [s]
  d.programacoes = [prog(s.id, '2026-09-08', { executou: 'SIM', h_previstas: 8 }), prog(servico().id, '2026-09-09', { h_previstas: 8 })]
  d.apontamentos = [apont('2026-09-08', { n_pessoas: 2, h_normais: 10 })]
  d.plano = [{ id: 'pl', projeto_id: P, op_servico_id: s.id, semana: '2026-09-07', semana_iso: '2026-W37', equipe: null,
    compromisso: null, concluido: 'SIM', data_conclusao: null, causa_nc: null, reprogramado_para: null, observacao: null }]
  const ctx = montarContexto(d, null, '2026-09-16')
  const w = planejadoRealizadoSemana('2026-09-07', ctx)
  assert.equal(w.programados, 2)
  assert.equal(w.executados, 1)
  assert.equal(w.hh_previsto, 16)
  assert.equal(w.hh_apontado, 20)
  assert.ok(Math.abs(w.desvio_hh! - 0.25) < 1e-9)
  assert.equal(w.ppc, 1)
  assert.equal(w.leitura, 'Semana boa')
})

test('08 ALERTA: vencido afasta da frente; vence em 30 dias; lista só de ativos, mais urgente primeiro', () => {
  const v = (pessoa_id: string, tipo: PessoaVencimento['tipo'], vence_em: string): PessoaVencimento => ({ id: id('v'), pessoa_id, tipo, vence_em })
  const hoje = '2026-09-16'
  assert.equal(alertaPessoa([v('a', 'ASO', '2026-09-10')], hoje), 'VENCIDO — AFASTAR DA FRENTE')
  assert.equal(alertaPessoa([v('a', 'NR35', '2026-10-10')], hoje), 'VENCE EM 30 DIAS')
  assert.equal(alertaPessoa([v('a', 'CNH', '2027-10-10')], hoje), 'OK')
  const membros: OpEquipeMembro[] = [
    { id: 'm1', projeto_id: P, pessoa_id: 'a', matricula: 'BER-001', equipe: 'BER-A', funcao: null, admissao: null, ativo: true, pessoa_nome: 'Pessoa 01' },
    { id: 'm2', projeto_id: P, pessoa_id: 'b', matricula: 'BER-002', equipe: 'BER-A', funcao: null, admissao: null, ativo: false, pessoa_nome: 'Pessoa 02' },
  ]
  const al = alertasEquipe(membros, [v('a', 'NR35', '2026-10-10'), v('a', 'ASO', '2026-09-10'), v('b', 'ASO', '2026-09-01')], hoje)
  assert.deepEqual(al.map((x) => [x.pessoa, x.documento, x.dias]), [['Pessoa 01', 'ASO', -6], ['Pessoa 01', 'NR35', 24]])
})

// ─── datas sem fuso ─────────────────────────────────────────────────────────

test('datas: serial do Excel ↔ ISO sem fuso; data impossível é recusada', () => {
  assert.equal(serialParaISO(45658), '2025-01-01')
  assert.equal(serialParaISO(isoParaSerial('2026-08-31')), '2026-08-31')
  assert.equal(serialParaISO(46266.99), '2026-09-01')   // hora não empurra para o dia seguinte
  assert.equal(textoParaISO('31/02/2026'), null)
  assert.equal(textoParaISO('1/9/26'), '2026-09-01')
  assert.equal(fimDoMes('2028-02-10'), '2028-02-29')
  assert.equal(segundaDaSemana('2026-09-13'), '2026-09-07')   // domingo → segunda anterior
  assert.equal(semanaIso('2026-09-16'), '2026-W38')
  assert.equal(semanaIso('2027-01-01'), '2026-W53')
  assert.equal(addDias('2026-12-31', 1), '2027-01-01')
})

// ─── formulário (telas.ts) ──────────────────────────────────────────────────

test('formulário: em branco grava null (nunca 0); "0" grava 0; mês vira 1º dia; semana vira 2ª feira', async () => {
  const { converterEntrada, normalizarValores } = await import('./telas')
  assert.deepEqual(converterEntrada('', 'numero'), { valor: null })
  assert.deepEqual(converterEntrada('0', 'numero'), { valor: 0 })
  assert.deepEqual(converterEntrada('1.234,56', 'numero'), { valor: 1234.56 })
  assert.ok('erro' in converterEntrada('abc', 'numero'))
  assert.deepEqual(converterEntrada('31/08/2026', 'data'), { valor: '2026-08-31' })
  assert.ok('erro' in converterEntrada('31/02/2026', 'data'))
  assert.deepEqual(converterEntrada('nao', 'sn'), { valor: 'NÃO' })
  assert.deepEqual(converterEntrada('', 'bool'), { valor: null })
  assert.equal(normalizarValores('faturamento', { mes: '2026-09-17' }).mes, '2026-09-01')
  assert.equal(normalizarValores('lookahead', { semana: '2026-09-17' }).semana, '2026-09-14')
  assert.equal(normalizarValores('servicos', { data_solicitacao: '2026-09-17' }).data_solicitacao, '2026-09-17')
})

// ─── datas digitadas por cima da fórmula (planilha preenchida) ─────────────

test('09 G digitada decide o MÊS DE MEDIÇÃO e o R$ do dia; vazia, vale a conclusão da OS', async () => {
  const { dataExecucaoDoItem, medidoNoPeriodo, totaisPorBoletim } = await import('./calculos')
  const d = base()
  const s = servico()
  d.servicos = [s]
  d.ordens = [os(s.id, { data_inicio: '2026-09-30', data_conclusao: '2026-09-30' })]
  d.medicoes = [
    medicao(s.id),                                                        // sem G digitada → 30/09 (OS)
    medicao(s.id, { ordem: 2, data_execucao_digitada: '2026-10-01', n_boletim: 'BM-10/2026' }),
  ]
  const ctx = montarContexto(d, null, '2026-10-05')
  assert.equal(dataExecucaoDoItem(d.medicoes[0], ctx.idx), '2026-09-30')
  assert.equal(dataExecucaoDoItem(d.medicoes[1], ctx.idx), '2026-10-01')
  assert.equal(medicaoCalc(d.medicoes[1], ctx.idx).mes, '2026-10-31')
  // faturamento de setembro só leva o item cuja execução é de setembro
  assert.equal(medidoNoPeriodo(ctx.idx, '2026-09-01', '2026-10-01'), 785.07)
  assert.equal(medidoNoPeriodo(ctx.idx, '2026-10-01', '2026-11-01'), 785.07)
  assert.equal(medidoNoPeriodo(ctx.idx, '2026-10-01', '2026-10-02', { equipe: 'BER-A' }), 785.07)
  assert.deepEqual(totaisPorBoletim(ctx.idx).map((t) => [t.boletim, t.itens, t.valor]), [['BM-09/2026', 1, 785.07], ['BM-10/2026', 1, 785.07]])
})

test('03 R digitada: o serviço conta como EXECUTADO na data digitada, mesmo sem OS concluída', () => {
  const d = base()
  const s = servico({ data_solicitacao: '2026-09-10', data_execucao_digitada: '2026-09-12' })
  d.servicos = [s]
  d.ordens = [os(s.id, { data_conclusao: null })]
  const ctx = montarContexto(d, null, '2026-09-20')
  const c = servicoCalc(s, ctx.idx, ctx.p, ctx.hoje)
  assert.equal(c.data_execucao, '2026-09-12')
  assert.equal(c.status, 'EXECUTADO')
  assert.equal(c.situacao_prazo, 'NO PRAZO')
  assert.equal(c.dias_em_aberto, 2)
})
