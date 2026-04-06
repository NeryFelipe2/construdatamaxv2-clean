import { useMemo } from 'react'
import { useAgendaStore, getTasksForResource } from '@/store/agendaStore'
import { SIDEBAR_W, HEADER_H, ROW_HEIGHT, getTodayOffset, getViewParams } from '../utils'
import { GanttTimeHeader } from './GanttTimeHeader'
import { GanttRow } from './GanttRow'

interface GanttChartProps {
  filteredResourceIds: string[]
}

export function GanttChart({ filteredResourceIds }: GanttChartProps) {
  const { tasks, resources, viewStart, visibleWeeks, viewMode } = useAgendaStore()

  const viewParams = useMemo(() => getViewParams(viewMode), [viewMode])

  const visibleResources = useMemo(
    () => resources.filter((r) => filteredResourceIds.includes(r.id)),
    [resources, filteredResourceIds]
  )

  const todayOffset = useMemo(
    () => getTodayOffset(viewStart, visibleWeeks, viewParams.pixelsPerDay),
    [viewStart, visibleWeeks, viewParams.pixelsPerDay]
  )

  // Grid background column width based on viewMode
  const colWidth = viewParams.columnDays * viewParams.pixelsPerDay

  const gridStyle: React.CSSProperties = useMemo(
    () => ({
      backgroundImage: `repeating-linear-gradient(
        to right,
        transparent 0px,
        transparent ${colWidth - 1}px,
        #525252 ${colWidth - 1}px,
        #525252 ${colWidth}px
      )`,
    }),
    [colWidth]
  )

  const timelineWidth  = viewParams.totalDays * viewParams.pixelsPerDay
  const totalWidth     = SIDEBAR_W + timelineWidth
  const totalHeight    = visibleResources.length * ROW_HEIGHT

  return (
    <div className="h-full overflow-auto" style={{ position: 'relative' }}>
      <div style={{ minWidth: totalWidth, position: 'relative' }}>
        {/* Sticky time header */}
        <GanttTimeHeader />

        {/* Resource rows */}
        <div style={{ position: 'relative' }}>
          {visibleResources.map((resource, index) => {
            const rowTasks = getTasksForResource(tasks, resource.id)
            return (
              <GanttRow
                key={resource.id}
                resource={resource}
                tasks={rowTasks}
                viewStart={viewStart}
                visibleWeeks={visibleWeeks}
                index={index}
                gridStyle={gridStyle}
                viewParams={viewParams}
              />
            )
          })}

          {visibleResources.length === 0 && (
            <div
              className="flex items-center justify-center text-sm text-[#6b6b6b]"
              style={{ height: 200 }}
            >
              Nenhum recurso encontrado
            </div>
          )}

          {/* Today indicator */}
          {todayOffset !== null && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: SIDEBAR_W + todayOffset,
                width: 2,
                height: totalHeight,
                background: '#f97316',
                opacity: 0.7,
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -HEADER_H,
                  left: -18,
                  background: '#f97316',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 4px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                Hoje
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
