import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench, Cpu, ArrowRight,
  HardHat, Radio, AlertTriangle, TrendingUp, Target,
} from 'lucide-react'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useGestao360Store } from '@/store/gestao360Store'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useProjetosStore } from '@/store/projetosStore'
import { useShallow } from 'zustand/react/shallow'
import { ModuleQuickLinks } from '@/components/shared/ModuleQuickLinks'

// ─── Feed item type ────────────────────────────────────────────────────────────

interface FeedItem {
  id:       string
  severity: 'critical' | 'high' | 'medium' | 'low'
  module:   string
  icon:     React.ElementType
  title:    string
  detail:   string
  link:     string
  date:     string
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
const SEVERITY_COLOR = {
  critical: '#ef4444',
  high:     '#2abfdc',
  medium:   '#eab308',
  low:      '#22c55e',
}
const SEVERITY_LABEL = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  low:      'Baixo',
}

// ─── Recommendation type ──────────────────────────────────────────────────────

interface Recommendation {
  id:       string
  category: 'immediate' | 'week' | 'strategic'
  urgency:  number  // 1–5
  impact:   number  // 1–5
  title:    string
  detail:   string
  module:   string
}

const REC_CATEGORY_LABEL: Record<Recommendation['category'], string> = {
  immediate: 'Ação Imediata',
  week:      'Esta Semana',
  strategic: 'Estratégico',
}
const REC_CATEGORY_COLOR: Record<Recommendation['category'], string> = {
  immediate: '#ef4444',
  week:      '#eab308',
  strategic: '#2abfdc',
}

// ─── Priority Matrix ──────────────────────────────────────────────────────────

function PriorityMatrix({ recs }: { recs: Recommendation[] }) {
  const W = 240, H = 200
  const PAD = 28

  const cW = W - PAD
  const cH = H - PAD

  return (
    <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4">
      <p className="text-[#e4f2f8] text-sm font-semibold mb-3 flex items-center gap-2">
        <Target size={13} className="text-[#2abfdc]" />
        Matriz de Prioridade
      </p>
      <svg width={W} height={H} className="mx-auto block">
        {/* Quadrant fills */}
        <rect x={PAD + cW / 2} y={0}        width={cW / 2} height={cH / 2} fill="#ef444412" rx={2} />
        <rect x={PAD}          y={0}        width={cW / 2} height={cH / 2} fill="#f9731612" rx={2} />
        <rect x={PAD + cW / 2} y={cH / 2}  width={cW / 2} height={cH / 2} fill="#eab30812" rx={2} />
        <rect x={PAD}          y={cH / 2}  width={cW / 2} height={cH / 2} fill="#1a366212" rx={2} />

        {/* Quadrant labels */}
        <text x={PAD + cW * 0.75} y={12} textAnchor="middle" fontSize={7} fill="#ef444488">Ação Imediata</text>
        <text x={PAD + cW * 0.25} y={12} textAnchor="middle" fontSize={7} fill="#f9731688">Esta Semana</text>
        <text x={PAD + cW * 0.75} y={cH / 2 + 12} textAnchor="middle" fontSize={7} fill="#eab30888">Planejar</text>
        <text x={PAD + cW * 0.25} y={cH / 2 + 12} textAnchor="middle" fontSize={7} fill="#5a8caa88">Monitorar</text>

        {/* Center lines */}
        <line x1={PAD + cW / 2} y1={0} x2={PAD + cW / 2} y2={cH} stroke="#20406a" strokeWidth={1} strokeDasharray="3,2" />
        <line x1={PAD} y1={cH / 2} x2={PAD + cW} y2={cH / 2} stroke="#20406a" strokeWidth={1} strokeDasharray="3,2" />

        {/* Dots */}
        {recs.map((r) => {
          const impact  = Math.min(5, Math.max(1, r.impact))
          const urgency = Math.min(5, Math.max(1, r.urgency))
          const cx = PAD + ((impact - 1) / 4) * cW
          const cy = cH - ((urgency - 1) / 4) * cH
          const color = REC_CATEGORY_COLOR[r.category]
          return (
            <circle key={r.id} cx={cx} cy={cy} r={5} fill={color} opacity={0.8}>
              <title>{r.title}</title>
            </circle>
          )
        })}

        {/* Axis labels */}
        <text x={PAD + cW / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="#5a8caa">Impacto →</text>
        <text x={6} y={cH / 2 + 4} textAnchor="middle" fontSize={8} fill="#5a8caa" transform={`rotate(-90, 6, ${cH / 2})`}>↑ Urgência</text>
      </svg>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function CommandCenterPanel() {
  const { healthScores, routingRecs } = useOtimizacaoFrotaStore(
    useShallow((s) => ({ healthScores: s.healthScores, routingRecs: s.routingRecs }))
  )
  const sites            = useTorreStore((s) => s.sites)
  const changeOrders     = useGestao360Store((s) => s.changeOrders)
  const maintenanceOrders = useGestaoEquipamentosStore((s) => s.orders)
  const projects         = useProjetosStore((s) => s.projects)

  // ─── Unified feed ─────────────────────────────────────────────────────────
  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = []

    healthScores
      .filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high')
      .forEach((h) => {
        items.push({
          id:       `health-${h.equipmentId}`,
          severity: h.riskLevel,
          module:   'Frota',
          icon:     Cpu,
          title:    `${h.equipmentCode} — Saúde ${h.healthScore}/100`,
          detail:   `${h.predictedFailureWindow} · ${h.recommendedAction}`,
          link:     '/otimizacao-frota',
          date:     new Date().toISOString(),
        })
      })

    routingRecs
      .filter((r) => r.accepted === undefined && r.priority === 'critical')
      .forEach((r) => {
        items.push({
          id:       `route-${r.id}`,
          severity: 'high',
          module:   'Frota',
          icon:     Cpu,
          title:    `${r.equipmentCode} — Realocação pendente`,
          detail:   `${r.fromSiteName} → ${r.toSiteName} · +${r.utilizationGainPct}% utilização`,
          link:     '/otimizacao-frota',
          date:     r.suggestedDate + 'T00:00:00Z',
        })
      })

    sites.forEach((site) => {
      site.risks
        .filter((r) => r.status === 'active' && (r.level === 'critical' || r.level === 'high'))
        .forEach((r) => {
          items.push({
            id:       `risk-${r.id}`,
            severity: r.level,
            module:   'Torre de Controle',
            icon:     Radio,
            title:    `${site.code} — ${r.title}`,
            detail:   r.description.slice(0, 90) + (r.description.length > 90 ? '…' : ''),
            link:     '/torre-de-controle',
            date:     r.identifiedAt,
          })
        })
    })

    changeOrders
      .filter((co) => co.status === 'submitted')
      .forEach((co) => {
        items.push({
          id:       `co-${co.id}`,
          severity: co.impactCostBRL > 50_000 ? 'high' : 'medium',
          module:   'Gestão 360',
          icon:     HardHat,
          title:    `OM: ${co.title}`,
          detail:   `+R$${(co.impactCostBRL / 1000).toFixed(0)}k · ${co.impactDays > 0 ? `+${co.impactDays}d` : `${co.impactDays}d`} · Aguardando aprovação`,
          link:     '/gestao-360',
          date:     co.submittedAt,
        })
      })

    const today = new Date()
    maintenanceOrders
      .filter((o) => {
        if (o.status === 'completed' || o.status === 'cancelled') return false
        return new Date(o.scheduledDate + 'T00:00:00') < today
      })
      .forEach((o) => {
        items.push({
          id:       `maint-${o.id}`,
          severity: 'high',
          module:   'Gest. Equip.',
          icon:     Wrench,
          title:    `Manutenção vencida — ${o.id}`,
          detail:   `Tipo: ${o.type} · Responsável: ${o.responsible}`,
          link:     '/gestao-equipamentos',
          date:     o.scheduledDate + 'T00:00:00Z',
        })
      })

    return items.sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      if (sevDiff !== 0) return sevDiff
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [healthScores, routingRecs, sites, changeOrders, maintenanceOrders])

  // ─── Recommendations engine ───────────────────────────────────────────────
  const recommendations: Recommendation[] = useMemo(() => {
    const recs: Recommendation[] = []
    let seq = 0

    // Helper to compute CPI/SPI for a project
    function projectMetrics(proj: typeof projects[number]) {
      const lines    = proj.budgetLines
      const budgeted = lines.reduce((s, l) => s + l.budgeted, 0)
      const spent    = lines.reduce((s, l) => s + l.spent, 0)
      const eac      = lines.reduce((s, l) => s + l.projected, 0)
      const pctOver  = budgeted > 0 ? ((eac - budgeted) / budgeted) * 100 : 0

      const execPhases  = proj.executionPhases
      const avgProgress = execPhases.length ? execPhases.reduce((s, p) => s + p.progress, 0) / execPhases.length : 0

      const today   = new Date()
      const start   = new Date(proj.startDate + 'T00:00:00')
      const end     = new Date(proj.endDate   + 'T00:00:00')
      const totalMs = Math.max(1, end.getTime() - start.getTime())
      const elapsed = Math.min(totalMs, Math.max(0, today.getTime() - start.getTime()))
      const planned = (elapsed / totalMs) * 100

      const cpi = spent > 0 ? (budgeted * (avgProgress / 100)) / spent : 1
      const spi = planned > 0 ? avgProgress / planned : 1

      return { cpi, spi, pctOver }
    }

    // Per-project rules
    for (const proj of projects) {
      const { cpi, spi, pctOver } = projectMetrics(proj)

      if (cpi < 0.85) {
        recs.push({
          id:       `cpi-${proj.id}-${seq++}`,
          category: 'immediate',
          urgency:  5, impact: 5,
          title:    `${proj.code}: CPI crítico (${cpi.toFixed(2)})`,
          detail:   `Custo/índice de desempenho abaixo de 0.85 — rever equipes e materiais.`,
          module:   proj.name,
        })
      } else if (cpi < 0.95) {
        recs.push({
          id:       `cpi-${proj.id}-${seq++}`,
          category: 'strategic',
          urgency:  2, impact: 4,
          title:    `${proj.code}: CPI em queda (${cpi.toFixed(2)})`,
          detail:   `Tendência de desvio de custo — monitorar próximas semanas.`,
          module:   proj.name,
        })
      }

      if (spi < 0.85) {
        recs.push({
          id:       `spi-${proj.id}-${seq++}`,
          category: 'immediate',
          urgency:  4, impact: 4,
          title:    `${proj.code}: SPI crítico (${spi.toFixed(2)})`,
          detail:   `Avanço físico muito abaixo do planejado — realocar recursos.`,
          module:   proj.name,
        })
      } else if (spi < 0.95) {
        recs.push({
          id:       `spi-${proj.id}-${seq++}`,
          category: 'strategic',
          urgency:  2, impact: 3,
          title:    `${proj.code}: SPI levemente abaixo (${spi.toFixed(2)})`,
          detail:   `Leve atraso físico — verificar cronograma nas próximas semanas.`,
          module:   proj.name,
        })
      }

      if (pctOver > 15) {
        recs.push({
          id:       `over-${proj.id}-${seq++}`,
          category: 'immediate',
          urgency:  5, impact: 5,
          title:    `${proj.code}: Estouro orçamentário ${pctOver.toFixed(0)}%`,
          detail:   `EAC supera orçamento em ${pctOver.toFixed(1)}%. Revisão urgente necessária.`,
          module:   proj.name,
        })
      } else if (pctOver > 5) {
        recs.push({
          id:       `over-${proj.id}-${seq++}`,
          category: 'week',
          urgency:  3, impact: 4,
          title:    `${proj.code}: Orçamento ${pctOver.toFixed(0)}% acima`,
          detail:   `Desvio de ${pctOver.toFixed(1)}% — revisar escopo e contratos.`,
          module:   proj.name,
        })
      }
    }

    // Equipment rules
    healthScores
      .filter((h) => h.riskLevel === 'critical')
      .forEach((h) => {
        recs.push({
          id:       `equip-crit-${h.equipmentId}-${seq++}`,
          category: 'immediate',
          urgency:  5, impact: 4,
          title:    `Equipamento ${h.equipmentCode} em estado crítico`,
          detail:   `${h.recommendedAction}. Janela de falha: ${h.predictedFailureWindow}.`,
          module:   'Frota / Equipamentos',
        })
      })

    healthScores
      .filter((h) => h.riskLevel === 'high')
      .forEach((h) => {
        recs.push({
          id:       `equip-high-${h.equipmentId}-${seq++}`,
          category: 'week',
          urgency:  3, impact: 3,
          title:    `${h.equipmentCode}: saúde em nível alto`,
          detail:   `Programar manutenção preventiva — saúde ${h.healthScore}/100.`,
          module:   'Frota',
        })
      })

    // Change orders
    const openCOs = changeOrders.filter((co) => co.status === 'submitted')
    if (openCOs.length > 3) {
      recs.push({
        id:       `co-excess-${seq++}`,
        category: 'immediate',
        urgency:  4, impact: 3,
        title:    `${openCOs.length} Ordens de Mudança aguardando aprovação`,
        detail:   `Acúmulo de OMs pode bloquear cronograma — aprovar ou rejeitar urgentemente.`,
        module:   'Gestão 360',
      })
    } else if (openCOs.length > 0) {
      recs.push({
        id:       `co-pending-${seq++}`,
        category: 'week',
        urgency:  2, impact: 3,
        title:    `${openCOs.length} OM(s) pendente(s) de aprovação`,
        detail:   `Revisar ordens de mudança submetidas esta semana.`,
        module:   'Gestão 360',
      })
    }

    const highCostCOs = openCOs.filter((co) => co.impactCostBRL > 100_000)
    highCostCOs.forEach((co) => {
      recs.push({
        id:       `co-cost-${co.id}-${seq++}`,
        category: 'week',
        urgency:  3, impact: 5,
        title:    `OM de alto impacto: ${co.title}`,
        detail:   `Custo: R$${(co.impactCostBRL / 1000).toFixed(0)}k — análise financeira necessária.`,
        module:   'Gestão 360',
      })
    })

    // Critical risks
    sites.flatMap((s) => s.risks)
      .filter((r) => r.level === 'critical' && r.status === 'active')
      .forEach((r) => {
        recs.push({
          id:       `risk-crit-${r.id}-${seq++}`,
          category: 'immediate',
          urgency:  5, impact: 5,
          title:    `Risco crítico ativo: ${r.title}`,
          detail:   r.description.slice(0, 100),
          module:   'Torre de Controle',
        })
      })

    // Overdue maintenance
    const today = new Date()
    maintenanceOrders
      .filter((o) => o.status !== 'completed' && o.status !== 'cancelled' && new Date(o.scheduledDate + 'T00:00:00') < today)
      .forEach((o) => {
        recs.push({
          id:       `maint-late-${o.id}-${seq++}`,
          category: 'week',
          urgency:  3, impact: 3,
          title:    `Manutenção vencida: ${o.id}`,
          detail:   `Tipo ${o.type} — responsável ${o.responsible}. Reagendar imediatamente.`,
          module:   'Gestão Equipamentos',
        })
      })

    // Pending reallocations
    const pendingRealoc = routingRecs.filter((r) => r.accepted === undefined)
    if (pendingRealoc.length > 0) {
      recs.push({
        id:       `realoc-${seq++}`,
        category: 'strategic',
        urgency:  2, impact: 3,
        title:    `${pendingRealoc.length} realocação(ões) de equipamento pendente(s)`,
        detail:   `Aceitar as otimizações sugeridas pode aumentar utilização da frota.`,
        module:   'Frota',
      })
    }

    // Sort: immediate → week → strategic, then urgency desc
    return recs.sort((a, b) => {
      const catOrder = { immediate: 0, week: 1, strategic: 2 }
      const catDiff = catOrder[a.category] - catOrder[b.category]
      if (catDiff !== 0) return catDiff
      return b.urgency - a.urgency
    })
  }, [projects, healthScores, changeOrders, sites, maintenanceOrders, routingRecs])

  return (
    <div className="flex flex-col gap-5">
      {/* Feed header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[#e4f2f8] text-sm font-semibold">Centro de Comando — Feed Unificado</p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            {feed.length} ocorrência{feed.length !== 1 ? 's' : ''} ativa{feed.length !== 1 ? 's' : ''} em todos os módulos
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['critical', 'high', 'medium'] as const).map((sev) => {
            const count = feed.filter((f) => f.severity === sev).length
            if (count === 0) return null
            return (
              <span
                key={sev}
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{ backgroundColor: `${SEVERITY_COLOR[sev]}18`, color: SEVERITY_COLOR[sev] }}
              >
                {SEVERITY_LABEL[sev]}: {count}
              </span>
            )
          })}
        </div>
      </div>

      {/* Feed list */}
      {feed.length === 0 ? (
        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-8 text-center">
          <p className="text-[#22c55e] text-sm font-semibold mb-1">Tudo sob controle!</p>
          <p className="text-[#6b6b6b] text-xs">Nenhuma ocorrência crítica ou pendente em todos os módulos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {feed.map((item) => {
            const Icon  = item.icon
            const color = SEVERITY_COLOR[item.severity]
            return (
              <div
                key={item.id}
                className="bg-[#14294e] border border-[#20406a] rounded-xl p-3 flex items-start gap-3"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: `${color}18` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0" style={{ backgroundColor: `${color}18`, color }}>
                      {SEVERITY_LABEL[item.severity]}
                    </span>
                    <span className="text-[#6b6b6b] text-[10px] shrink-0">{item.module}</span>
                  </div>
                  <p className="text-[#e4f2f8] text-xs font-semibold">{item.title}</p>
                  <p className="text-[#6b6b6b] text-[11px] mt-0.5 leading-relaxed">{item.detail}</p>
                </div>
                <Link
                  to={item.link}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg shrink-0 text-[#6b6b6b] text-[10px] font-semibold border border-[#20406a] hover:border-[#2abfdc]/50 hover:text-[#2abfdc] transition-colors"
                >
                  Ver módulo <ArrowRight size={10} />
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Intelligent Optimizations */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-[#2abfdc]" />
          <h3 className="text-[#e4f2f8] text-sm font-semibold">Otimizações Inteligentes</h3>
          <span className="text-[#6b6b6b] text-xs">({recommendations.length} sugestão{recommendations.length !== 1 ? 'ões' : ''})</span>
        </div>

        {recommendations.length === 0 ? (
          <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-6 text-center">
            <AlertTriangle size={24} className="text-[#22c55e] mx-auto mb-2" />
            <p className="text-[#22c55e] text-sm font-semibold">Nenhuma otimização necessária — tudo sob controle!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recommendation cards */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              {(['immediate', 'week', 'strategic'] as const).map((cat) => {
                const catRecs = recommendations.filter((r) => r.category === cat)
                if (catRecs.length === 0) return null
                const color = REC_CATEGORY_COLOR[cat]
                return (
                  <div key={cat} className="bg-[#14294e] border border-[#20406a] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#20406a] flex items-center gap-2" style={{ borderLeft: `3px solid ${color}` }}>
                      <span className="text-xs font-bold" style={{ color }}>{REC_CATEGORY_LABEL[cat]}</span>
                      <span className="text-[#6b6b6b] text-[10px]">({catRecs.length})</span>
                    </div>
                    <div className="flex flex-col divide-y divide-[#20406a]">
                      {catRecs.map((rec) => (
                        <div key={rec.id} className="px-4 py-2.5 flex items-start gap-2">
                          <div className="shrink-0 mt-0.5 w-2 h-2 rounded-full mt-1" style={{ background: color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[#e4f2f8] text-xs font-semibold">{rec.title}</p>
                            <p className="text-[#6b6b6b] text-[11px] mt-0.5">{rec.detail}</p>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#20406a] text-[#5a8caa] shrink-0 whitespace-nowrap">{rec.module}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Priority Matrix */}
            <div>
              <PriorityMatrix recs={recommendations} />
            </div>
          </div>
        )}
      </div>

      {/* Module quick links */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4">
        <ModuleQuickLinks exclude={['/gestao-360']} />
      </div>
    </div>
  )
}
