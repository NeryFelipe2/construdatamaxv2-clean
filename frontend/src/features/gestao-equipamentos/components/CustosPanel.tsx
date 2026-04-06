import { Download } from 'lucide-react'
import { useEquipamentosStore } from '@/store/equipamentosStore'

// ─── Hourly rate by equipment type ───────────────────────────────────────────

function hourlyRateForType(type: string): number {
  const HEAVY_TYPES = [
    'Guindaste',
    'Bomba Estacionária',
    'Escavadeira',
    'Escavadeira Hidráulica',
    'Guindaste Torre',
  ]
  return HEAVY_TYPES.some((t) => type.includes(t)) ? 45 : 25
}

// ─── Type groups for the distribution chart ──────────────────────────────────

const TYPE_GROUPS: { label: string; match: (t: string) => boolean; color: string }[] = [
  {
    label: 'Plataforma Elevatória',
    match: (t) => t.toLowerCase().includes('plataforma') || t.toLowerCase().includes('tesoura'),
    color: '#f97316',
  },
  {
    label: 'Bomba de Concreto',
    match: (t) => t.toLowerCase().includes('bomba'),
    color: '#3b82f6',
  },
  {
    label: 'Guindaste Torre',
    match: (t) => t.toLowerCase().includes('guindaste'),
    color: '#8b5cf6',
  },
  {
    label: 'Retroescavadeira',
    match: (t) => t.toLowerCase().includes('escavad'),
    color: '#ef4444',
  },
  {
    label: 'Outros',
    match: () => true,
    color: '#6b6b6b',
  },
]

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 bg-[#2c2c2c] border border-[#525252] rounded-xl px-5 py-4">
      <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">
        {label}
      </span>
      <span
        className="text-2xl font-bold leading-tight"
        style={{ color: accent ? '#f97316' : '#f5f5f5' }}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-[#6b6b6b]">{sub}</span>}
    </div>
  )
}

// ─── Bar chart for cost distribution ─────────────────────────────────────────

function CostDistributionChart({
  groups,
}: {
  groups: { label: string; cost: number; color: string }[]
}) {
  const SVG_W  = 560
  const SVG_H  = 180
  const LEFT   = 16
  const RIGHT  = 16
  const TOP    = 16
  const BOTTOM = 48   // space for X-axis labels
  const plotW  = SVG_W - LEFT - RIGHT
  const plotH  = SVG_H - TOP - BOTTOM
  const n      = groups.length
  const maxC   = groups.length > 0 ? Math.max(...groups.map((g) => g.cost), 1) : 1
  const groupW = Math.floor(plotW / n)
  const barW   = Math.floor(groupW * 0.55)
  const barGap = Math.floor((groupW - barW) / 2)

  function truncate(s: string, n2 = 14) {
    return s.length > n2 ? s.slice(0, n2 - 1) + '…' : s
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height={SVG_H}
      style={{ display: 'block' }}
    >
      {/* Baseline */}
      <line
        x1={LEFT}
        y1={TOP + plotH}
        x2={LEFT + plotW}
        y2={TOP + plotH}
        stroke="#525252"
        strokeWidth={1}
      />

      {groups.map((g, i) => {
        const barH  = maxC > 0 ? Math.round((g.cost / maxC) * plotH) : 0
        const x     = LEFT + i * groupW + barGap
        const y     = TOP + plotH - barH
        const cx    = LEFT + i * groupW + groupW / 2

        return (
          <g key={g.label}>
            {/* Bar */}
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={g.color} opacity={0.8} />

            {/* Value above bar */}
            {barH > 14 && (
              <text
                x={cx}
                y={y - 6}
                textAnchor="middle"
                fontSize={9}
                fill="#a3a3a3"
                fontFamily="system-ui, sans-serif"
              >
                {g.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </text>
            )}

            {/* X-axis label */}
            <text
              x={cx}
              y={TOP + plotH + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#6b6b6b"
              fontFamily="system-ui, sans-serif"
            >
              {truncate(g.label)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── CSV export helper ────────────────────────────────────────────────────────

function downloadCSV(csvString: string, filename: string) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CustosPanel() {
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)

  // Build row data
  const rows = equipamentos.map((eq) => {
    const rate    = hourlyRateForType(eq.type)
    const monthly = Math.round(rate * eq.engineHours)
    return { eq, rate, monthly }
  }).sort((a, b) => b.monthly - a.monthly)

  // KPI values
  const totalFleet = rows.reduce((sum, r) => sum + r.monthly, 0)
  const totalHours = equipamentos.reduce((sum, e) => sum + e.engineHours, 0)
  const avgPerHour = totalHours > 0 ? totalFleet / totalHours : 0
  const maxRow     = rows.length > 0 ? rows[0] : null

  // Cost distribution by type group
  const groupCosts = TYPE_GROUPS.map((g) => {
    const grouped = rows.filter((r) => g.match(r.eq.type))
    const cost    = grouped.reduce((s, r) => s + r.monthly, 0)
    return { label: g.label, cost, color: g.color, count: grouped.length }
  })
  const chartGroups = groupCosts.filter((g) => g.cost > 0)

  // Type analysis table data
  const typeAnalysis = chartGroups
    .filter((g) => g.count > 0)
    .map((g) => ({
      label:   g.label,
      count:   g.count,
      total:   g.cost,
      average: g.count > 0 ? Math.round(g.cost / g.count) : 0,
      pct:     totalFleet > 0 ? (g.cost / totalFleet) * 100 : 0,
    }))

  function handleExportCSV() {
    const header = ['Equipamento', 'Codigo', 'Tipo', 'Custo/h (R$)', 'Horas', 'Custo Mensal (R$)']
    const dataRows = rows.map(({ eq, rate, monthly }) => [
      eq.name,
      eq.code,
      eq.type,
      rate.toFixed(2),
      eq.engineHours.toString(),
      monthly.toFixed(2),
    ])
    const csv = [header, ...dataRows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    downloadCSV(csv, 'custos-frota.csv')
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Custo Total Frota"
          value={totalFleet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          sub="Soma estimada mensal"
          accent
        />
        <KpiCard
          label="Custo Médio / Hora"
          value={avgPerHour.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          sub={`${totalHours.toLocaleString('pt-BR')}h totais`}
        />
        <KpiCard
          label="Maior Custo Individual"
          value={
            maxRow
              ? maxRow.monthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : '—'
          }
          sub={maxRow ? maxRow.eq.name : ''}
        />
      </div>

      {/* Distribution chart */}
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Distribuição de Custos por Tipo de Equipamento
        </h2>
        <CostDistributionChart groups={chartGroups} />
      </div>

      {/* ── Análise por Tipo ── */}
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Análise por Tipo
        </h2>
        {maxRow && (
          <p className="text-xs text-[#6b6b6b]">
            Equipamento mais caro:{' '}
            <span className="text-[#f5f5f5] font-semibold">{maxRow.eq.name}</span>
            {' '}({maxRow.monthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês)
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#525252]">
                {['Tipo', 'Qtd', 'Custo Total', 'Custo Médio', '% do Total'].map((col) => (
                  <th
                    key={col}
                    className="text-left text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold pb-2 pr-5 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3d3d]">
              {typeAnalysis.map((row) => (
                <tr key={row.label} className="hover:bg-[#3d3d3d]/50 transition-colors">
                  <td className="py-2.5 pr-5 text-[#f5f5f5] font-medium">{row.label}</td>
                  <td className="py-2.5 pr-5 text-[#a3a3a3]">{row.count}</td>
                  <td className="py-2.5 pr-5 text-[#f97316] font-mono">
                    {row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-2.5 pr-5 text-[#a3a3a3] font-mono">
                    {row.average.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-2.5 pr-5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#3d3d3d] rounded-full h-1.5" style={{ maxWidth: 60 }}>
                        <div
                          className="bg-[#f97316] h-1.5 rounded-full"
                          style={{ width: `${row.pct.toFixed(1)}%` }}
                        />
                      </div>
                      <span className="text-[#a3a3a3] font-mono shrink-0">{row.pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost table + CSV export */}
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
            Custos por Equipamento
          </h2>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors"
          >
            <Download size={11} />
            Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#525252]">
                {['Equipamento', 'Custo/Hora (R$)', 'Horas Este Mês', 'Custo Mensal (R$)'].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold pb-2 pr-6 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3d3d]">
              {rows.map(({ eq, rate, monthly }) => (
                <tr key={eq.id} className="hover:bg-[#3d3d3d]/50 transition-colors">
                  <td className="py-2.5 pr-6">
                    <div className="flex flex-col">
                      <span className="text-[#f5f5f5] font-medium">{eq.name}</span>
                      <span className="text-[10px] text-[#6b6b6b]">{eq.code} · {eq.type}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-6 text-[#a3a3a3] font-mono">
                    {rate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-2.5 pr-6 text-[#f5f5f5] font-mono">
                    {eq.engineHours.toLocaleString('pt-BR')}h
                  </td>
                  <td className="py-2.5 pr-6">
                    <span className="text-[#f97316] font-semibold font-mono">
                      {monthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#525252]">
                <td colSpan={3} className="pt-2.5 pr-6 text-[10px] text-[#6b6b6b] font-semibold uppercase tracking-widest">
                  Total Frota
                </td>
                <td className="pt-2.5 font-bold text-[#f97316] font-mono">
                  {totalFleet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  )
}
