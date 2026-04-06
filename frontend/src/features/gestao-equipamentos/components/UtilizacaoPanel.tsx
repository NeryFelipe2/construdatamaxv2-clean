import { useEquipamentosStore } from '@/store/equipamentosStore'

// ─── Mock weekly utilization data ─────────────────────────────────────────────
const WEEKLY_DATA  = [85, 78, 82, 91, 88, 76, 83, 87]
const WEEK_LABELS  = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']

// ─── Line chart ───────────────────────────────────────────────────────────────

function LineChart() {
  const SVG_W  = 600
  const SVG_H  = 200
  const LEFT   = 40
  const RIGHT  = 20
  const TOP    = 16
  const BOTTOM = 28
  const plotW  = SVG_W - LEFT - RIGHT
  const plotH  = SVG_H - TOP - BOTTOM
  const n      = WEEKLY_DATA.length

  const yGridLines = [0, 25, 50, 75, 100]

  function xPos(i: number) {
    return LEFT + (i / (n - 1)) * plotW
  }
  function yPos(v: number) {
    return TOP + plotH - (v / 100) * plotH
  }

  const polyline = WEEKLY_DATA.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height={SVG_H}
      style={{ display: 'block' }}
    >
      {/* Y grid lines + labels */}
      {yGridLines.map((pct) => (
        <g key={pct}>
          <line
            x1={LEFT}
            y1={yPos(pct)}
            x2={LEFT + plotW}
            y2={yPos(pct)}
            stroke="#3d3d3d"
            strokeWidth={1}
          />
          <text
            x={LEFT - 6}
            y={yPos(pct) + 1}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={9}
            fill="#6b6b6b"
            fontFamily="system-ui, sans-serif"
          >
            {pct}%
          </text>
        </g>
      ))}

      {/* X axis labels */}
      {WEEK_LABELS.map((label, i) => (
        <text
          key={label}
          x={xPos(i)}
          y={TOP + plotH + 16}
          textAnchor="middle"
          fontSize={9}
          fill="#6b6b6b"
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      ))}

      {/* Area fill under line */}
      <polygon
        points={[
          `${xPos(0)},${TOP + plotH}`,
          ...WEEKLY_DATA.map((v, i) => `${xPos(i)},${yPos(v)}`),
          `${xPos(n - 1)},${TOP + plotH}`,
        ].join(' ')}
        fill="#f97316"
        fillOpacity={0.08}
      />

      {/* Orange line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#f97316"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots at each data point */}
      {WEEKLY_DATA.map((v, i) => (
        <circle
          key={i}
          cx={xPos(i)}
          cy={yPos(v)}
          r={3.5}
          fill="#f97316"
          stroke="#333333"
          strokeWidth={1.5}
        />
      ))}

      {/* Value labels above dots */}
      {WEEKLY_DATA.map((v, i) => (
        <text
          key={i}
          x={xPos(i)}
          y={yPos(v) - 9}
          textAnchor="middle"
          fontSize={9}
          fill="#a3a3a3"
          fontFamily="system-ui, sans-serif"
        >
          {v}%
        </text>
      ))}
    </svg>
  )
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────

function HoursBarChart({ data }: { data: { name: string; hours: number }[] }) {
  const SVG_H  = Math.max(data.length * 34 + 20, 60)
  const SVG_W  = 560
  const LEFT   = 150
  const RIGHT  = 60
  const TOP    = 8
  const plotW  = SVG_W - LEFT - RIGHT
  const maxH   = data.length > 0 ? Math.max(...data.map((d) => d.hours)) : 1
  const barH   = 16
  const rowH   = 34

  function truncate(s: string, n = 20) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height={SVG_H}
      style={{ display: 'block' }}
    >
      {data.map((item, i) => {
        const y    = TOP + i * rowH
        const barW = maxH > 0 ? Math.round((item.hours / maxH) * plotW) : 0
        const barY = y + Math.floor((rowH - barH) / 2)
        return (
          <g key={item.name}>
            <text
              x={LEFT - 8}
              y={barY + barH / 2 + 1}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="#a3a3a3"
              fontFamily="system-ui, sans-serif"
            >
              {truncate(item.name)}
            </text>
            {/* Background */}
            <rect x={LEFT} y={barY} width={plotW} height={barH} rx={3} fill="#3d3d3d" />
            {/* Fill */}
            {barW > 0 && (
              <rect x={LEFT} y={barY} width={barW} height={barH} rx={3} fill="#f97316" opacity={0.8} />
            )}
            {/* Value */}
            <text
              x={LEFT + barW + 6}
              y={barY + barH / 2 + 1}
              dominantBaseline="middle"
              fontSize={9}
              fill="#6b6b6b"
              fontFamily="system-ui, sans-serif"
            >
              {item.hours.toLocaleString('pt-BR')}h
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UtilizacaoPanel() {
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)

  // Sort all equipment descending by engineHours for bar chart
  const sorted = [...equipamentos].sort((a, b) => b.engineHours - a.engineHours)
  const barData = sorted.map((eq) => ({ name: eq.name, hours: eq.engineHours }))

  // Table rows
  const tableRows = sorted.map((eq) => {
    const productive = Math.round(eq.engineHours * 0.75)
    const idle       = Math.round(eq.engineHours * 0.25)
    const rate       = eq.engineHours > 0
      ? ((productive / eq.engineHours) * 100).toFixed(1)
      : '0.0'
    return { eq, productive, idle, rate }
  })

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">

      {/* Line chart */}
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Taxa de Utilização da Frota (%) — Últimas 8 Semanas
        </h2>
        <LineChart />
        <p className="text-[10px] text-[#3f3f3f]">
          Dados simulados para ilustração do comportamento semanal da frota.
        </p>
      </div>

      {/* Horizontal bar chart */}
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Horas por Equipamento — Este Mês
        </h2>
        <HoursBarChart data={barData} />
      </div>

      {/* Table */}
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Detalhamento por Equipamento
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#525252]">
                {['Equipamento', 'Horas Totais', 'Horas Prod.', 'Horas Ociosas', 'Taxa'].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold pb-2 pr-4 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3d3d]">
              {tableRows.map(({ eq, productive, idle, rate }) => (
                <tr key={eq.id} className="hover:bg-[#3d3d3d]/50 transition-colors">
                  <td className="py-2.5 pr-4">
                    <div className="flex flex-col">
                      <span className="text-[#f5f5f5] font-medium">{eq.name}</span>
                      <span className="text-[10px] text-[#6b6b6b]">{eq.code}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-[#f5f5f5] font-mono">
                    {eq.engineHours.toLocaleString('pt-BR')}h
                  </td>
                  <td className="py-2.5 pr-4 text-[#4ade80] font-mono">
                    {productive.toLocaleString('pt-BR')}h
                  </td>
                  <td className="py-2.5 pr-4 text-[#f97316] font-mono">
                    {idle.toLocaleString('pt-BR')}h
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 max-w-[80px] h-1.5 bg-[#525252] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#f97316] rounded-full"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-[#a3a3a3] font-mono text-[10px]">{rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
