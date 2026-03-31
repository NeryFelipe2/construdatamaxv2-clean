import type { AgendaResource, AgendaTask } from '@/types'
import { cn } from '@/lib/utils'
import { ROW_HEIGHT, SIDEBAR_W } from '../utils'
import type { ViewParams } from '../utils'
import { GanttBar } from './GanttBar'

interface GanttRowProps {
  resource: AgendaResource
  tasks: AgendaTask[]
  viewStart: string
  visibleWeeks: number
  index: number
  gridStyle: React.CSSProperties
  viewParams: ViewParams
}

export function GanttRow({
  resource,
  tasks,
  viewStart,
  visibleWeeks,
  index,
  gridStyle,
  viewParams,
}: GanttRowProps) {
  const rowBg         = index % 2 === 0 ? '#0d2040' : 'rgba(255,255,255,0.018)'
  const timelineWidth = viewParams.totalDays * viewParams.pixelsPerDay

  return (
    <div
      className="flex border-b border-[#20406a]"
      style={{ background: rowBg, minWidth: SIDEBAR_W + timelineWidth }}
    >
      {/* Sticky resource name cell */}
      <div
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 10,
          width: SIDEBAR_W,
          minWidth: SIDEBAR_W,
          height: ROW_HEIGHT,
          background: rowBg,
        }}
        className="border-r border-[#20406a] flex flex-col justify-center px-4 gap-1"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#6b6b6b]">{resource.code}</span>
          <div
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider',
              resource.status === 'active'
                ? 'bg-[#22c55e]/15 text-[#22c55e]'
                : 'bg-[#3f3f3f] text-[#6b6b6b]'
            )}
          >
            {resource.status === 'active' ? 'Ativo' : 'Inativo'}
          </div>
        </div>
        <span className="text-xs font-semibold text-[#f5f5f5] truncate">
          {resource.name}
        </span>
      </div>

      {/* Timeline cell */}
      <div
        style={{
          position: 'relative',
          width: timelineWidth,
          minWidth: timelineWidth,
          height: ROW_HEIGHT,
          ...gridStyle,
        }}
      >
        {tasks.map((task) => (
          <GanttBar
            key={task.id}
            task={task}
            viewStart={viewStart}
            visibleWeeks={visibleWeeks}
            pixelsPerDay={viewParams.pixelsPerDay}
          />
        ))}
      </div>
    </div>
  )
}
