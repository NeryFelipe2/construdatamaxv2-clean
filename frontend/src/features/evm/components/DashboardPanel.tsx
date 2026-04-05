/**
 * DashboardPanel — Health semaphore, S-Curve chart (4 lines), root cause analysis,
 * EAC scenario cards, stock alerts, and alert cards for the EVM module.
 */
import { AlertTriangle, CheckCircle, TrendingDown, Package, Activity, ShieldAlert, Target, BarChart3 } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { formatCurrency } from '@/lib/utils'

/* ─── SVG Chart Constants ─────────────────────────────────────────── */
const W = 900
const H = 400
const PAD = { left: 60, right: 30, top: 20, bottom: 50 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const GRID_PCTS = [0, 25, 50, 75, 100]

const SERIES: {
  key: 'plannedFinancialPct' | 'actualPhysicalPct' | 'earnedValuePct' | 'actualCostPct'
  color: string
  label: string
  dash?: string
}[] = [
  { key: 'plannedFinancialPct', color: '#38bdf8', label: 'PV — Planejado Financeiro' },
  { key: 'actualPhysicalPct',   color: '#22c55e', label: 'AC — Físico Realizado' },
  { key: 'earnedValuePct',      color: '#f97316', label: 'EV — Valor Agregado' },
  { key: 'actualCostPct',       color: '#ef4444', label: 'AC — Custo Real', dash: '6 3' },
]

const PILLAR_COLORS: Record<string, string> = {
  material: '#38bdf8',
  equipamento: '#f97316',
  mao_de_obra: '#22c55e',
  impostos_indiretos: '#a78bfa',
}

const PILLAR_LABELS_SHORT: Record<string, string> = {
  material: 'Material',
  equipamento: 'Equipamento',
  mao_de_obra: 'MO',
  impostos_indiretos: 'Impostos',
}

const HEALTH_CONFIG = {
  blue: {
    color: '#38bdf8',
    bgColor: '#38bdf8',
    label: 'Obra Eficiente — IDP > 1 e IDC > 1',
    icon: CheckCircle,
    iconColor: 'text-sky-400',
  },
  yellow: {
    color: '#eab308',
    bgColor: '#eab308',
    label: 'Atenção — Gastando conforme plano, mas atrasado no prazo',
    icon: AlertTriangle,
    iconColor: 'text-yellow-400',
  },
  red: {
    color: '#ef4444',
    bgColor: '#ef4444',
    label: 'Risco Crítico — Atrasado e estourando orçamento',
    icon: ShieldAlert,
    iconColor: 'text-red-400',
  },
} as const

/* ─── Component ───────────────────────────────────────────────────── */

export function DashboardPanel() {
  const { sCurveData, evmMetrics } = useEvmStore()
  const { CPI, SPI, BAC, pillarDeviations, eacScenarios, stockAlerts, healthStatus } = evmMetrics
  const n = sCurveData.length

  /* Chart helpers */
  function toX(i: number) {
    if (n <= 1) return PAD.left
    return PAD.left + (i / (n - 1)) * PLOT_W
  }

  function toY(pct: number) {
    return PAD.top + PLOT_H - (pct / 100) * PLOT_H
  }

  function polylinePoints(key: 'plannedFinancialPct' | 'actualPhysicalPct' | 'earnedValuePct' | 'actualCostPct') {
    return sCurveData.map((pt, i) => `${toX(i)},${toY(pt[key])}`).join(' ')
  }

  function monthLabel(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  }

  const costAlert = CPI < 1
  const scheduleAlert = SPI < 1
  const allGood = CPI >= 1 && SPI >= 1

  const health = HEALTH_CONFIG[healthStatus] ?? HEALTH_CONFIG.blue
  const HealthIcon = health.icon

  /* EAC trend overshoot percentage */
  const trendOvershootPct = BAC > 0
    ? (((eacScenarios?.trend ?? 0) - BAC) / BAC) * 100
    : 0

  /* Total deviation for root cause bar */
  const totalDeviation = pillarDeviations?.reduce((sum, p) => sum + Math.abs(p.deviation), 0) ?? 0

  /* Total imobilizado for stock alerts */
  const totalImobilizado = stockAlerts?.reduce((sum, s) => sum + s.custoImobilizado, 0) ?? 0

  return (
    <div className="p-6 space-y-6 bg-[#2c2c2c] min-h-full">

      {/* ── Health Semaphore ──────────────────────────────────────── */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5 flex items-center gap-5">
        <div
          className="w-16 h-16 rounded-full shrink-0 shadow-lg flex items-center justify-center"
          style={{
            backgroundColor: health.bgColor,
            boxShadow: `0 0 28px ${health.bgColor}55`,
          }}
        >
          <HealthIcon size={28} className="text-[#1a1a1a]" />
        </div>
        <div>
          <p className="text-[#f5f5f5] text-lg font-bold">{health.label}</p>
          <p className="text-[#a3a3a3] text-sm mt-1">
            IDC (CPI) = {CPI.toFixed(2)} &nbsp;|&nbsp; IDP (SPI) = {SPI.toFixed(2)}
            &nbsp;|&nbsp; BAC = {formatCurrency(BAC)}
          </p>
        </div>
      </div>

      {/* ── S-Curve Chart (4 lines) ──────────────────────────────── */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-[#a3a3a3]" />
          <h2 className="text-[#f5f5f5] text-sm font-semibold">Curva S Multidimensional</h2>
        </div>

        {n === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-[#6b6b6b] text-sm">
            Nenhum dado de curva S. Clique em &quot;Carregar Demo&quot; para visualizar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full max-w-[900px] mx-auto"
              style={{ backgroundColor: '#0d1626' }}
            >
              {/* Grid lines */}
              {GRID_PCTS.map((pct) => (
                <g key={pct}>
                  <line
                    x1={PAD.left}
                    y1={toY(pct)}
                    x2={W - PAD.right}
                    y2={toY(pct)}
                    stroke="#1e293b"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 8}
                    y={toY(pct) + 4}
                    fill="#64748b"
                    fontSize={11}
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {pct}%
                  </text>
                </g>
              ))}

              {/* X-axis labels */}
              {sCurveData.map((pt, i) => {
                /* Show every label if <= 12 points, otherwise every other */
                const skip = n > 12 ? Math.ceil(n / 12) : 1
                if (i % skip !== 0 && i !== n - 1) return null
                return (
                  <text
                    key={pt.date}
                    x={toX(i)}
                    y={H - 8}
                    fill="#64748b"
                    fontSize={10}
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {monthLabel(pt.date)}
                  </text>
                )
              })}

              {/* Data polylines */}
              {SERIES.map((s) => (
                <polyline
                  key={s.key}
                  points={polylinePoints(s.key)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dash}
                />
              ))}

              {/* Data dots */}
              {SERIES.map((s) =>
                sCurveData.map((pt, i) => (
                  <circle
                    key={`${s.key}-${i}`}
                    cx={toX(i)}
                    cy={toY(pt[s.key])}
                    r={3}
                    fill={s.color}
                  />
                )),
              )}
            </svg>

            {/* Legend */}
            <div className="flex items-center gap-6 justify-center mt-3 flex-wrap">
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-[#a3a3a3] text-xs">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Root Cause Panel — only when CPI < 1 ─────────────────── */}
      {CPI < 1 && pillarDeviations && pillarDeviations.length > 0 && (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-red-400" />
            <h2 className="text-[#f5f5f5] text-sm font-semibold">
              Análise de Causa Raiz — Desvio de Custo
            </h2>
          </div>

          {/* Stacked horizontal bar */}
          <div className="mb-4">
            <div className="w-full h-10 rounded-lg overflow-hidden flex">
              {pillarDeviations.map((p) => {
                const absDev = Math.abs(p.deviation)
                const widthPct = totalDeviation > 0 ? (absDev / totalDeviation) * 100 : 0
                return (
                  <div
                    key={p.pillar}
                    className="h-full flex items-center justify-center text-[10px] font-semibold text-[#1a1a1a] transition-all"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: PILLAR_COLORS[p.pillar] ?? '#6b7280',
                      minWidth: widthPct > 0 ? '40px' : '0px',
                    }}
                    title={`${p.label}: ${(p.deviationPct * 100).toFixed(1)}% — ${formatCurrency(p.deviation)}`}
                  >
                    {widthPct >= 10
                      ? `${PILLAR_LABELS_SHORT[p.pillar] ?? p.label} ${(p.deviationPct * 100).toFixed(0)}%`
                      : ''}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pillarDeviations.map((p) => (
              <div
                key={p.pillar}
                className="bg-[#2c2c2c] rounded-lg p-3 border-l-4"
                style={{ borderLeftColor: PILLAR_COLORS[p.pillar] ?? '#6b7280' }}
              >
                <p className="text-[#a3a3a3] text-[10px] uppercase tracking-wide">{p.label}</p>
                <p className="text-[#f5f5f5] text-sm font-semibold mt-1">
                  {formatCurrency(Math.abs(p.deviation))}
                </p>
                <p className="text-[#a3a3a3] text-xs mt-0.5">
                  {(p.deviationPct * 100).toFixed(1)}% do desvio total
                </p>
                <p className="text-[#6b6b6b] text-[10px] mt-1">
                  Orçado: {formatCurrency(p.budgeted)} &rarr; Real: {formatCurrency(p.actual)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── EAC Scenarios (3 cards) ──────────────────────────────── */}
      {eacScenarios && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-[#a3a3a3]" />
            <h2 className="text-[#f5f5f5] text-sm font-semibold">
              Cenários de EAC (Estimativa ao Término)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Otimista */}
            <div className="bg-[#3d3d3d] border-2 border-green-600 rounded-xl p-4">
              <p className="text-green-400 text-xs font-semibold uppercase tracking-wide">
                Otimista
              </p>
              <p className="text-[#f5f5f5] text-xl font-bold mt-2">
                {formatCurrency(eacScenarios.optimistic)}
              </p>
              <p className="text-[#a3a3a3] text-xs mt-2">
                Cenário onde os desvios são corrigidos e a obra retorna ao orçamento original (BAC).
              </p>
            </div>

            {/* Tendência */}
            <div className="bg-[#3d3d3d] border-2 border-yellow-600 rounded-xl p-4">
              <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wide">
                Tendência
              </p>
              <p className="text-[#f5f5f5] text-xl font-bold mt-2">
                {formatCurrency(eacScenarios.trend)}
              </p>
              <p className="text-[#a3a3a3] text-xs mt-2">
                {trendOvershootPct > 0
                  ? `Se continuar com este ritmo, a obra terminará com ${trendOvershootPct.toFixed(1)}% de estouro orçamentário.`
                  : 'Projeção baseada no CPI atual mantido até o final.'}
              </p>
            </div>

            {/* Pessimista */}
            <div className="bg-[#3d3d3d] border-2 border-red-600 rounded-xl p-4">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wide">
                Pessimista
              </p>
              <p className="text-[#f5f5f5] text-xl font-bold mt-2">
                {formatCurrency(eacScenarios.pessimistic)}
              </p>
              <p className="text-[#a3a3a3] text-xs mt-2">
                Cenário com agravamento dos desvios atuais considerando riscos adicionais.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Alerts ─────────────────────────────────────────── */}
      {stockAlerts && stockAlerts.length > 0 && (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center">
              <Package size={16} className="text-amber-400" />
            </div>
            <h2 className="text-[#f5f5f5] text-sm font-semibold">
              Estoque Imobilizado Crítico
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#525252]">
                  <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2">Item</th>
                  <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Comprado</th>
                  <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Instalado</th>
                  <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Imobilizado</th>
                  <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Custo</th>
                </tr>
              </thead>
              <tbody>
                {stockAlerts.map((s) => (
                  <tr
                    key={s.itemId}
                    className="border-b border-[#525252]/50 hover:bg-[#484848]/30 transition-colors"
                  >
                    <td className="px-4 py-2 text-[#f5f5f5] text-sm">{s.description}</td>
                    <td className="px-4 py-2 text-[#a3a3a3] text-sm text-right font-mono">
                      {s.qtdComprada.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2 text-[#a3a3a3] text-sm text-right font-mono">
                      {s.qtdInstalada.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2 text-amber-400 text-sm text-right font-mono font-semibold">
                      {s.qtdImobilizada.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2 text-red-400 text-sm text-right font-mono font-semibold">
                      {formatCurrency(s.custoImobilizado)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#2c2c2c]/70 border-t-2 border-[#525252]">
                  <td colSpan={3} className="px-4 py-2 text-[#f5f5f5] text-sm font-semibold">
                    Total Imobilizado
                  </td>
                  <td className="px-4 py-2 text-amber-400 text-sm text-right font-mono font-bold">
                    {stockAlerts
                      .reduce((sum, s) => sum + s.qtdImobilizada, 0)
                      .toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2 text-red-400 text-sm text-right font-mono font-bold">
                    {formatCurrency(totalImobilizado)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Alert Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {costAlert && (
          <div className="bg-[#3d3d3d] border border-red-700/50 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-900/40 flex items-center justify-center shrink-0">
              <TrendingDown size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-red-400 text-sm font-semibold">Custo acima do planejado</p>
              <p className="text-[#a3a3a3] text-xs mt-1">
                CPI = {CPI.toFixed(2)} — O custo real excede o valor agregado. Revise as contas de
                custo.
              </p>
            </div>
          </div>
        )}

        {scheduleAlert && (
          <div className="bg-[#3d3d3d] border border-amber-700/50 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-amber-400 text-sm font-semibold">Prazo atrasado</p>
              <p className="text-[#a3a3a3] text-xs mt-1">
                SPI = {SPI.toFixed(2)} — O progresso real está abaixo do planejado. Verifique o
                cronograma.
              </p>
            </div>
          </div>
        )}

        {allGood && (
          <div className="bg-[#3d3d3d] border border-green-700/50 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-900/40 flex items-center justify-center shrink-0">
              <CheckCircle size={16} className="text-green-400" />
            </div>
            <div>
              <p className="text-green-400 text-sm font-semibold">Projeto dentro das metas</p>
              <p className="text-[#a3a3a3] text-xs mt-1">
                CPI = {CPI.toFixed(2)}, SPI = {SPI.toFixed(2)} — Custo e prazo dentro do esperado.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
