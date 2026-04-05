/**
 * OperacaoCampoHeader — KPI strip for the Operação e Campo module.
 */
import { HardHat } from 'lucide-react'
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'

export function OperacaoCampoHeader() {
  const weeklyPpc    = useOperacaoCampoStore((s) => s.weeklyPpcResults)
  const calendarDays = useOperacaoCampoStore((s) => s.calendarDays)
  const trendPoints  = useOperacaoCampoStore((s) => s.trendPoints)

  const today = new Date().toISOString().slice(0, 10)

  const lastPpc = weeklyPpc.length > 0 ? weeklyPpc[weeklyPpc.length - 1].ppc : 0
  const activitiesToday = calendarDays.filter((d) => d.date === today).length
  const lastTrend = trendPoints.length > 0 ? trendPoints[trendPoints.length - 1] : null
  const deviation = lastTrend
    ? (lastTrend.actualCumulativePct - lastTrend.plannedCumulativePct).toFixed(1)
    : '0.0'

  // Days remaining (count future days with planned data)
  const futureDates = [...new Set(calendarDays.filter((d) => d.date > today).map((d) => d.date))]
  const daysRemaining = futureDates.length

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] px-6 py-4 flex items-center justify-between gap-4 flex-wrap shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
          <HardHat size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-[#f5f5f5] font-semibold text-lg leading-tight">Operação e Campo</h1>
          <p className="text-[#6b6b6b] text-xs">Cockpit de produção diária</p>
        </div>
      </div>

      <div className="flex gap-5">
        {[
          { label: 'PPC Semanal', value: `${lastPpc}%`, color: lastPpc >= 80 ? '#22c55e' : lastPpc >= 60 ? '#eab308' : '#ef4444' },
          { label: 'Dias Restantes', value: String(daysRemaining), color: '#f97316' },
          { label: 'Desvio Acumulado', value: `${Number(deviation) >= 0 ? '+' : ''}${deviation}%`, color: Number(deviation) >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Atividades Hoje', value: String(activitiesToday), color: '#a3a3a3' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">{label}</p>
            <p className="text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
