/**
 * masterAnalysisEngine.ts — Pure analysis functions ported from
 * `src/features/planejamento/utils/analysisEngine.ts` (legado), adaptadas
 * para operar sobre `MasterActivity[]` (Plan. Mestre) em vez de
 * `GanttRow[]`/`PlanTrecho[]`/`PlanTeam[]` (módulo legado `planejamento`).
 *
 * A LÓGICA de cálculo (agrupamento, soma, definição de faixas ABC) é a
 * mesma do motor legado — só a origem dos campos muda:
 *   - "custo" do trecho (GanttRow.totalCostBRL)      → MasterActivity.weight (peso relativo da atividade)
 *   - "trecho" (PlanTrecho)                          → MasterActivity (a própria atividade, nível folha)
 *   - "equipe ativa no dia" (GanttCell.teamIndex)     → MasterActivity.responsibleTeam ativo no intervalo trendStart..trendEnd
 *   - "headcount/equipamento por equipe" (PlanTeam)   → não existe em MasterActivity; substituído por contagem de
 *                                                        atividades ativas por equipe naquele dia (proxy de alocação)
 *
 * No side effects, no Zustand.
 */
import type { MasterActivity } from '@/types'

export type MasterAbcZone = 'A' | 'B' | 'C'

export interface MasterAbcItem {
  activity: MasterActivity
  weight: number
  sharePct: number
  cumulativePct: number
  zone: MasterAbcZone
}

export interface MasterHistogramPoint {
  dayIndex: number
  date: string
  activeActivities: number
  activeTeams: number
  totalWeight: number
}

// ─── ABC / Pareto Curve ──────────────────────────────────────────────────────

/**
 * Compute ABC Pareto curve items sorted by weight descending.
 * Zone A: ≤75% cumulative; Zone B: ≤95%; Zone C: above 95%.
 * Only considers leaf-level activities (level >= 1) — level 0 são
 * agregados de núcleo/sistema e entrariam em dobro na soma.
 */
export function computeAbcCurve(activities: MasterActivity[]): MasterAbcItem[] {
  const leaves = activities.filter((a) => a.level >= 1 && !a.isMilestone)
  if (leaves.length === 0) return []

  const grandTotal = leaves.reduce((sum, a) => sum + (a.weight ?? 0), 0)
  if (grandTotal === 0) return []

  const sorted = [...leaves].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))

  let cumulative = 0
  return sorted.map((activity) => {
    const weight = activity.weight ?? 0
    const sharePct = (weight / grandTotal) * 100
    cumulative += sharePct
    const zone: MasterAbcZone = cumulative <= 75 ? 'A' : cumulative <= 95 ? 'B' : 'C'
    return {
      activity,
      weight,
      sharePct: Math.round(sharePct * 100) / 100,
      cumulativePct: Math.round(cumulative * 100) / 100,
      zone,
    }
  })
}

// ─── Resource Histogram ──────────────────────────────────────────────────────

/**
 * Compute daily resource usage: active activities, active teams (equipes
 * distintas com atividade em andamento) and total weight in progress.
 * One data point per work day, no intervalo [startDate, endDate].
 */
export function computeHistogram(
  activities: MasterActivity[],
  startDate: string,
  endDate: string,
): MasterHistogramPoint[] {
  const leaves = activities.filter((a) => a.level >= 1 && !a.isMilestone)
  if (leaves.length === 0) return []

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (start >= end) return []

  const dayCount = Math.min(730, Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1)

  const points: MasterHistogramPoint[] = []

  for (let d = 0; d < dayCount; d++) {
    const date = new Date(start)
    date.setDate(date.getDate() + d)
    const isoDate = date.toISOString().slice(0, 10)

    let activeActivities = 0
    let totalWeight = 0
    const activeTeams = new Set<string>()

    for (const act of leaves) {
      if (isoDate >= act.trendStart && isoDate <= act.trendEnd) {
        activeActivities += 1
        totalWeight += act.weight ?? 0
        if (act.responsibleTeam) activeTeams.add(act.responsibleTeam)
      }
    }

    points.push({
      dayIndex: d,
      date: isoDate,
      activeActivities,
      activeTeams: activeTeams.size,
      totalWeight: Math.round(totalWeight * 100) / 100,
    })
  }

  return points
}
