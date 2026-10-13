/**
 * calculos.ts — as FÓRMULAS da planilha CONTROLE OPERACIONAL rev16, uma função
 * por coluna calculada, com a aba/coluna de origem no comentário. Porta 1:1 do
 * `app/services.py` do SAAS_CONTROLE_WCR.
 *
 * ONDE A PLANILHA E O PYTHON DIVERGEM, VALE A PLANILHA (cada caso tem teste em
 * calculos.test.ts explicando). Resumo:
 *   - 03 DATA PROGRAMADA = a PRIMEIRA programação (MATCH), não a mais recente.
 *   - 03 EQUIPE DESIGNADA = equipe da OS se existe OS; senão a da primeira programação.
 *   - 09 VALOR = ROUND(QTD × PREÇO; 2) — o Python não arredondava.
 *   - 05 STATUS DA OS = CANCELADA / MEDIDA / EM EXECUÇÃO / AGUARDANDO PAVIMENTO / CONCLUÍDA
 *     (o Python inventou ABERTA / EM ANDAMENTO / CONCLUÍDA).
 *   - 12 STATUS = RECEBIDA / RECEBIDA PARCIAL / EM ATRASO / NF EMITIDA / A FATURAR;
 *     DIAS DE ATRASO conta até hoje quando não recebeu; MARGEM = resultado ÷ medição BRUTA.
 *   - 17 Pareto conta todas as causas lançadas (COUNTIF), não só as de "NÃO".
 *   - 01 margem: `margem or 0.2` do Python transforma 0 em 20% — aqui 0 é 0 e vazio é "não informado".
 *   - 13 resumo: programação filtrada pela obra do SERVIÇO (o Python comparava `n[:3]`).
 *
 * REGRAS DO PRODUTO APLICADAS AQUI
 *   - Vazio nunca é zero: entrada não informada devolve `null` ("—" na tela), não 0.
 *   - Metro não soma com unidade: quantidades só somam dentro da mesma UN.
 *   - Tudo recebe `hoje` por parâmetro (nada de TODAY() escondido) — testável.
 *
 * Indexado por Map: nenhuma função varre a lista inteira por linha (sem N+1).
 * IMPORTS RELATIVOS e zero Supabase: roda no Node (node:test).
 */
import type {
  DadosOp, FolhaAgregada, OpApontamento, OpAta, OpEquipeMembro, OpFaturamento, OpLookahead,
  OpMedicaoItem, OpOcorrencia, OpOrdemServico, OpParametros, OpPlanoItem, OpPreco, OpProgramacao,
  OpServico, OpTributo, OpCustoItem, PessoaVencimento, ISODate,
} from './tipos'
import {
  addDias, diffDias, fimDoMes, inicioDoMes, proximoMes, diaDaSemana, segundaDaSemana, ehISO,
} from './datas'
import { arred2, ehSim, normCabecalho, normChave } from './normalizar'

type Vivo = { deleted_at?: string | null }
const vivos = <T extends Vivo>(xs: T[]): T[] => xs.filter((x) => !x.deleted_at)

function empurrar<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const l = m.get(k)
  if (l) l.push(v)
  else m.set(k, [v])
}

const somaDefinidos = (xs: (number | null | undefined)[]): number =>
  xs.reduce<number>((s, x) => (x === null || x === undefined ? s : s + x), 0)

const div = (a: number | null, b: number | null): number | null =>
  a === null || b === null || b === 0 ? null : a / b

const mesmaEquipe = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && normCabecalho(a) === normCabecalho(b)

// ═══════════════════════════ ÍNDICE ═══════════════════════════════════════

export interface Indice {
  servicos: OpServico[]
  servicoPorId: Map<string, OpServico>
  servicoPorCodigo: Map<string, OpServico>
  osPorServico: Map<string, OpOrdemServico>
  ordens: OpOrdemServico[]
  /** ordenadas pela data, da mais antiga para a mais nova */
  progsPorServico: Map<string, OpProgramacao[]>
  programacoes: OpProgramacao[]
  precoPorChave: Map<string, OpPreco>
  medicoesPorServico: Map<string, OpMedicaoItem[]>
  medicoes: OpMedicaoItem[]
  valorItem: Map<string, number | null>
  apontamentos: OpApontamento[]
  ocorrencias: OpOcorrencia[]
  plano: OpPlanoItem[]
}

export function indexar(d: DadosOp): Indice {
  const servicos = vivos(d.servicos)
  const servicoPorId = new Map<string, OpServico>()
  const servicoPorCodigo = new Map<string, OpServico>()
  for (const s of servicos) {
    servicoPorId.set(s.id, s)
    servicoPorCodigo.set(normCabecalho(s.codigo), s)
  }
  const ordens = vivos(d.ordens)
  const osPorServico = new Map<string, OpOrdemServico>()
  for (const o of ordens) if (!osPorServico.has(o.servico_id)) osPorServico.set(o.servico_id, o)

  const programacoes = vivos(d.programacoes)
  const progsPorServico = new Map<string, OpProgramacao[]>()
  for (const p of programacoes) empurrar(progsPorServico, p.servico_id, p)
  for (const l of progsPorServico.values()) l.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))

  // PROCV devolve a PRIMEIRA chave repetida
  const precoPorChave = new Map<string, OpPreco>()
  for (const p of vivos(d.precos)) {
    const k = normCabecalho(p.chave)
    if (!precoPorChave.has(k)) precoPorChave.set(k, p)
  }

  const medicoes = vivos(d.medicoes)
  const medicoesPorServico = new Map<string, OpMedicaoItem[]>()
  const valorItem = new Map<string, number | null>()
  for (const m of medicoes) {
    empurrar(medicoesPorServico, m.servico_id, m)
    valorItem.set(m.id, valorDoItemCom(m, precoPorChave))
  }

  return {
    servicos, servicoPorId, servicoPorCodigo, osPorServico, ordens, progsPorServico, programacoes,
    precoPorChave, medicoesPorServico, medicoes, valorItem,
    apontamentos: vivos(d.apontamentos), ocorrencias: vivos(d.ocorrencias), plano: vivos(d.plano),
  }
}

// ═══════════════════════════ ABA 09 — MEDIÇÃO ═════════════════════════════

function valorDoItemCom(m: OpMedicaoItem, precos: Map<string, OpPreco>): number | null {
  // aba 09, coluna M VALOR = ROUND(K × L; 2)
  // A planilha usa PREÇO 0 quando o código não existe (IFERROR(…;0)); aqui fica null:
  // código não encontrado não é "vale zero", é "não dá para saber".
  const pr = precos.get(normCabecalho(m.cod_preco))
  if (!pr || pr.preco === null || m.qtd === null) return null
  return arred2(m.qtd * pr.preco)
}

export function valorDoItem(m: OpMedicaoItem, idx: Indice): number | null {
  return idx.valorItem.has(m.id) ? idx.valorItem.get(m.id)! : valorDoItemCom(m, idx.precoPorChave)
}

export interface MedicaoCalc {
  mes: ISODate | null
  n_os_sabesp: string | null
  servico_codigo: string | null
  equipe: string | null
  data_execucao: ISODate | null
  descricao: string
  un: string | null
  preco: number | null
  valor: number | null
  valor_aprovado: number | null
  codigo_encontrado: boolean
}

/**
 * aba 09, coluna G DATA DE EXECUÇÃO = PROCV na OS (data de conclusão). Na planilha preenchida
 * a coluna foi DIGITADA por cima em várias linhas: onde há valor digitado, vale ele (é o que
 * o SUMIFS da planilha enxerga); vazio = conclusão da OS, como a fórmula.
 */
export function dataExecucaoDoItem(m: OpMedicaoItem, idx: Indice): ISODate | null {
  return m.data_execucao_digitada ?? idx.osPorServico.get(m.servico_id)?.data_conclusao ?? null
}

export function medicaoCalc(m: OpMedicaoItem, idx: Indice): MedicaoCalc {
  const s = idx.servicoPorId.get(m.servico_id) ?? null
  const o = idx.osPorServico.get(m.servico_id) ?? null
  const pr = idx.precoPorChave.get(normCabecalho(m.cod_preco)) ?? null
  const valor = valorDoItem(m, idx)
  const exec = dataExecucaoDoItem(m, idx)
  return {
    // aba 09, coluna B MÊS DE MEDIÇÃO = EOMONTH(G; 0)
    mes: exec ? fimDoMes(exec) : null,
    // aba 09, colunas D/E = PROCV no cadastro (aba 03)
    n_os_sabesp: s?.n_os_sabesp ?? null,
    servico_codigo: s?.codigo ?? null,
    // aba 09, coluna F = PROCV na OS (aba 05); G = conclusão da OS ou o digitado por cima
    equipe: o?.equipe ?? null,
    data_execucao: exec,
    // aba 09, coluna I = PROCV na tabela de preços; IFERROR → "CÓDIGO NÃO ENCONTRADO"
    descricao: pr ? (pr.descricao ?? '') : 'CÓDIGO NÃO ENCONTRADO',
    un: pr?.un ?? null,
    preco: pr?.preco ?? null,
    valor,
    // aba 09, coluna R VALOR APROVADO = M − P. Glosa em branco = nenhuma glosa lançada
    // (é o que a fórmula faz); não gravamos 0 em lugar nenhum.
    valor_aprovado: valor === null ? null : arred2(valor - (m.valor_glosado ?? 0)),
    codigo_encontrado: !!pr,
  }
}

/** total por Nº de boletim (itens com valor, R$, itens sem valor calculável) */
export function totaisPorBoletim(idx: Indice): { boletim: string | null; itens: number; valor: number; sem_valor: number }[] {
  const m = new Map<string, { boletim: string | null; itens: number; valor: number; sem_valor: number }>()
  for (const it of idx.medicoes) {
    const k = it.n_boletim ?? ''
    const t = m.get(k) ?? { boletim: it.n_boletim, itens: 0, valor: 0, sem_valor: 0 }
    const v = valorDoItem(it, idx)
    if (v === null) t.sem_valor++
    else { t.itens++; t.valor += v }
    m.set(k, t)
  }
  return [...m.values()].map((t) => ({ ...t, valor: arred2(t.valor) })).sort((a, b) => String(a.boletim).localeCompare(String(b.boletim)))
}

/** metro não soma com unidade: total de QTD por UN */
export function quantidadesPorUnidade(itens: OpMedicaoItem[], idx: Indice): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of itens) {
    if (m.qtd === null) continue
    const un = idx.precoPorChave.get(normCabecalho(m.cod_preco))?.un
    const k = un ? un.trim() : '(sem unidade)'
    out.set(k, (out.get(k) ?? 0) + m.qtd)
  }
  return out
}

// ═══════════════════════════ ABA 03 — SERVIÇO ═════════════════════════════

/** aba 03, coluna F DATA LIMITE = D + IF(E=""; '01'!C22; E) */
export function dataLimite(s: OpServico, p: OpParametros | null): ISODate | null {
  const prazo = s.prazo_dias ?? p?.prazo_padrao_dias ?? null
  if (!s.data_solicitacao || prazo === null) return null
  return addDias(s.data_solicitacao, Math.trunc(prazo))
}

export type StatusServico = 'MEDIDO' | 'EXECUTADO' | 'EM EXECUÇÃO' | 'PROGRAMADO' | 'CADASTRADO' | string
export type SituacaoPrazo = 'NO PRAZO' | 'FORA DO PRAZO' | 'VENCIDO' | 'VENCE EM BREVE' | 'EM DIA'

export interface ServicoCalc {
  equipe: string | null
  data_programada: ISODate | null
  data_execucao: ISODate | null
  status: StatusServico
  dias_em_aberto: number | null
  data_limite: ISODate | null
  situacao_prazo: SituacaoPrazo | null
  valor_medido: number
  /** algum item de medição sem valor (código não encontrado ou QTD vazia) */
  valor_medido_incompleto: boolean
}

export function valorMedidoServico(servicoId: string, idx: Indice): { valor: number; incompleto: boolean } {
  // aba 03, coluna V VALOR MEDIDO = SUMIFS(MED_VLR; MED_ID; A)
  const itens = idx.medicoesPorServico.get(servicoId) ?? []
  let valor = 0, incompleto = false
  for (const m of itens) {
    const v = valorDoItem(m, idx)
    if (v === null) incompleto = true
    else valor += v
  }
  return { valor: arred2(valor), incompleto }
}

export function servicoCalc(s: OpServico, idx: Indice, p: OpParametros | null, hoje: ISODate): ServicoCalc {
  const os = idx.osPorServico.get(s.id) ?? null
  const progs = idx.progsPorServico.get(s.id) ?? []
  const primeira = progs[0] ?? null
  const { valor, incompleto } = valorMedidoServico(s.id, idx)

  // aba 03, coluna P EQUIPE DESIGNADA: se há OS, a equipe da OS; senão a da (primeira) programação
  const equipe = os ? (os.equipe ?? null) : (primeira?.equipe ?? null)
  // aba 03, coluna Q DATA PROGRAMADA = INDEX(PROG_DATA; MATCH(A; PROG_ID; 0)) → a PRIMEIRA.
  // No banco não há "ordem de linha": a primeira é a de menor data (a programação original).
  const data_programada = primeira?.data ?? null
  // aba 03, coluna R DATA DE EXECUÇÃO = data de conclusão da OS — ou o que foi digitado por cima
  const data_execucao = s.data_execucao_digitada ?? os?.data_conclusao ?? null

  // aba 03, coluna S STATUS
  let status: StatusServico
  if (s.tratativa_manual) status = s.tratativa_manual
  else if (valor > 0) status = 'MEDIDO'
  else if (data_execucao) status = 'EXECUTADO'
  else if (os) status = 'EM EXECUÇÃO'
  else if (data_programada) status = 'PROGRAMADO'
  else status = 'CADASTRADO'

  // aba 03, coluna T DIAS EM ABERTO = IF(R<>""; R − D; TODAY() − D)
  const dias_em_aberto = s.data_solicitacao ? diffDias(data_execucao ?? hoje, s.data_solicitacao) : null

  // aba 03, coluna U SITUAÇÃO DO PRAZO
  const dl = dataLimite(s, p)
  let situacao_prazo: SituacaoPrazo | null = null
  if (dl) {
    if (data_execucao) situacao_prazo = data_execucao <= dl ? 'NO PRAZO' : 'FORA DO PRAZO'
    else if (hoje > dl) situacao_prazo = 'VENCIDO'
    // F − TODAY() <= C23. Alerta em branco: só o próprio dia do vencimento acende
    // (é o que a fórmula faz com a célula vazia); nada é gravado como 0.
    else if (diffDias(dl, hoje) <= (p?.alerta_prazo_dias ?? 0)) situacao_prazo = 'VENCE EM BREVE'
    else situacao_prazo = 'EM DIA'
  }

  return {
    equipe, data_programada, data_execucao, status, dias_em_aberto, data_limite: dl,
    situacao_prazo, valor_medido: valor, valor_medido_incompleto: incompleto,
  }
}

export const STATUS_BACKLOG = new Set(['CADASTRADO', 'PROGRAMADO', 'EM EXECUÇÃO'])

// ═══════════════════════════ ABA 04 — PROGRAMAÇÃO ═════════════════════════

export interface ProgramacaoCalc { status: string; aderencia: string | null }

export function programacaoCalc(pr: OpProgramacao): ProgramacaoCalc {
  // aba 04, coluna P STATUS DO ITEM
  let status: string
  if (ehSim(pr.executou)) status = 'EXECUTADO'
  else if (pr.reprogramar_para) status = 'REPROGRAMADO'
  else if (normCabecalho(pr.executou) === 'NAO') status = 'NÃO EXECUTADO'
  else status = 'PROGRAMADO'
  // aba 04, coluna Q ADERÊNCIA = IF(L="SIM"; IF(M=A; "NO DIA"; "FORA DO DIA"); "")
  const aderencia = ehSim(pr.executou) ? (pr.data_execucao === pr.data ? 'NO DIA' : 'FORA DO DIA') : null
  return { status, aderencia }
}

// ═══════════════════════════ ABA 05 — ORDEM DE SERVIÇO ════════════════════

export interface OsCalc {
  dias: number | null
  n_itens: number
  valor: number
  mes_medicao: ISODate | null
  status: string
  pronta_para_medir: boolean
}

export function osCalc(o: OpOrdemServico, idx: Indice): OsCalc {
  const itens = idx.medicoesPorServico.get(o.servico_id) ?? []
  // aba 05, coluna S VALOR DA OS = SUMIFS(MED_VLR; MED_ID; A)
  const valor = valorMedidoServico(o.servico_id, idx).valor
  // aba 05, coluna K DIAS = J − I + 1
  const dias = o.data_inicio && o.data_conclusao ? diffDias(o.data_conclusao, o.data_inicio) + 1 : null
  // aba 05, coluna U STATUS DA OS (planilha):
  //   IF(V="CANCELADA";"CANCELADA"; IF(S>0;"MEDIDA"; IF(J="";"EM EXECUÇÃO";
  //   IF(OR(N="NÃO";O="NÃO";P="NÃO");"AGUARDANDO PAVIMENTO";"CONCLUÍDA"))))
  let status: string
  if (normCabecalho(o.pendencia) === 'CANCELADA') status = 'CANCELADA'
  else if (valor > 0) status = 'MEDIDA'
  else if (!o.data_conclusao) status = 'EM EXECUÇÃO'
  else if ([o.pavimento_reposto, o.foto_antes, o.foto_depois].some((x) => normCabecalho(x) === 'NAO')) {
    status = 'AGUARDANDO PAVIMENTO'
  } else status = 'CONCLUÍDA'
  // "pronta para medir" NÃO existe na planilha — veio do app Python e fica como leitura
  // auxiliar: concluída, foto antes e depois SIM, pavimento SIM, N/A ou não informado.
  const pav = normCabecalho(o.pavimento_reposto)
  const pronta_para_medir = !!o.data_conclusao && ehSim(o.foto_antes) && ehSim(o.foto_depois)
    && (pav === 'SIM' || pav === 'N/A' || pav === '')
  return {
    dias, n_itens: itens.length, valor, status, pronta_para_medir,
    // aba 05, coluna T MÊS DE MEDIÇÃO = EOMONTH(J; 0)
    mes_medicao: o.data_conclusao ? fimDoMes(o.data_conclusao) : null,
  }
}

// ═══════════════════════════ PRODUÇÃO (base de todo "R$ produzido") ═══════

/**
 * Soma VALOR dos itens de medição executados em [ini, fimExcl).
 * É a MED_DATA / MED_MES da planilha: coluna G da aba 09 (conclusão da OS, ou o digitado
 * por cima). Item sem data de execução não entra (na planilha G fica "" e nenhum SUMIFS o pega).
 * O filtro de equipe usa a coluna F (MED_EQUIPE = equipe da OS).
 */
export function medidoNoPeriodo(
  idx: Indice, ini: ISODate, fimExcl: ISODate, filtro: { equipe?: string | null } = {},
): number {
  let tot = 0
  for (const m of idx.medicoes) {
    const exec = dataExecucaoDoItem(m, idx)
    if (!exec || exec < ini || exec >= fimExcl) continue
    if (filtro.equipe !== undefined && !mesmaEquipe(idx.osPorServico.get(m.servico_id)?.equipe, filtro.equipe)) continue
    const v = valorDoItem(m, idx)
    if (v !== null) tot += v
  }
  return arred2(tot)
}

function glosaNoPeriodo(idx: Indice, ini: ISODate, fimExcl: ISODate): number {
  let tot = 0
  for (const m of idx.medicoes) {
    const exec = dataExecucaoDoItem(m, idx)
    if (!exec || exec < ini || exec >= fimExcl) continue
    tot += m.valor_glosado ?? 0
  }
  return arred2(tot)
}

// ═══════════════════════════ ABAS 01A / 08 — CUSTO ════════════════════════

/** aba 01A, C47 TOTAL DE TRIBUTOS = SUM(C40:C46). Sem tributo cadastrado = não informado. */
export function impostoTotal(tributos: OpTributo[]): number | null {
  const vs = vivos(tributos).filter((t) => t.aliquota !== null)
  if (vs.length === 0) return null
  return Math.round(somaDefinidos(vs.map((t) => t.aliquota)) * 1e10) / 1e10
}

/**
 * aba 01, C24 Nº DE EQUIPES = equipes com pelo menos uma pessoa ATIVA ("SIM").
 * A planilha lista BER-A…D; aqui conta qualquer equipe nomeada, menos APOIO.
 */
export function nEquipesAtivas(membros: OpEquipeMembro[]): number {
  const s = new Set<string>()
  for (const m of vivos(membros)) {
    if (m.ativo !== true || !m.equipe) continue
    const e = normCabecalho(m.equipe)
    if (e && e !== 'APOIO') s.add(e)
  }
  return s.size
}

export interface FolhaCalc {
  /** R$/mês; null quando falta fator/benefício ou a soma dos salários não está disponível */
  valor: number | null
  n_ativos: number
  n_com_salario: number | null
  n_sem_salario: number | null
}

/**
 * aba 01A, E15 = SUMIFS(EQP_CUSTOMES; contrato; ATIVO="SIM")
 * aba 08, J CUSTO/MÊS = SALÁRIO + ROUND(SALÁRIO × ENC_FATOR; 2) + BEN_PESSOA
 * Somado: Σsalário × (1 + fator) + benefício × nº de ativos (a planilha cobra o
 * benefício de todo ativo, com ou sem salário). O arredondamento por pessoa da
 * planilha dá no máximo meio centavo por pessoa de diferença.
 * Ativo sem salário informado NÃO vira salário zero: sai em `n_sem_salario`.
 */
export function folhaMensal(membros: OpEquipeMembro[], folha: FolhaAgregada | null, p: OpParametros | null): FolhaCalc {
  const ativos = new Set(vivos(membros).filter((m) => m.ativo === true).map((m) => m.pessoa_id))
  const n_ativos = ativos.size
  if (n_ativos === 0) return { valor: 0, n_ativos: 0, n_com_salario: 0, n_sem_salario: 0 }
  if (!folha) return { valor: null, n_ativos, n_com_salario: null, n_sem_salario: null }
  const fator = p?.fator_encargos ?? null
  const ben = p?.beneficios_pessoa ?? null
  const valor = fator === null || ben === null ? null : arred2(folha.soma_salario * (1 + fator) + ben * n_ativos)
  return { valor, n_ativos, n_com_salario: folha.n_com_salario, n_sem_salario: Math.max(0, n_ativos - folha.n_com_salario) }
}

export interface CustoCalc {
  itens: number
  folha: number | null
  /** 01A TOTAL MENSAL; null se a folha não pôde ser calculada */
  total: number | null
  pendencias: string[]
}

/** aba 01A, E16 TOTAL MENSAL = Σ (QTD × VALOR UNIT.) + folha da equipe */
export function custoMensal(custos: OpCustoItem[], folha: FolhaCalc): CustoCalc {
  const pendencias: string[] = []
  let itens = 0
  for (const c of vivos(custos)) {
    if (c.qtd === null || c.valor_unit === null) {
      pendencias.push(`${c.item}: ${c.qtd === null ? 'QTD' : 'VALOR UNIT.'} não informado`)
      continue
    }
    itens += c.qtd * c.valor_unit
  }
  if (folha.valor === null) pendencias.push('folha da equipe não calculável (fator de encargos, benefício ou salários indisponíveis)')
  if (folha.n_sem_salario) pendencias.push(`${folha.n_sem_salario} pessoa(s) ativa(s) sem salário informado`)
  itens = arred2(itens)
  return { itens, folha: folha.valor, total: folha.valor === null ? null : arred2(itens + folha.valor), pendencias }
}

// ═══════════════════════════ ABA 01 — BLOCO C (METAS) ═════════════════════

export interface Metas {
  custo_mes: number | null
  custo_dia: number | null
  n_equipes: number
  custo_equipe_dia: number | null
  margem: number | null
  imposto: number | null
  meta_mes: number | null
  meta_equipe_dia: number | null
  equilibrio_mes: number | null
}

export function metas(p: OpParametros | null, custo: number | null, nEquipes: number, imposto: number | null): Metas {
  const du = p?.dias_uteis_mes ?? null
  const margem = p?.margem_alvo ?? null          // 0 é 0; vazio é "não informado"
  const neq = nEquipes > 0 ? nEquipes : null     // #DIV/0! na planilha → não calculável
  // aba 01, C30 custo por dia útil = C29 / C20
  const custo_dia = div(custo, du)
  // aba 01, C31 custo por equipe por dia = C30 / C24
  const custo_equipe_dia = div(custo_dia, neq)
  // aba 01, C34 meta de medição bruta = custo × (1 + margem) ÷ (1 − imposto)
  const meta_mes = custo === null || margem === null || imposto === null || imposto >= 1
    ? null : custo * (1 + margem) / (1 - imposto)
  return {
    custo_mes: custo, custo_dia, n_equipes: nEquipes, custo_equipe_dia, margem, imposto, meta_mes,
    // aba 01, C38 meta de R$ por equipe/dia = C34 / C20 / C24
    meta_equipe_dia: div(div(meta_mes, du), neq),
    // equilíbrio em R$ (a C39 da planilha é em serviços/dia e depende do ticket da 01B)
    equilibrio_mes: custo === null || imposto === null || imposto >= 1 ? null : custo / (1 - imposto),
  }
}

// ═══════════════════════════ CONTEXTO ═════════════════════════════════════

export interface ContextoCalculo {
  dados: DadosOp
  idx: Indice
  p: OpParametros | null
  hoje: ISODate
  folha: FolhaCalc
  custo: CustoCalc
  imposto: number | null
  metas: Metas
}

export function montarContexto(dados: DadosOp, folhaAgregada: FolhaAgregada | null, hoje: ISODate): ContextoCalculo {
  const idx = indexar(dados)
  const p = dados.parametros && !dados.parametros.deleted_at ? dados.parametros : null
  const folha = folhaMensal(dados.membros, folhaAgregada, p)
  const custo = custoMensal(dados.custos, folha)
  const imposto = impostoTotal(dados.tributos)
  return { dados, idx, p, hoje, folha, custo, imposto, metas: metas(p, custo.total, nEquipesAtivas(dados.membros), imposto) }
}

// ═══════════════════════════ ABA 06 — APONTAMENTO ═════════════════════════

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

/** aba 06, coluna B DIA = CHOOSE(WEEKDAY(A;1); "DOM"; …) */
export function diaAbreviado(data: ISODate): string {
  return DIAS[diaDaSemana(data)]
}

/** aba 06, coluna C SEMANA = "S" & (INT((A − '01'!C12) / 7) + 1). Sem início da operação: não informado. */
export function semanaOperacao(data: ISODate, inicio: ISODate | null | undefined): string | null {
  if (!inicio) return null
  return `S${Math.floor(diffDias(data, inicio) / 7) + 1}`
}

/**
 * aba 06, coluna I HH TOTAL = F × (G + H).
 * Nº de pessoas ou horas normais em branco → não informado. Hora extra em branco
 * = sem hora extra (é o que a soma da planilha faz).
 */
export function hhDoApontamento(a: OpApontamento): number | null {
  if (a.n_pessoas === null || a.h_normais === null) return null
  return a.n_pessoas * (a.h_normais + (a.h_extras ?? 0))
}

export interface ApontamentoCalc {
  dia: string
  semana: string | null
  hh_total: number | null
  serv_programados: number | null
  serv_executados: number | null
  aderencia: number | null
  valor_produzido: number | null
  meta_dia: number | null
  atingimento: number | null
  custo_equipe: number | null
  resultado_dia: number | null
  rs_por_hh: number | null
}

export function apontamentoCalc(a: OpApontamento, ctx: ContextoCalculo): ApontamentoCalc {
  const hh = hhDoApontamento(a)
  // aba 06, colunas Q/R/T cruzam por EQUIPE. Na planilha, critério apontando para célula
  // vazia vira 0 no COUNTIFS/SUMIFS ("sem a EQUIPE, produção dá zero"). Aqui: não informado.
  let prog: number | null = null, exe: number | null = null, valor: number | null = null
  if (a.equipe) {
    // Q SERV. PROGRAMADOS = COUNTIFS(PROG_DATA; A; PROG_EQUIPE; E)
    prog = ctx.idx.programacoes.filter((p) => p.data === a.data && mesmaEquipe(p.equipe, a.equipe)).length
    // R SERV. EXECUTADOS = COUNTIFS(OS_FIM; A; OS_EQUIPE; E)
    exe = ctx.idx.ordens.filter((o) => o.data_conclusao === a.data && mesmaEquipe(o.equipe, a.equipe)).length
    // T VALOR PRODUZIDO = SUMIFS(MED_VLR; MED_DATA; A; MED_EQUIPE; E)
    valor = medidoNoPeriodo(ctx.idx, a.data, addDias(a.data, 1), { equipe: a.equipe })
  }
  const meta = ctx.metas.meta_equipe_dia          // U META R$ DO DIA = '01'!C38
  const custo = ctx.metas.custo_equipe_dia        // W CUSTO DA EQUIPE = '01'!C31
  return {
    dia: diaAbreviado(a.data),
    semana: semanaOperacao(a.data, ctx.p?.inicio_operacao),
    hh_total: hh,
    serv_programados: prog,
    serv_executados: exe,
    // S ADERÊNCIA = R / Q
    aderencia: prog ? (exe ?? 0) / prog : null,
    valor_produzido: valor,
    meta_dia: meta,
    // V ATINGIMENTO = T / U
    atingimento: div(valor, meta),
    custo_equipe: custo,
    // X RESULTADO DO DIA = T × (1 − imposto) − W
    resultado_dia: valor === null || ctx.imposto === null || custo === null ? null : valor * (1 - ctx.imposto) - custo,
    // Y R$ POR HH = T / I
    rs_por_hh: div(valor, hh),
  }
}

// ═══════════════════════════ ABA 10 — RDO (resumo calculado) ══════════════

export interface RdoResumo {
  data: ISODate
  efetivo: number | null
  equipes: number
  hh: number | null
  servicos_executados: number
  valor_produzido: number
  ocorrencias: number
  texto_ocorrencias: string
}

/** aba 10, colunas G…K e N: o que o dia teve, a partir das abas 05/06/09/11 */
export function rdoResumoDia(data: ISODate, ctx: ContextoCalculo): RdoResumo {
  const aps = ctx.idx.apontamentos.filter((a) => a.data === data)
  const hhs = aps.map(hhDoApontamento)
  const n = ctx.idx.ocorrencias.filter((o) => o.data === data).length
  return {
    data,
    // G EFETIVO EM CAMPO = SUMIFS(APT_PESSOAS; APT_DATA; B; APT_CONTR; C)
    efetivo: aps.length === 0 ? null : somaDefinidos(aps.map((a) => a.n_pessoas)),
    // H EQUIPES EM CAMPO = COUNTIFS(APT_DATA; B; APT_CONTR; C)
    equipes: aps.length,
    // I HH DO DIA = SUMIFS(APT_HH; …)
    hh: aps.length === 0 ? null : somaDefinidos(hhs),
    // J SERVIÇOS EXECUTADOS = COUNTIFS(OS_FIM; B; OS_CONTR; C)
    servicos_executados: ctx.idx.ordens.filter((o) => o.data_conclusao === data).length,
    // K VALOR PRODUZIDO = SUMIFS(MED_VLR; MED_DATA; B; MED_CONTR; C)
    valor_produzido: medidoNoPeriodo(ctx.idx, data, addDias(data, 1)),
    ocorrencias: n,
    // N OCORRÊNCIAS DO DIA
    texto_ocorrencias: n === 0 ? 'Sem ocorrências' : `${n} ocorrência(s) — ver aba 11`,
  }
}

// ═══════════════════════════ ABA 11 — OCORRÊNCIAS ═════════════════════════

export function ocorrenciaCalc(o: OpOcorrencia, hoje: ISODate): { dias_em_aberto: number | null } {
  // aba 11, coluna P DIAS EM ABERTO = IF(O<>""; O − B; TODAY() − B)
  if (!o.data) return { dias_em_aberto: null }
  return { dias_em_aberto: diffDias(o.data_encerramento ?? hoje, o.data) }
}

// ═══════════════════════════ ABA 12 — FATURAMENTO ═════════════════════════

export interface FaturamentoCalc {
  bruto: number
  glosa: number
  aprovado: number
  imposto: number | null
  desconto: number | null
  liquido: number | null
  previsto: ISODate | null
  diferenca: number | null
  dias_atraso: number | null
  status: string | null
  custo_mes: number | null
  resultado: number | null
  margem: number | null
}

export function faturamentoCalc(f: OpFaturamento, ctx: ContextoCalculo): FaturamentoCalc {
  const ini = inicioDoMes(f.mes), fim = proximoMes(f.mes)
  // aba 12, C MEDIÇÃO BRUTA = SUMIFS(MED_VLR; MED_MES; A; MED_CONTR; B)
  const bruto = medidoNoPeriodo(ctx.idx, ini, fim)
  // D GLOSA = SUMIFS(MED_GLOSA; MED_MES; A; MED_CONTR; B)
  const glosa = glosaNoPeriodo(ctx.idx, ini, fim)
  // E MEDIÇÃO APROVADA = C − D
  const aprovado = arred2(bruto - glosa)
  const semMedicao = aprovado === 0
  // H IMPOSTO = E × '01'!C16
  const imposto = ctx.imposto === null ? null : aprovado * ctx.imposto
  // I DESCONTO DO CONSÓRCIO = E × '01'!C17
  const desconto = ctx.p?.desconto_consorcio === null || ctx.p?.desconto_consorcio === undefined
    ? null : aprovado * ctx.p.desconto_consorcio
  // J VALOR LÍQUIDO = E − H − I
  const liquido = imposto === null || desconto === null ? null : aprovado - imposto - desconto
  // K RECEBIMENTO PREVISTO = A + '01'!C19 (A é o último dia do mês na planilha)
  const def = ctx.p?.defasagem_recebimento ?? null
  const previsto = def === null ? null : addDias(fimDoMes(f.mes), Math.trunc(def))
  // N DIFERENÇA = IF(M=""; ""; M − J)
  const diferenca = f.valor_recebido === null || liquido === null ? null : f.valor_recebido - liquido
  // O DIAS DE ATRASO = IF(E=0;""; IF(L<>""; MAX(0; L−K); IF(TODAY()>K; TODAY()−K; 0)))
  let dias_atraso: number | null = null
  if (!semMedicao && previsto) {
    if (f.data_recebimento) dias_atraso = Math.max(0, diffDias(f.data_recebimento, previsto))
    else dias_atraso = ctx.hoje > previsto ? diffDias(ctx.hoje, previsto) : 0
  }
  // P STATUS = IF(E=0;""; IF(M>0; IF(M>=J×0,995;"RECEBIDA";"RECEBIDA PARCIAL");
  //            IF(O>0;"EM ATRASO"; IF(F<>"";"NF EMITIDA";"A FATURAR"))))
  let status: string | null = null
  if (!semMedicao) {
    if ((f.valor_recebido ?? 0) > 0) {
      // sem líquido calculável (imposto/desconto não informados) não dá para dizer se foi parcial
      status = liquido === null ? 'RECEBIDA (líquido não calculável)'
        : f.valor_recebido! >= liquido * 0.995 ? 'RECEBIDA' : 'RECEBIDA PARCIAL'
    } else if ((dias_atraso ?? 0) > 0) status = 'EM ATRASO'
    else if (f.n_nf) status = 'NF EMITIDA'
    else status = 'A FATURAR'
  }
  // Q CUSTO DO MÊS = '01'!C29 ; R RESULTADO = J − Q ; S MARGEM = R ÷ C (sobre a BRUTA)
  const custo_mes = semMedicao ? null : ctx.custo.total
  const resultado = semMedicao || liquido === null || custo_mes === null ? null : liquido - custo_mes
  return {
    bruto, glosa, aprovado, imposto, desconto, liquido, previsto, diferenca, dias_atraso, status,
    custo_mes, resultado, margem: resultado === null || bruto === 0 ? null : resultado / bruto,
  }
}

// ═══════════════════════════ ABA 15 — ATAS ════════════════════════════════

export function ataCalc(a: OpAta, hoje: ISODate): { n_ata: string; dias_em_aberto: number | null } {
  return {
    // aba 15, coluna A Nº DA ATA = "ATA-" & TEXT(B; "yyyymmdd")
    n_ata: a.data ? `ATA-${a.data.replace(/-/g, '')}` : '',
    // aba 15, coluna Q DIAS EM ABERTO = IF(OR(B=""; L=""; P="CONCLUÍDA"); ""; TODAY() − B)
    dias_em_aberto: !a.data || !a.pendencia || normCabecalho(a.status) === 'CONCLUIDA' ? null : diffDias(hoje, a.data),
  }
}

// ═══════════════════════════ ABA 16 — LOOKAHEAD ═══════════════════════════

export const CHECKS_LOOKAHEAD = [
  ['material_ok', 'Material'], ['equipamento_ok', 'Equipamento'], ['mao_de_obra_ok', 'Mão de obra'],
  ['os_emitida', 'OS emitida'], ['licenca_ok', 'Licença / via'], ['acesso_ok', 'Acesso'],
] as const

export function lookaheadCalc(lk: OpLookahead): { pendencias: number; situacao: string; pendentes: string[] } {
  // aba 16, coluna M RESTRIÇÕES PENDENTES = COUNTIF(G:L; "NÃO")
  const pendentes = CHECKS_LOOKAHEAD.filter(([c]) => normCabecalho(lk[c]) === 'NAO').map(([, r]) => r)
  const n = pendentes.length
  return {
    pendencias: n,
    // aba 16, coluna N SITUAÇÃO
    situacao: n === 0 ? 'LIVRE PARA PROGRAMAR' : `COM RESTRIÇÃO — ${n} pendência(s)`,
    pendentes,
  }
}

// ═══════════════════════════ ABA 17 — PLANO SEMANAL / PPC ═════════════════

export function ppcSemana(plano: OpPlanoItem[], semana: ISODate): { semana: ISODate; programado: number; concluido: number; ppc: number | null } {
  const itens = vivos(plano).filter((x) => x.semana === semana && !!x.op_servico_id)
  // aba 17, O PROGRAMADO = COUNTIFS(PS_SEM; N; PS_ID; "<>") ; P CONCLUÍDO = COUNTIFS(…; PS_OK; "SIM")
  const programado = itens.length
  const concluido = itens.filter((x) => ehSim(x.concluido)).length
  // Q PPC = P / O
  return { semana, programado, concluido, ppc: programado ? concluido / programado : null }
}

/** aba 17, bloco Pareto: T = COUNTIF(PS_CAUSA; causa) — todas as causas lançadas */
export function paretoCausas(plano: OpPlanoItem[], semana?: ISODate): { causa: string; n: number; pct: number }[] {
  const c = new Map<string, number>()
  for (const x of vivos(plano)) {
    if (!x.causa_nc || (semana && x.semana !== semana)) continue
    c.set(x.causa_nc, (c.get(x.causa_nc) ?? 0) + 1)
  }
  const tot = [...c.values()].reduce((s, n) => s + n, 0)
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([causa, n]) => ({ causa, n, pct: tot ? n / tot : 0 }))
}

// ═══════════════════════════ ABA 18 — PLANEJADO × REALIZADO ═══════════════

export function semanasComDados(d: DadosOp): ISODate[] {
  const s = new Set<string>()
  for (const p of vivos(d.programacoes)) if (ehISO(p.data)) s.add(segundaDaSemana(p.data))
  for (const a of vivos(d.apontamentos)) if (ehISO(a.data)) s.add(segundaDaSemana(a.data))
  return [...s].sort()
}

export interface PrSemana {
  semana: ISODate
  programados: number
  executados: number
  aderencia: number | null
  ppc: number | null
  hh_previsto: number
  hh_apontado: number
  desvio_hh: number | null
  rs_medido: number
  meta_semana: number | null
  atingimento: number | null
  leitura: string
}

export function planejadoRealizadoSemana(seg: ISODate, ctx: ContextoCalculo): PrSemana {
  const fim = addDias(seg, 7)
  const progs = ctx.idx.programacoes.filter((p) => p.data >= seg && p.data < fim)
  // C SERVIÇOS PROGRAMADOS ; D EXECUTADOS (PROG_EXEC = "SIM")
  const programados = progs.length
  const executados = progs.filter((p) => ehSim(p.executou)).length
  // F PPC DA SEMANA
  const ppc = ppcSemana(ctx.dados.plano, seg).ppc
  // G HH PREVISTO = SUMIFS(PROG_HPREV) ; H HH APONTADO = SUMIFS(APT_HH)
  const hh_previsto = somaDefinidos(progs.map((p) => p.h_previstas))
  const hh_apontado = somaDefinidos(ctx.idx.apontamentos.filter((a) => a.data >= seg && a.data < fim).map(hhDoApontamento))
  // J R$ MEDIDO NA SEMANA = SUMIFS(MED_VLR; MED_DATAEX na semana)
  const rs_medido = medidoNoPeriodo(ctx.idx, seg, fim)
  // K META R$ DA SEMANA = meta do mês ÷ 4,33
  const meta_semana = ctx.metas.meta_mes === null ? null : ctx.metas.meta_mes / 4.33
  // M LEITURA (texto da planilha)
  let leitura: string
  if (ppc === null) leitura = 'sem plano semanal lançado'
  else if (ppc >= 0.85) leitura = 'Semana boa'
  else if (ppc >= 0.7) leitura = 'Atenção — veja as causas na aba 17'
  else leitura = 'PPC baixo — plano não está sendo cumprido'
  return {
    semana: seg, programados, executados, aderencia: programados ? executados / programados : null, ppc,
    hh_previsto, hh_apontado,
    // I DESVIO DE HH = H / G − 1
    desvio_hh: hh_previsto ? hh_apontado / hh_previsto - 1 : null,
    rs_medido, meta_semana,
    // L ATINGIMENTO = J / K
    atingimento: div(rs_medido, meta_semana), leitura,
  }
}

export interface PrMes {
  mes: ISODate
  programados: number
  executados: number
  aderencia: number | null
  hh_apontado: number
  rs_medido: number
  meta_mes: number | null
  atingimento: number | null
  resultado: number | null
}

export function planejadoRealizadoMes(mes: ISODate, ctx: ContextoCalculo): PrMes {
  const ini = inicioDoMes(mes), fim = proximoMes(mes)
  const progs = ctx.idx.programacoes.filter((p) => p.data >= ini && p.data < fim)
  const executados = progs.filter((p) => ehSim(p.executou)).length
  const rs = medidoNoPeriodo(ctx.idx, ini, fim)
  return {
    mes: ini, programados: progs.length, executados,
    aderencia: progs.length ? executados / progs.length : null,
    hh_apontado: somaDefinidos(ctx.idx.apontamentos.filter((a) => a.data >= ini && a.data < fim).map(hhDoApontamento)),
    rs_medido: rs, meta_mes: ctx.metas.meta_mes, atingimento: div(rs, ctx.metas.meta_mes),
    // L RESULTADO ESTIMADO = I × (1 − imposto) − custo
    resultado: ctx.imposto === null || ctx.custo.total === null ? null : rs * (1 - ctx.imposto) - ctx.custo.total,
  }
}

// ═══════════════════════════ ABA 13 — RESUMO GERENCIAL ════════════════════

export interface ResumoMes {
  mes: ISODate
  recebidos: number
  programados: number
  executados: number
  aderencia: number | null
  executados_no_prazo: number
  pct_no_prazo: number | null
  backlog: number
  vencidos: number
  rs_medido: number
  meta_mes: number | null
  atingimento: number | null
  ticket_medio: number | null
  glosa: number
  pct_glosa: number | null
  custo_mes: number | null
  resultado: number | null
  margem: number | null
  hh: number
  rs_por_hh: number | null
  efetivo_medio: number | null
  horas_retro: number
  ocorrencias_abertas: number
  retrabalhos: number
  motivos_nao_execucao: { motivo: string; n: number; pct: number }[]
  por_tipo: { tipo: string; executados: number; valor: number; ticket: number | null }[]
  por_equipe: { equipe: string; dias: number; hh: number; programados: number; executados: number; valor: number }[]
  pessoas_ativas: number
}

export function resumoMes(mes: ISODate, ctx: ContextoCalculo): ResumoMes {
  const { idx, p, hoje } = ctx
  const ini = inicioDoMes(mes), fimIncl = fimDoMes(mes), fim = proximoMes(mes)
  const noMes = (d: string | null | undefined) => !!d && d >= ini && d <= fimIncl

  const calcs = new Map(idx.servicos.map((s) => [s.id, servicoCalc(s, idx, p, hoje)]))
  // C8 recebidos (DATA DA SOLICITAÇÃO no mês)
  const recebidos = idx.servicos.filter((s) => noMes(s.data_solicitacao)).length
  // C9 programados no mês — a obra vem do SERVIÇO (PROG_CONTR = PROCV no cadastro)
  const progsMes = idx.programacoes.filter((x) => noMes(x.data) && idx.servicoPorId.has(x.servico_id))
  // C10 executados = OS concluídas no mês
  const osMes = idx.ordens.filter((o) => noMes(o.data_conclusao))
  const executados = osMes.length
  // C12 executados no prazo = COUNTIFS(CAD_SITPZ "NO PRAZO"; CAD_DTEXEC no mês) / C10
  let noPrazo = 0, backlog = 0, vencidos = 0
  for (const s of idx.servicos) {
    const c = calcs.get(s.id)!
    if (c.situacao_prazo === 'NO PRAZO' && noMes(c.data_execucao)) noPrazo++
    if (STATUS_BACKLOG.has(c.status)) backlog++                // C13
    if (c.situacao_prazo === 'VENCIDO') vencidos++             // C14
  }
  // C16 valor medido (MED_MES = EOMONTH do mês) ; C20 glosa
  const rs = medidoNoPeriodo(idx, ini, fim)
  const glosa = glosaNoPeriodo(idx, ini, fim)
  const apsMes = idx.apontamentos.filter((a) => noMes(a.data))
  const hh = somaDefinidos(apsMes.map(hhDoApontamento))
  const pessoas = apsMes.map((a) => a.n_pessoas).filter((x): x is number => x !== null)

  // bloco D — por que não executou (PROG_MOTIVO no mês)
  const motivos = new Map<string, number>()
  for (const x of progsMes) if (x.motivo_nao_execucao) motivos.set(x.motivo_nao_execucao, (motivos.get(x.motivo_nao_execucao) ?? 0) + 1)
  const totMot = [...motivos.values()].reduce((s, n) => s + n, 0)

  // bloco E — por tipo (CAD_DTEXEC no mês, CAD_VLR)
  const tipos = new Map<string, { executados: number; valor: number }>()
  for (const s of idx.servicos) {
    const c = calcs.get(s.id)!
    if (!noMes(c.data_execucao)) continue
    const k = s.tipo ?? '(sem tipo)'
    const t = tipos.get(k) ?? { executados: 0, valor: 0 }
    t.executados++; t.valor += c.valor_medido
    tipos.set(k, t)
  }

  // bloco C — por equipe
  const equipes = new Map<string, { equipe: string; dias: number; hh: number; programados: number; executados: number; valor: number }>()
  const eq = (nome: string | null) => {
    const k = normCabecalho(nome)
    if (!k) return null
    if (!equipes.has(k)) equipes.set(k, { equipe: nome!.trim(), dias: 0, hh: 0, programados: 0, executados: 0, valor: 0 })
    return equipes.get(k)!
  }
  for (const a of apsMes) { const e = eq(a.equipe); if (e) { e.dias++; e.hh += hhDoApontamento(a) ?? 0 } }
  for (const x of progsMes) { const e = eq(x.equipe); if (e) e.programados++ }
  for (const o of osMes) { const e = eq(o.equipe); if (e) e.executados++ }
  for (const e of equipes.values()) e.valor = medidoNoPeriodo(idx, ini, fim, { equipe: e.equipe })

  const custo = ctx.custo.total
  const resultado = ctx.imposto === null || custo === null ? null : rs * (1 - ctx.imposto) - custo
  return {
    mes: ini, recebidos, programados: progsMes.length, executados,
    aderencia: progsMes.length ? executados / progsMes.length : null,     // C11
    executados_no_prazo: noPrazo, pct_no_prazo: executados ? noPrazo / executados : null,
    backlog, vencidos, rs_medido: rs, meta_mes: ctx.metas.meta_mes,
    atingimento: div(rs, ctx.metas.meta_mes),                             // C18
    ticket_medio: executados ? rs / executados : null,                    // C19
    glosa, pct_glosa: rs ? glosa / rs : null,                             // C21
    custo_mes: custo, resultado,                                          // C23, C24
    margem: resultado === null || !rs ? null : resultado / rs,            // C25
    hh, rs_por_hh: hh ? rs / hh : null,                                   // C27, C28
    efetivo_medio: pessoas.length ? pessoas.reduce((s, n) => s + n, 0) / pessoas.length : null, // C29
    horas_retro: somaDefinidos(apsMes.map((a) => a.retro_h)),             // C30
    // C32 ocorrências ABERTAS (todas as datas) ; C33 retrabalhos no mês
    ocorrencias_abertas: idx.ocorrencias.filter((o) => normCabecalho(o.status) === 'ABERTA').length,
    retrabalhos: idx.ocorrencias.filter((o) => noMes(o.data) && normChave(o.tipo) === 'retrabalho').length,
    motivos_nao_execucao: [...motivos.entries()].sort((a, b) => b[1] - a[1])
      .map(([motivo, n]) => ({ motivo, n, pct: totMot ? n / totMot : 0 })),
    por_tipo: [...tipos.entries()].sort((a, b) => b[1].valor - a[1].valor)
      .map(([tipo, t]) => ({ tipo, executados: t.executados, valor: arred2(t.valor), ticket: t.executados ? t.valor / t.executados : null })),
    por_equipe: [...equipes.values()].sort((a, b) => a.equipe.localeCompare(b.equipe)),
    pessoas_ativas: new Set(vivos(ctx.dados.membros).filter((m) => m.ativo === true).map((m) => m.pessoa_id)).size,
  }
}

// ═══════════════════════════ ABA 08 — ALERTA DE VENCIMENTOS ═══════════════

export type AlertaPessoa = 'VENCIDO — AFASTAR DA FRENTE' | 'VENCE EM 30 DIAS' | 'OK'

/** aba 08, coluna T ALERTA */
export function alertaPessoa(vencs: PessoaVencimento[], hoje: ISODate): AlertaPessoa {
  const datas = vivos(vencs).map((v) => v.vence_em).filter((d): d is string => !!d)
  if (datas.some((d) => d < hoje)) return 'VENCIDO — AFASTAR DA FRENTE'
  const limite = addDias(hoje, 30)
  if (datas.some((d) => d >= hoje && d <= limite)) return 'VENCE EM 30 DIAS'
  return 'OK'
}

export interface AlertaDocumento {
  pessoa_id: string
  pessoa: string
  equipe: string | null
  documento: string
  vence: ISODate
  dias: number
}

/** documentos vencidos ou vencendo em até 30 dias, dos membros ATIVOS (mais urgente primeiro) */
export function alertasEquipe(membros: OpEquipeMembro[], vencimentos: PessoaVencimento[], hoje: ISODate): AlertaDocumento[] {
  const porPessoa = new Map<string, PessoaVencimento[]>()
  for (const v of vivos(vencimentos)) empurrar(porPessoa, v.pessoa_id, v)
  const out: AlertaDocumento[] = []
  const vistos = new Set<string>()
  for (const m of vivos(membros)) {
    if (m.ativo !== true || vistos.has(m.pessoa_id)) continue
    vistos.add(m.pessoa_id)
    for (const v of porPessoa.get(m.pessoa_id) ?? []) {
      if (!v.vence_em) continue
      const dias = diffDias(v.vence_em, hoje)
      if (dias <= 30) {
        out.push({ pessoa_id: m.pessoa_id, pessoa: m.pessoa_nome ?? m.matricula, equipe: m.equipe, documento: v.tipo, vence: v.vence_em, dias })
      }
    }
  }
  return out.sort((a, b) => a.dias - b.dias)
}
