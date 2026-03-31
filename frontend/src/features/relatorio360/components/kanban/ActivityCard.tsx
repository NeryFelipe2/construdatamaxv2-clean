import { GripVertical, TrendingUp, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Activity } from '@/types'
import { useCurrentReport } from '@/hooks/useRelatorio360'

interface ActivityCardProps {
  activity: Activity
  isDragging?: boolean
  isOverlay?: boolean
  onGripPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onEdit?: () => void
}

export function ActivityCard({
  activity,
  isDragging,
  isOverlay,
  onGripPointerDown,
  onEdit,
}: ActivityCardProps) {
  const report = useCurrentReport()
  const crew = report?.crews.find((c) => c.id === activity.crewId)

  const pct =
    activity.plannedQty > 0
      ? Math.min(100, Math.round((activity.actualQty / activity.plannedQty) * 100))
      : 0

  return (
    <div
      className={cn(
        'rounded-xl border bg-[#112645] p-3 flex flex-col gap-2.5 select-none',
        isOverlay
          ? 'border-[#2abfdc] shadow-lg shadow-[#2abfdc]/10 rotate-1 scale-105 cursor-grabbing'
          : isDragging
          ? 'border-[#2abfdc]/40 opacity-40 cursor-grabbing'
          : 'border-[#20406a] hover:border-[#1f3c5e] hover:bg-[#14294e] transition-colors cursor-default'
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[#f5f5f5] text-sm font-semibold leading-snug flex-1 min-w-0">
          {activity.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && !isOverlay && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="text-[#3f3f3f] hover:text-[#2abfdc] transition-colors mt-0.5"
              title="Editar atividade"
            >
              <Pencil size={11} />
            </button>
          )}
          <div
            onPointerDown={onGripPointerDown}
            className="mt-0.5 text-[#3f3f3f] hover:text-[#6b6b6b] cursor-grab active:cursor-grabbing transition-colors touch-none"
          >
            <GripVertical size={14} />
          </div>
        </div>
      </div>

      {/* Qty row */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-[#6b6b6b] text-[10px] uppercase tracking-wider">Planejado</span>
          <span className="font-mono text-[#f5f5f5] font-semibold">
            {activity.plannedQty.toLocaleString('pt-BR')} {activity.unit}
          </span>
        </div>
        <div className="h-6 w-px bg-[#20406a]" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[#6b6b6b] text-[10px] uppercase tracking-wider">Realizado</span>
          <span className="font-mono text-[#2abfdc] font-semibold">
            {activity.actualQty.toLocaleString('pt-BR')} {activity.unit}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {activity.status !== 'planned' && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 bg-[#20406a] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                pct >= 100 ? 'bg-[#22c55e]' : 'bg-[#2abfdc]'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-[#6b6b6b] flex items-center gap-1">
            <TrendingUp size={9} />
            {pct}% concluído
          </span>
        </div>
      )}

      {/* Crew badge */}
      {crew && (
        <div className="flex items-center gap-1.5 text-[10px] text-[#6b6b6b]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#2abfdc]" />
          <span>{crew.foremanName} · {crew.crewType}</span>
        </div>
      )}
    </div>
  )
}
