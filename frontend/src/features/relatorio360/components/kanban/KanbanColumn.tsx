import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import type { Activity, ActivityStatus } from '@/types'
import { ActivityCard } from './ActivityCard'

interface KanbanColumnProps {
  status: ActivityStatus
  activities: Activity[]
  isOver: boolean
  draggingId: string | null
  colRef: Ref<HTMLDivElement>
  onGripPointerDown: (e: React.PointerEvent<HTMLDivElement>, activity: Activity) => void
  onEditActivity: (id: string) => void
}

const COLUMN_CONFIG: Record<ActivityStatus, { label: string; accent: string; dot: string }> = {
  planned:     { label: 'Planejado',    accent: 'text-[#94a3b8]', dot: 'bg-[#64748b]' },
  in_progress: { label: 'Em Andamento', accent: 'text-[#f97316]', dot: 'bg-[#f97316]' },
  completed:   { label: 'Concluído',    accent: 'text-[#22c55e]', dot: 'bg-[#22c55e]' },
}

export function KanbanColumn({
  status,
  activities,
  isOver,
  draggingId,
  colRef,
  onGripPointerDown,
  onEditActivity,
}: KanbanColumnProps) {
  const config = COLUMN_CONFIG[status]

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Column header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', config.dot)} />
          <span className={cn('text-xs font-semibold uppercase tracking-widest', config.accent)}>
            {config.label}
          </span>
        </div>
        <span className="text-xs font-mono text-[#6b6b6b] bg-[#3d3d3d] border border-[#525252] px-2 py-0.5 rounded-full">
          {activities.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={colRef}
        className={cn(
          'flex flex-col gap-2 min-h-24 rounded-xl border border-dashed p-2 transition-colors',
          isOver
            ? 'border-[#f97316]/50 bg-[#f97316]/5'
            : 'border-[#525252] bg-[#2c2c2c]/40'
        )}
      >
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            isDragging={activity.id === draggingId}
            onGripPointerDown={(e) => onGripPointerDown(e, activity)}
            onEdit={() => onEditActivity(activity.id)}
          />
        ))}

        {activities.length === 0 && (
          <div className="flex items-center justify-center h-16 text-[10px] text-[#3f3f3f] uppercase tracking-widest font-semibold">
            Solte aqui
          </div>
        )}
      </div>
    </div>
  )
}
