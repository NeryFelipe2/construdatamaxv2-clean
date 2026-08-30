/**
 * cronogramaEquipeCompute.ts
 *
 * Motor puro (Missão 3 do design "Cronograma por Equipe") que transforma uma
 * lista ordenada de itens de trabalho atribuídos a uma equipe (rua/trecho, NS
 * ou tarefa livre) num cronograma calculado: produtividade em cascata, dias
 * por item e encadeamento sequencial de datas.
 *
 * Não faz fetch, não importa React/Supabase/zustand — só lógica determinística.
 * `hoje` é sempre recebido por parâmetro (nunca `new Date()` interno) para o
 * resultado ser 100% testável e reproduzível.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SIMPLIFICAÇÕES CONHECIDAS (documentadas conforme o design):
 *
 * 1. DIAS CORRIDOS, não dias úteis. `dias = max(1, ceil(metragem / produtividade))`
 *    soma dias corridos (inclui fins de semana/feriados) ao encadear os itens.
 *    Aproximação da fase atual — dias úteis/calendário de feriados fica para
 *    uma iteração futura, fora do escopo desta missão.
 *
 * 2. ENCADEAMENTO SEQUENCIAL SIMPLES dentro da mesma equipe: um item só começa
 *    quando o anterior termina (sem paralelismo de frentes de trabalho dentro
 *    da mesma equipe, mesmo que na prática a equipe pudesse dividir a frente).
 *    `dataInicioManual` no item permite "fixar" um início e recomeçar a
 *    cadeia a partir dali (o item seguinte ainda encadeia a partir do fim
 *    deste, normalmente).
 *
 * 3. Cascata de produtividade (do mais específico para o mais genérico):
 *    override do item > override da equipe > produtividade real (RDO,
 *    `teamVelocities`) > padrão por sistema/tipo de serviço > fallback = 1
 *    (evita divisão por zero quando não há nenhuma fonte).
 */

// ─── Tipos de entrada ────────────────────────────────────────────────────────

export type ProdutividadeFonte = 'manual' | 'real' | 'padrao'

export interface ItemTrabalho {
  id: string
  equipeId: string
  ordem: number
  fonte: 'rua' | 'ns' | 'livre'
  descricao: string
  sistema: 'AGUA' | 'ESGOTO'
  metragem: number
  /** Override de produtividade (m/dia) específico deste item. Fonte 'manual'. */
  produtividadeOverride?: number | null
  /** yyyy-mm-dd. Quando presente, fixa o início deste item (ignora o encadeamento). */
  dataInicioManual?: string | null
  /** 'rede' | 'ligacoes' | ... — usado para achar a produtividade padrão por tipo. */
  tipoServico?: string | null
}

export interface EquipeCalcInput {
  equipeId: string
  /** Override de produtividade (m/dia) no nível da equipe. Fonte 'manual'. */
  produtividadeOverrideEquipe?: number | null
  /** Produtividade real (m/dia) observada nos RDOs (motor `teamVelocities`). Fonte 'real'. */
  produtividadeReal?: number | null
  itens: ItemTrabalho[]
}

export interface ProdutividadePadrao {
  sistema: 'AGUA' | 'ESGOTO'
  tipoServico: string
  mDia: number
}

// ─── Tipos de saída ──────────────────────────────────────────────────────────

export interface ItemCalculado extends ItemTrabalho {
  produtividadeUsada: number
  produtividadeFonte: ProdutividadeFonte
  dias: number
  /** yyyy-mm-dd */
  inicio: string
  /** yyyy-mm-dd */
  fim: string
}

export interface EquipeCronograma {
  equipeId: string
  itens: ItemCalculado[]
  dataInicio: string | null
  dataFim: string | null
  totalMetragem: number
  totalDias: number
}

// ─── Helpers de data (yyyy-mm-dd, dias corridos, sem libs externas) ─────────

/** Soma `dias` dias corridos a uma data yyyy-mm-dd. `dias` pode ser 0. */
function addDiasCorridos(iso: string, dias: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + Math.trunc(dias))
  return d.toISOString().slice(0, 10)
}

/** Compara duas datas yyyy-mm-dd. Retorna <0 se a < b, 0 se iguais, >0 se a > b. */
function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ─── Cascata de produtividade ────────────────────────────────────────────────

/**
 * Acha a produtividade padrão de um item: primeiro tenta casar sistema +
 * tipoServico; se não achar tipo (ou o item não tiver tipoServico), cai para
 * qualquer padrão do mesmo sistema. Retorna null se não houver nenhum padrão
 * para o sistema do item.
 */
function acharProdutividadePadrao(
  item: ItemTrabalho,
  padroes: ProdutividadePadrao[],
): number | null {
  const doSistema = padroes.filter((p) => p.sistema === item.sistema)
  if (doSistema.length === 0) return null

  if (item.tipoServico) {
    const porTipo = doSistema.find((p) => p.tipoServico === item.tipoServico)
    if (porTipo) return porTipo.mDia
  }

  return doSistema[0].mDia
}

/**
 * Resolve produtividade + fonte de um item, em cascata (primeira que existir
 * e for > 0):
 *   1. override do item (manual)
 *   2. override da equipe (manual)
 *   3. produtividade real da equipe, vinda dos RDOs (real)
 *   4. produtividade padrão por sistema/tipoServico (padrao)
 *   5. fallback = 1 (padrao) — evita divisão por zero quando não há nenhuma fonte
 */
function resolverProdutividade(
  item: ItemTrabalho,
  input: EquipeCalcInput,
  padroes: ProdutividadePadrao[],
): { valor: number; fonte: ProdutividadeFonte } {
  if (item.produtividadeOverride != null && item.produtividadeOverride > 0) {
    return { valor: item.produtividadeOverride, fonte: 'manual' }
  }
  if (input.produtividadeOverrideEquipe != null && input.produtividadeOverrideEquipe > 0) {
    return { valor: input.produtividadeOverrideEquipe, fonte: 'manual' }
  }
  if (input.produtividadeReal != null && input.produtividadeReal > 0) {
    return { valor: input.produtividadeReal, fonte: 'real' }
  }
  const padrao = acharProdutividadePadrao(item, padroes)
  if (padrao != null && padrao > 0) {
    return { valor: padrao, fonte: 'padrao' }
  }
  return { valor: 1, fonte: 'padrao' }
}

// ─── Função principal ───────────────────────────────────────────────────────

/**
 * Calcula o cronograma de UMA equipe a partir da lista de itens de trabalho
 * atribuídos a ela (ordenados por `ordem`), aplicando a cascata de
 * produtividade e encadeando as datas sequencialmente.
 *
 * `hoje` (yyyy-mm-dd) é o início padrão do primeiro item sem `dataInicioManual`
 * — passado de fora para o resultado ser determinístico/testável.
 */
export function computeCronogramaEquipe(
  input: EquipeCalcInput,
  padroes: ProdutividadePadrao[],
  hoje: string,
): EquipeCronograma {
  const itensOrdenados = [...input.itens].sort((a, b) => a.ordem - b.ordem)

  const itensCalculados: ItemCalculado[] = []
  let cursorFim: string | null = null // fim do último item processado (encadeamento)

  for (const item of itensOrdenados) {
    const { valor: produtividadeUsada, fonte: produtividadeFonte } = resolverProdutividade(
      item,
      input,
      padroes,
    )

    const dias = Math.max(1, Math.ceil(item.metragem / produtividadeUsada))

    const inicio = item.dataInicioManual
      ? item.dataInicioManual
      : cursorFim != null
        ? addDiasCorridos(cursorFim, 1)
        : hoje

    const fim = dias > 1 ? addDiasCorridos(inicio, dias - 1) : inicio

    itensCalculados.push({
      ...item,
      produtividadeUsada,
      produtividadeFonte,
      dias,
      inicio,
      fim,
    })

    cursorFim = fim
  }

  let dataInicio: string | null = null
  let dataFim: string | null = null
  let totalMetragem = 0
  let totalDias = 0

  for (const item of itensCalculados) {
    totalMetragem += item.metragem
    totalDias += item.dias
    if (dataInicio == null || compareIso(item.inicio, dataInicio) < 0) dataInicio = item.inicio
    if (dataFim == null || compareIso(item.fim, dataFim) > 0) dataFim = item.fim
  }

  return {
    equipeId: input.equipeId,
    itens: itensCalculados,
    dataInicio,
    dataFim,
    totalMetragem,
    totalDias,
  }
}

/** Aplica `computeCronogramaEquipe` a várias equipes de uma vez. */
export function computeVariasEquipes(
  inputs: EquipeCalcInput[],
  padroes: ProdutividadePadrao[],
  hoje: string,
): EquipeCronograma[] {
  return inputs.map((input) => computeCronogramaEquipe(input, padroes, hoje))
}
