/**
 * TaktTimePanel — Takt Time visualization per zone/trecho.
 * Takt = totalDays / numZones. Visual = horizontal timeline with zone blocks.
 */
import { useMemo } from 'react'
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLpsStore } from '@/store/lpsStore'

function fmtDays(d: number): string {
  return d === 1 ? '1 dia' : `${d} dias`
}

export function TaktTimePanel() {
  const zones         = useLpsStore((s) => s.taktZones)
  const taktTotalDays = useLpsStore((s) => s.taktTotalDays)
  const setTaktTotalDays = useLpsStore((s) => s.setTaktTotalDays)
  const updateTaktZone   = useLpsStore((s) => s.updateTaktZone)

  const taktPerZone = zones.length > 0 ? Math.round(taktTotalDays / zones.length) : 0

  // Timeline width: sum of all takt days
  const timelineTotal = zones.reduce((s, z) => s + z.taktDays, 0) || 1

  // Stats
  const onTime    = zones.filter((z) => z.actualDays !== undefined && z.actualDays <= z.taktDays).length
  const overTime  = zones.filter((z) => z.actualDays !== undefined && z.actualDays > z.taktDays).length
  const pending   = zones.filter((z) => z.actualDays === undefined).length

  const avgActual = useMemo(() => {
    const done = zones.filter((z) => z.actualDays !== undefined)
    if (done.length === 0) return null
    return Math.round(done.reduce((s, z) => s + z.actualDays!, 0) / done.length)
  }, [zones])

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Config + Stats */}
      <div className="flex items-start gap-6 flex-wrap">
        {/* Total days input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#a3a3a3] font-semibold">Prazo Total da Obra (dias úteis)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={taktTotalDays}
              onChange={(e) => setTaktTotalDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 bg-[#3d3d3d] border border-[#525252] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500 text-center font-mono"
            />
            <span className="text-[#6b6b6b] text-sm">dias</span>
          </div>
          <p className="text-[10px] text-gray-600">
            Takt por zona: <span className="text-orange-400 font-semibold">{fmtDays(taktPerZone)}</span> ({zones.length} zonas)
          </p>
        </div>

        <div className="w-px h-12 bg-[#484848] self-center shrink-0" />

        {/* KPIs */}
        <div className="flex items-center gap-6 flex-wrap">
          <TaktKpi icon={<CheckCircle size={16} className="text-green-400" />} label="No Takt" value={String(onTime)} color="text-green-400" />
          <TaktKpi icon={<AlertTriangle size={16} className="text-red-400" />} label="Acima Takt" value={String(overTime)} color="text-red-400" />
          <TaktKpi icon={<Clock size={16} className="text-[#a3a3a3]" />} label="Pendentes" value={String(pending)} color="text-[#a3a3a3]" />
          {avgActual !== null && (
            <TaktKpi
              icon={<Clock size={16} className="text-blue-400" />}
              label="Média Real"
              value={fmtDays(avgActual)}
              color={avgActual <= taktPerZone ? 'text-green-400' : 'text-red-400'}
            />
          )}
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="rounded-xl border border-[#3d3d3d] bg-[#2c2c2c] p-5">
        <p className="text-xs font-semibold text-white mb-4">Fluxo Takt — Zonas em sequência</p>

        {zones.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">Nenhuma zona configurada.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Timeline bar */}
            <div className="flex items-stretch gap-0.5 h-14">
              {zones.map((z) => {
                const widthPct = (z.taktDays / timelineTotal) * 100
                const isOver  = z.actualDays !== undefined && z.actualDays > z.taktDays
                const isOk    = z.actualDays !== undefined && z.actualDays <= z.taktDays

                return (
                  <div
                    key={z.id}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-md text-center overflow-hidden transition-all',
                      isOver ? 'bg-red-900/30 border border-red-500'
                        : isOk ? 'bg-green-900/30 border border-green-500'
                        : 'bg-blue-900/40 border border-blue-500',
                    )}
                    style={{
                      width: `${widthPct}%`,
                      minWidth: 48,
                    }}
                    title={`${z.code} — Takt: ${z.taktDays}d${z.actualDays !== undefined ? ` | Real: ${z.actualDays}d` : ''}`}
                  >
                    <span className="text-xs font-bold text-white leading-tight">{z.code}</span>
                    <span className={cn('text-[10px] font-mono', isOver ? 'text-red-500' : isOk ? 'text-green-500' : 'text-blue-500')}>{fmtDays(z.taktDays)}</span>
                    {z.actualDays !== undefined && (
                      <span className={`text-[9px] ${isOver ? 'text-red-300' : 'text-green-300'}`}>
                        Real: {z.actualDays}d
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Scale */}
            <div className="relative h-3">
              <div className="absolute inset-x-0 top-1/2 h-px bg-[#484848]" />
              {[0, 25, 50, 75, 100].map((pct) => (
                <div
                  key={pct}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${pct}%` }}
                >
                  <div className="w-px h-2 bg-[#525252]" />
                  <span className="text-[9px] text-gray-600 mt-0.5">
                    {Math.round((pct / 100) * timelineTotal)}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zone table */}
      <div className="rounded-xl border border-[#3d3d3d] overflow-x-auto overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#3d3d3d]/80 border-b border-[#525252]">
            <tr>
              <th className="text-left text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Zona</th>
              <th className="text-right text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Extensão (m)</th>
              <th className="text-right text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Takt (dias)</th>
              <th className="text-right text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Real (dias)</th>
              <th className="text-left text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3d3d3d]">
            {zones.map((z) => {
              const isOk  = z.actualDays !== undefined && z.actualDays <= z.taktDays

              return (
                <tr key={z.id} className="bg-[#2c2c2c] hover:bg-[#3d3d3d]/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-white">{z.code}</span>
                    <span className="text-[#6b6b6b] text-xs ml-2">{z.lengthM} m</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#f5f5f5] font-mono">{z.lengthM}</td>
                  <td className="px-4 py-2.5 text-right text-orange-400 font-mono font-semibold">{z.taktDays}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    <input
                      type="number"
                      min={1}
                      placeholder="—"
                      value={z.actualDays ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : parseInt(e.target.value)
                        updateTaktZone(z.id, { actualDays: val })
                      }}
                      className="w-16 bg-[#3d3d3d] border border-[#525252] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-orange-500 text-right"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {z.actualDays === undefined ? (
                      <span className="text-gray-600 text-xs">Pendente</span>
                    ) : isOk ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle size={12} /> No takt
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 text-xs">
                        <AlertTriangle size={12} /> +{(z.actualDays ?? 0) - z.taktDays}d acima
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TaktKpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] text-[#6b6b6b] uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-xl font-bold ${color}`}>{value}</span>
    </div>
  )
}
