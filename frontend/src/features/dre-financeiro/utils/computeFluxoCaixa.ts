/**
 * computeFluxoCaixa — motor puro do Fluxo de Caixa até o fim da obra (E4).
 * Substitui a antiga const FLUXO_CAIXA (mock) quando o Modo Demo está OFF.
 *
 * REGRA DE CLASSIFICAÇÃO POR MÊS (documentada conforme exigido pela missão E4):
 *   - Mês PASSADO ou CORRENTE (mes <= mês de hoje) → usa SEMPRE o realizado
 *     (soma de `lancamentos_financeiros` agrupados pelo mês da coluna `data`),
 *     mesmo que o valor seja zero. Projeção cadastrada para esse mês é ignorada
 *     no cálculo (ela pode continuar existindo na tabela `fluxo_projecao` como
 *     registro histórico, mas não entra na série). origem = 'real'.
 *   - Mês FUTURO (mes > mês de hoje) → usa a projeção (`fluxo_projecao`:
 *     recebimento_prev/despesa_prev). origem = 'projetado'.
 *   - Mês FUTURO que por algum motivo já tem lançamento real lançado
 *     antecipadamente (ex: recebimento antecipado de uma medição) → soma o
 *     real já ocorrido com o que ainda falta da projeção para aquele mês.
 *     origem = 'misto' (sinaliza pra UI que aquele mês futuro já tem dinheiro
 *     de verdade dentro dele, além do projetado).
 *   - "Mês de hoje" = mês corrente de `hoje` (parâmetro, default = new Date()).
 *
 * A série cobre todos os meses entre o mais antigo e o mais recente dentre:
 * lançamentos, projeções e o mês de `dataFim` (quando informado) — ou seja,
 * a grade vai "até o fim da obra" mesmo que não haja projeção cadastrada pra
 * todo mês (meses sem dado nenhum entram com recebido=gasto=0).
 * IMPORTANTE: `dataFim` só ESTENDE a grade; nunca a cria. Sem NENHUM lançamento
 * e NENHUMA projeção, a série é vazia (a UI mostra o aviso honesto) — não se
 * inventa um mês fantasma só porque o projeto tem data de fim.
 *
 * saldo = recebido - gasto (do mês)
 * saldoAcumulado = soma corrida de `saldo` desde o primeiro mês da série
 * breakevenMes = chave ('YYYY-MM') do primeiro mês em que saldoAcumulado >= 0,
 *                ou null se a série nunca vira positiva (NUNCA hardcoded).
 */

export type TipoLancamentoFluxo = 'RECEITA' | 'DESPESA'

export interface LancamentoFluxoInput {
  /** Data ISO (YYYY-MM-DD) do lançamento — usada só o ano-mês. */
  data: string
  tipo: TipoLancamentoFluxo
  valor: number
}

export interface ProjecaoFluxoInput {
  /** Mês em ISO (YYYY-MM-DD, dia é ignorado) ou (YYYY-MM). */
  mes: string
  recebimento_prev: number
  despesa_prev: number
}

export type OrigemMes = 'real' | 'projetado' | 'misto'

export interface FluxoCaixaMes {
  /** Chave do mês, formato YYYY-MM. */
  mes: string
  /** Rótulo curto pt-BR, ex: "Jul/26". */
  mesLabel: string
  recebido: number
  gasto: number
  saldo: number
  saldoAcumulado: number
  origem: OrigemMes
}

export interface ComputeFluxoCaixaResult {
  serie: FluxoCaixaMes[]
  breakevenMes: string | null
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Extrai a chave YYYY-MM de uma string ISO (YYYY-MM-DD ou YYYY-MM), sem passar por Date (evita bug de timezone). */
function monthKeyFromIso(iso: string): string | null {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : null
}

/** Chave YYYY-MM a partir de um Date "de verdade" (hora local — é assim que representamos "hoje"). */
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
  if (startKey > endKey) return []
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

export function computeFluxoCaixa(
  lancamentos: LancamentoFluxoInput[],
  projecoes: ProjecaoFluxoInput[],
  dataFim: string | null,
  hoje: Date = new Date(),
): ComputeFluxoCaixaResult {
  const mesAtual = monthKeyFromDate(hoje)

  const realPorMes = new Map<string, { recebido: number; gasto: number }>()
  for (const l of lancamentos ?? []) {
    const key = monthKeyFromIso(l.data)
    if (!key) continue
    const cur = realPorMes.get(key) ?? { recebido: 0, gasto: 0 }
    const valor = Number(l.valor) || 0
    if (l.tipo === 'RECEITA') cur.recebido += valor
    else if (l.tipo === 'DESPESA') cur.gasto += valor
    realPorMes.set(key, cur)
  }

  const projPorMes = new Map<string, { recebimento_prev: number; despesa_prev: number }>()
  for (const p of projecoes ?? []) {
    const key = monthKeyFromIso(p.mes)
    if (!key) continue
    projPorMes.set(key, {
      recebimento_prev: Number(p.recebimento_prev) || 0,
      despesa_prev: Number(p.despesa_prev) || 0,
    })
  }

  // `dataFim` só ESTENDE a grade até o fim da obra — nunca a cria do nada.
  // Sem nenhum lançamento nem projeção, a série é vazia (a UI mostra o aviso
  // honesto), mesmo que o projeto tenha data_fim cadastrada; caso contrário
  // apareceria um mês fantasma zerado e o breakeven leria falso-positivo (0>=0).
  const baseChaves: string[] = [...realPorMes.keys(), ...projPorMes.keys()]
  if (baseChaves.length === 0) return { serie: [], breakevenMes: null }

  const chaves: string[] = [...baseChaves]
  const dataFimKey = dataFim ? monthKeyFromIso(dataFim) : null
  if (dataFimKey) chaves.push(dataFimKey)

  const start = chaves.reduce((a, b) => (a < b ? a : b))
  const end = chaves.reduce((a, b) => (a > b ? a : b))
  const meses = monthRange(start, end)

  let acumulado = 0
  let breakevenMes: string | null = null

  const serie: FluxoCaixaMes[] = meses.map((key) => {
    const real = realPorMes.get(key)
    const proj = projPorMes.get(key)
    let recebido: number
    let gasto: number
    let origem: OrigemMes

    if (key <= mesAtual) {
      recebido = real?.recebido ?? 0
      gasto = real?.gasto ?? 0
      origem = 'real'
    } else {
      const recebProj = proj?.recebimento_prev ?? 0
      const gastoProj = proj?.despesa_prev ?? 0
      if (real) {
        recebido = real.recebido + recebProj
        gasto = real.gasto + gastoProj
        origem = 'misto'
      } else {
        recebido = recebProj
        gasto = gastoProj
        origem = 'projetado'
      }
    }

    const saldo = recebido - gasto
    acumulado += saldo
    if (breakevenMes === null && acumulado >= 0) breakevenMes = key

    return { mes: key, mesLabel: monthLabel(key), recebido, gasto, saldo, saldoAcumulado: acumulado, origem }
  })

  return { serie, breakevenMes }
}
