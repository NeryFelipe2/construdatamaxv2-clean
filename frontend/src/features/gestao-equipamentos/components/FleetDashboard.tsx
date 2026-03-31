import { useShallow } from 'zustand/react/shallow'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { STATUS_CONFIG } from '../../equipamentos/constants'
import type { EquipmentProfile, EquipmentStatus } from '@/types'

// ─── Status colour map for bar chart ──────────────────────────────────────────

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  active:      '#22c55e',
  idle:        '#2abfdc',
  maintenance: '#3b82f6',
  alert:       '#ef4444',
  offline:     '#6b6b6b',
}

const TYPE_LABEL: Record<string, string> = {
  preventive:  'Preventiva',
  corrective:  'Corretiva',
  predictive:  'Preditiva',
}

const TYPE_BADGE_COLOR: Record<string, string> = {
  preventive:  'bg-[#1d4ed8]/20 text-[#60a5fa]',
  corrective:  'bg-[#ef4444]/20 text-[#f87171]',
  predictive:  'bg-[#ca8a04]/20 text-[#fbbf24]',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 bg-[#0d2040] border border-[#20406a] rounded-xl px-5 py-4">
      <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">
        {label}
      </span>
      <span
        className="text-2xl font-bold leading-tight"
        style={{ color: accent ? '#2abfdc' : '#f5f5f5' }}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-[#6b6b6b]">{sub}</span>}
    </div>
  )
}

// ─── EquipCard ────────────────────────────────────────────────────────────────

function EquipCard({ equip }: { equip: EquipmentProfile }) {
  const statusCfg = STATUS_CONFIG[equip.status]
  return (
    <div className="bg-[#0d2040] border border-[#20406a] rounded-xl px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#f5f5f5] truncate">{equip.name}</p>
          <p className="text-[10px] text-[#6b6b6b]">{equip.code}</p>
        </div>
        <span
          className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: statusCfg.colorMuted, color: statusCfg.color }}
        >
          {statusCfg.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-[#6b6b6b]">
        <span>Horas: <span className="text-[#a3a3a3]">{equip.engineHours.toLocaleString('pt-BR')}h</span></span>
        {equip.operator && <span className="truncate">Op: <span className="text-[#a3a3a3]">{equip.operator}</span></span>}
        {equip.nextMaintenance && (
          <span className="col-span-2">
            Próx. mant.: <span className="text-[#a3a3a3]">
              {new Date(equip.nextMaintenance + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
          </span>
        )}
      </div>
      <button
        onClick={() => useEquipamentosStore.getState().setEditing(equip.id)}
        className="self-end text-[10px] px-2 py-0.5 rounded border border-[#20406a] text-[#6b6b6b] hover:text-[#2abfdc] hover:border-[#2abfdc]/40 transition-colors"
      >
        Editar
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FleetDashboard() {
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)
  const { orders } = useGestaoEquipamentosStore(
    useShallow((s) => ({ orders: s.orders })),
  )

  // ── KPI calculations ──────────────────────────────────────────────────────
  const total        = equipamentos.length
  const activeCount  = equipamentos.filter((e) => e.status === 'active').length
  const idleCount    = equipamentos.filter((e) => e.status === 'idle').length
  const maintCount   = equipamentos.filter((e) => e.status === 'maintenance').length
  const availability = total > 0 ? Math.round(((activeCount + idleCount) / total) * 100) : 0

  const monthlyCost = orders
    .filter((o) => o.status === 'scheduled' || o.status === 'in_progress')
    .reduce((sum, o) => sum + o.estimatedCost, 0)

  // ── Bar chart data (top 6 by engineHours) ────────────────────────────────
  const top6 = [...equipamentos]
    .sort((a, b) => b.engineHours - a.engineHours)
    .slice(0, 6)

  const maxHours = top6.length > 0 ? Math.max(...top6.map((e) => e.engineHours)) : 1

  const SVG_W  = 480
  const SVG_H  = 240
  const LEFT   = 140   // space for equipment names
  const RIGHT  = 24
  const TOP    = 12
  const BOTTOM = 24
  const plotW  = SVG_W - LEFT - RIGHT
  const plotH  = SVG_H - TOP - BOTTOM
  const barH   = Math.floor((plotH / Math.max(top6.length, 1)) * 0.6)
  const rowH   = Math.floor(plotH / Math.max(top6.length, 1))

  function truncate(s: string, n = 18) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s
  }

  // ── Upcoming maintenance (scheduled, sorted asc, top 5) ──────────────────
  const upcoming = [...orders]
    .filter((o) => o.status === 'scheduled')
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, 5)

  function equipmentName(id: string) {
    return equipamentos.find((e) => e.id === id)?.name ?? id
  }
  function equipmentCode(id: string) {
    return equipamentos.find((e) => e.id === id)?.code ?? '—'
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Total da Frota"
          value={total}
          sub={`${activeCount} ativos agora`}
        />
        <KpiCard
          label="Disponibilidade"
          value={`${availability}%`}
          sub="Ativos + ociosos / total"
          accent
        />
        <KpiCard
          label="Em Manutenção"
          value={maintCount}
          sub={`${total - maintCount} operacionais`}
        />
        <KpiCard
          label="Custo Mensal Est."
          value={monthlyCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          sub="Agendadas + em execução"
        />
      </div>

      {/* ── 2-column grid ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* LEFT — horizontal bar chart */}
        <div className="bg-[#0d2040] border border-[#20406a] rounded-xl p-5 flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
            Utilização por Equipamento (horas)
          </h2>
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              width="100%"
              height={SVG_H}
              style={{ display: 'block' }}
            >
              {/* Y-axis labels + bars */}
              {top6.map((eq, i) => {
                const y    = TOP + i * rowH
                const barW = maxHours > 0 ? Math.round((eq.engineHours / maxHours) * plotW) : 0
                const barY = y + Math.floor((rowH - barH) / 2)
                const color = STATUS_COLOR[eq.status]
                return (
                  <g key={eq.id}>
                    {/* Name label */}
                    <text
                      x={LEFT - 8}
                      y={barY + barH / 2 + 1}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fontSize={10}
                      fill="#a3a3a3"
                      fontFamily="system-ui, sans-serif"
                    >
                      {truncate(eq.name)}
                    </text>
                    {/* Bar background */}
                    <rect
                      x={LEFT}
                      y={barY}
                      width={plotW}
                      height={barH}
                      rx={3}
                      fill="#14294e"
                    />
                    {/* Bar fill */}
                    {barW > 0 && (
                      <rect
                        x={LEFT}
                        y={barY}
                        width={barW}
                        height={barH}
                        rx={3}
                        fill={color}
                        opacity={0.85}
                      />
                    )}
                    {/* Hours value */}
                    <text
                      x={LEFT + barW + 6}
                      y={barY + barH / 2 + 1}
                      dominantBaseline="middle"
                      fontSize={9}
                      fill="#f5f5f5"
                      fontWeight="bold"
                      fontFamily="system-ui, sans-serif"
                    >
                      {eq.engineHours.toLocaleString('pt-BR')}h
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
            {(Object.entries(STATUS_COLOR) as [EquipmentStatus, string][]).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[10px] text-[#6b6b6b] capitalize">{status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — upcoming maintenance */}
        <div className="bg-[#0d2040] border border-[#20406a] rounded-xl p-5 flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
            Próximas Manutenções
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-xs text-[#6b6b6b] mt-2">Nenhuma OS agendada.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[#14294e]">
              {upcoming.map((order) => (
                <div key={order.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {/* Equipment info */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[#f5f5f5] truncate">
                      {equipmentName(order.equipmentId)}
                    </span>
                    <span className="text-[10px] text-[#6b6b6b]">
                      {equipmentCode(order.equipmentId)}
                    </span>
                  </div>
                  {/* Type badge */}
                  <span
                    className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      TYPE_BADGE_COLOR[order.type] ?? 'bg-[#20406a] text-[#a3a3a3]'
                    }`}
                  >
                    {TYPE_LABEL[order.type] ?? order.type}
                  </span>
                  {/* Date */}
                  <span className="shrink-0 text-[10px] text-[#a3a3a3] font-mono">
                    {new Date(order.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                  {/* Responsible */}
                  <span className="shrink-0 text-[10px] text-[#6b6b6b] hidden xl:block max-w-[90px] truncate">
                    {order.responsible}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── All equipment grid ── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Todos os Equipamentos
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {equipamentos.map((eq) => (
            <EquipCard key={eq.id} equip={eq} />
          ))}
        </div>
      </div>

    </div>
  )
}
