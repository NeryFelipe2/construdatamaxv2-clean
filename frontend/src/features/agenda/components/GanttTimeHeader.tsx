import { useMemo } from 'react'
import { addDays, parseISO } from 'date-fns'
import { useAgendaStore } from '@/store/agendaStore'
import {
  SIDEBAR_W,
  getViewParams,
  getColumnLabel,
  getTopHeaderLabel,
} from '../utils'
import type { AgendaViewMode } from '@/types'
import type { ViewParams } from '../utils'

// Build top-row segments (groups of columns with same top label)
function buildTopSegments(
  viewStart: string,
  viewParams: ViewParams,
  mode: AgendaViewMode
): { label: string; cols: number }[] {
  const { totalDays, columnDays } = viewParams
  const numCols = Math.ceil(totalDays / columnDays)
  const start   = parseISO(viewStart)
  const segments: { label: string; cols: number }[] = []

  for (let i = 0; i < numCols; i++) {
    const colDate = addDays(start, i * columnDays)
    const label   = getTopHeaderLabel(colDate, mode)
    const last    = segments[segments.length - 1]
    if (last && last.label === label) {
      last.cols += 1
    } else {
      segments.push({ label, cols: 1 })
    }
  }
  return segments
}

export function GanttTimeHeader() {
  const { viewStart, viewMode } = useAgendaStore()
  const viewParams = useMemo(() => getViewParams(viewMode), [viewMode])
  const { totalDays, columnDays, pixelsPerDay } = viewParams

  const numCols    = Math.ceil(totalDays / columnDays)
  const totalWidth = SIDEBAR_W + totalDays * pixelsPerDay
  const colWidth   = columnDays * pixelsPerDay

  const topSegments = useMemo(
    () => buildTopSegments(viewStart, viewParams, viewMode),
    [viewStart, viewParams, viewMode]
  )

  const start = parseISO(viewStart)

  return (
    <div
      style={{ position: 'sticky', top: 0, zIndex: 20 }}
      className="border-b border-[#20406a] bg-[#112645]"
    >
      {/* Top row — month/year grouping */}
      <div className="flex" style={{ minWidth: totalWidth }}>
        {/* Corner */}
        <div
          style={{
            position: 'sticky', left: 0, zIndex: 21,
            width: SIDEBAR_W, minWidth: SIDEBAR_W,
            background: '#112645',
          }}
          className="border-r border-b border-[#20406a] px-3 flex items-center"
        >
          <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">
            Recurso
          </span>
        </div>

        {topSegments.map((seg, i) => (
          <div
            key={`${seg.label}-${i}`}
            style={{ width: seg.cols * colWidth, minWidth: seg.cols * colWidth }}
            className="border-r border-b border-[#20406a] px-3 flex items-center overflow-hidden"
          >
            <span className="text-xs font-semibold text-[#f5f5f5] capitalize truncate">
              {seg.label}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom row — individual column labels */}
      <div className="flex" style={{ minWidth: totalWidth }}>
        {/* Corner */}
        <div
          style={{
            position: 'sticky', left: 0, zIndex: 21,
            width: SIDEBAR_W, minWidth: SIDEBAR_W,
            background: '#112645',
          }}
          className="border-r border-[#20406a]"
        />

        {Array.from({ length: numCols }).map((_, i) => {
          const colDate = addDays(start, i * columnDays)
          const label   = getColumnLabel(colDate, viewMode)
          return (
            <div
              key={i}
              style={{ width: colWidth, minWidth: colWidth }}
              className="border-r border-[#20406a] flex items-center justify-center overflow-hidden"
            >
              <span className="text-[10px] font-mono text-[#6b6b6b] truncate px-0.5">
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
