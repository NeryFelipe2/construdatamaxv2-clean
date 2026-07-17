/**
 * computeEvmReal — motor puro do EVM com dado real (E7).
 * NÃO substitui `evmStore.recalculateMetrics` (mock, intacto no Modo Demo);
 * é um motor paralelo que monta PV/EV/AC a partir de fontes reais:
 *
 *   - PV (planejado) = baseline do cronograma (`useMasterScheduleEngine`,
 *     nível 0: plannedStart/plannedEnd + peso por metragem) mensalizada —
 *     o peso de cada segmento é distribuído em partes iguais entre os meses
 *     do seu intervalo [plannedStart, plannedEnd].
 *   - EV (agregado) = produção física real (`producao_diaria`: pra_m+pre_m
 *     por mês) × preço por metro. Preço por metro vem de `medicao_itens`
 *     quando houver (preço médio real medido); senão fallback = BAC / total
 *     de metros planejados (peso total do baseline) — "% físico × valor
 *     contrato", como pedido na missão.
 *   - AC (custo real) = `lancamentos_financeiros` tipo DESPESA, acumulado
 *     por mês.
 *
 * Sem baseline (peso total = 0) ou sem BAC → série vazia (aviso honesto,
 * nunca inventa número). Meses sem produção/despesa entram com 0 (não são
 * omitidos), pois a barra do tempo é dada pelo baseline.
 */

export interface BaselineSegmentInput {
  /** Data ISO (YYYY-MM-DD) de início planejado do segmento (grupo núcleo×sistema). */
  plannedStart: string
  /** Data ISO (YYYY-MM-DD) de fim planejado do segmento. */
  plannedEnd: string
  /** Peso do segmento (metros planejados) — usado para ratear o BAC entre os segmentos. */
  weight: number
}

export interface ProducaoRealInput {
  /** Data ISO (YYYY-MM-DD) do lançamento de produção. */
  data: string
  /** Metros executados no lançamento (pra_m + pre_m). */
  metros: number
}

export interface DespesaRealInput {
  /** Data ISO (YYYY-MM-DD) do lançamento financeiro. */
  data: string
  valor: number
}

export interface EvmRealMes {
  /** Chave do mês, formato YYYY-MM. */
  mes: string
  /** Rótulo curto pt-BR, ex: "Jul/26". */
  mesLabel: string
  pv: number
  ev: number
  ac: number
  pvAcum: number
  evAcum: number
  acAcum: number
  /** % acumulado de PV sobre o BAC (0-100) — para curva percentual (Dashboard). */
  pvPct: number
  /** % acumulado de EV sobre o BAC (0-100). */
  evPct: number
  /** % acumulado de AC sobre o BAC (0-100). */
  acPct: number
  /** % acumulado de metros executados sobre o total de metros planejados (0-100) —
   * físico realizado, calculado independente do preço/metro (hoje coincide com
   * `evPct` porque o preço/metro é constante no fallback, mas fica calculado à
   * parte para não depender dessa premissa se o preço variar no futuro). */
  physicalPct: number
}

export interface EacScenariosReal {
  optimistic: number
  trend: number
  pessimistic: number
}

export interface EvmRealMetrics {
  BAC: number
  PV: number
  EV: number
  AC: number
  CPI: number
  SPI: number
  CV: number
  SV: number
  EAC: number
  ETC: number
  VAC: number
  TCPI: number
  eacScenarios: EacScenariosReal
}

export interface ComputeEvmRealResult {
  serie: EvmRealMes[]
  metrics: EvmRealMetrics
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const EMPTY_METRICS: EvmRealMetrics = {
  BAC: 0, PV: 0, EV: 0, AC: 0, CPI: 0, SPI: 0, CV: 0, SV: 0, EAC: 0, ETC: 0, VAC: 0, TCPI: 0,
  eacScenarios: { optimistic: 0, trend: 0, pessimistic: 0 },
}

/**
 * computeHealthStatus — mesma regra usada pelo `evmStore` (mock), extraída pura
 * pra ser compartilhada com o motor real e não divergir:
 *  - blue:   CPI >= 1 e SPI >= 1 (eficiente)
 *  - yellow: CPI >= 1 e SPI < 1  (gastando conforme o plano, mas atrasado)
 *  - red:    CPI < 1             (estourando orçamento, com ou sem atraso)
 */
export function computeHealthStatus(cpi: number, spi: number): 'blue' | 'yellow' | 'red' {
  if (cpi >= 1 && spi >= 1) return 'blue'
  if (cpi >= 1 && spi < 1) return 'yellow'
  return 'red'
}

function monthKeyFromIso(iso: string): string | null {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : null
}

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const idx = Math.min(Math.max(m - 1, 0), 11)
  return `${MESES_ABREV[idx]}/${String(y).slice(2)}`
}

function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function monthRange(startKey: string, endKey: string): string[] {
  if (startKey > endKey) return [startKey]
  const out: string[] = []
  let k = startKey
  let guard = 0
  while (k <= endKey && guard < 2000) {
    out.push(k)
    k = addMonths(k, 1)
    guard++
  }
  return out
}

export function computeEvmReal(
  baseline: BaselineSegmentInput[],
  producao: ProducaoRealInput[],
  despesas: DespesaRealInput[],
  bac: number,
  hoje: Date = new Date(),
): ComputeEvmRealResult {
  const totalWeight = (baseline ?? []).reduce((s, b) => s + (Number(b.weight) || 0), 0)

  if (totalWeight <= 0 || !bac || bac <= 0) {
    return { serie: [], metrics: { ...EMPTY_METRICS } }
  }

  // ── PV mensalizado: peso de cada segmento distribuído em partes iguais
  // entre os meses do seu intervalo planejado. ──────────────────────────
  const pvWeightPorMes = new Map<string, number>()
  for (const seg of baseline) {
    const startKey = monthKeyFromIso(seg.plannedStart)
    const endKey = monthKeyFromIso(seg.plannedEnd) ?? startKey
    if (!startKey) continue
    const meses = monthRange(startKey, endKey ?? startKey)
    const pesoPorMes = (Number(seg.weight) || 0) / meses.length
    for (const mk of meses) {
      pvWeightPorMes.set(mk, (pvWeightPorMes.get(mk) ?? 0) + pesoPorMes)
    }
  }

  // ── EV mensal: metros executados/mês × preço por metro (BAC / metros
  // planejados totais — fallback "% físico × valor contrato"). ─────────
  const precoPorMetro = bac / totalWeight
  const metrosPorMes = new Map<string, number>()
  for (const p of producao ?? []) {
    const mk = monthKeyFromIso(p.data)
    if (!mk) continue
    metrosPorMes.set(mk, (metrosPorMes.get(mk) ?? 0) + (Number(p.metros) || 0))
  }

  // ── AC mensal: despesas reais. ────────────────────────────────────────
  const acPorMes = new Map<string, number>()
  for (const d of despesas ?? []) {
    const mk = monthKeyFromIso(d.data)
    if (!mk) continue
    acPorMes.set(mk, (acPorMes.get(mk) ?? 0) + (Number(d.valor) || 0))
  }

  const chaves = [...new Set([...pvWeightPorMes.keys(), ...metrosPorMes.keys(), ...acPorMes.keys()])]
  if (chaves.length === 0) return { serie: [], metrics: { ...EMPTY_METRICS } }

  const start = chaves.reduce((a, b) => (a < b ? a : b))
  const end = chaves.reduce((a, b) => (a > b ? a : b))
  const meses = monthRange(start, end)

  let pvAcum = 0
  let evAcum = 0
  let acAcum = 0
  let metrosAcum = 0
  const mesAtual = monthKeyFromDate(hoje)

  const serie: EvmRealMes[] = meses.map((mk) => {
    const pv = ((pvWeightPorMes.get(mk) ?? 0) / totalWeight) * bac
    const metros = metrosPorMes.get(mk) ?? 0
    const ev = metros * precoPorMetro
    const ac = acPorMes.get(mk) ?? 0
    pvAcum += pv
    evAcum += ev
    acAcum += ac
    metrosAcum += metros
    return {
      mes: mk,
      mesLabel: monthLabel(mk),
      pv, ev, ac, pvAcum, evAcum, acAcum,
      pvPct: bac > 0 ? (pvAcum / bac) * 100 : 0,
      evPct: bac > 0 ? (evAcum / bac) * 100 : 0,
      acPct: bac > 0 ? (acAcum / bac) * 100 : 0,
      physicalPct: totalWeight > 0 ? (metrosAcum / totalWeight) * 100 : 0,
    }
  })

  // Métricas "no ponto de controle" = acumulado até o mês mais recente da
  // série que seja <= hoje (ou, se todos os meses forem futuros, o último
  // ponto disponível — não inventa dado, só usa o que existe).
  const pontoControle =
    [...serie].reverse().find((m) => m.mes <= mesAtual) ?? serie[serie.length - 1]

  const PV = pontoControle.pvAcum
  const EV = pontoControle.evAcum
  const AC = pontoControle.acAcum
  const BAC = bac
  const CPI = AC !== 0 ? EV / AC : 0
  const SPI = PV !== 0 ? EV / PV : 0
  const CV = EV - AC
  const SV = EV - PV
  const EAC = CPI !== 0 ? BAC / CPI : 0
  const ETC = EAC - AC
  const VAC = BAC - EAC
  const TCPI = (BAC - AC) !== 0 ? (BAC - EV) / (BAC - AC) : 0

  // Cenários de EAC — mesma fórmula usada no `evmStore` (mock), pra manter
  // consistência entre os dois motores: otimista = volta ao BAC original,
  // tendência = projeção pelo CPI atual, pessimista = tendência + 15%.
  const eacScenarios: EacScenariosReal = {
    optimistic: BAC,
    trend: EAC,
    pessimistic: CPI !== 0 ? EAC * 1.15 : 0,
  }

  return {
    serie,
    metrics: { BAC, PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI, eacScenarios },
  }
}

// ─────────────────────────────────────────────────────────────────────────
// computeEvmRealPorSegmento — mesmo motor (`computeEvmReal`), rodado uma vez
// por segmento (núcleo × sistema), reaproveitando 100% da lógica de PV/EV já
// validada — só troca o baseline/BAC/produção de entrada por segmento.
//
// AC (despesas) NÃO existe desagregado por núcleo/sistema em
// `lancamentos_financeiros` hoje — é rateado proporcionalmente ao peso do
// segmento sobre o peso total (mesma lógica de rateio já usada pro preço/metro
// no motor agregado). Isso é uma ESTIMATIVA, não AC real por segmento — o
// consumidor (IndicesPanel) precisa deixar isso explícito na UI.
// ─────────────────────────────────────────────────────────────────────────

export interface SegmentoBaselineInput {
  /** Chave estável do segmento, ex: "Boi Malhado|agua". */
  key: string
  /** Rótulo pra exibição, ex: "Boi Malhado — Água". */
  label: string
  plannedStart: string
  plannedEnd: string
  weight: number
}

export interface EvmRealSegmento {
  key: string
  label: string
  weight: number
  serie: EvmRealMes[]
  metrics: EvmRealMetrics
  /** Sempre `true` — AC deste segmento é rateio proporcional, não lançamento real por segmento. */
  acEstimadoPorRateio: true
}

export function computeEvmRealPorSegmento(
  segmentos: SegmentoBaselineInput[],
  producaoPorSegmento: Map<string, ProducaoRealInput[]>,
  despesas: DespesaRealInput[],
  bacTotal: number,
  hoje: Date = new Date(),
): EvmRealSegmento[] {
  const totalWeight = (segmentos ?? []).reduce((s, seg) => s + (Number(seg.weight) || 0), 0)
  if (totalWeight <= 0 || !bacTotal || bacTotal <= 0) return []

  return segmentos
    .filter((seg) => (Number(seg.weight) || 0) > 0)
    .map((seg) => {
      const share = (Number(seg.weight) || 0) / totalWeight
      const bacSeg = bacTotal * share
      const despesasRateadas: DespesaRealInput[] = (despesas ?? []).map((d) => ({
        data: d.data,
        valor: (Number(d.valor) || 0) * share,
      }))
      const producaoSeg = producaoPorSegmento.get(seg.key) ?? []
      const { serie, metrics } = computeEvmReal(
        [{ plannedStart: seg.plannedStart, plannedEnd: seg.plannedEnd, weight: seg.weight }],
        producaoSeg,
        despesasRateadas,
        bacSeg,
        hoje,
      )
      return { key: seg.key, label: seg.label, weight: seg.weight, serie, metrics, acEstimadoPorRateio: true as const }
    })
}
