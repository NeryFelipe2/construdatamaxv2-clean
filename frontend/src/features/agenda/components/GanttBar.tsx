import { useRef, useState, useEffect, useCallback } from 'react'
import type { AgendaTask, TaskColor } from '@/types'
import { useAgendaStore } from '@/store/agendaStore'
import {
  COLUMN_WIDTH,
  getBarStyle,
  applyDragDelta,
  applyResizeLeft,
  applyResizeRight,
  weekPx,
} from '../utils'

// ─── Color map ─────────────────────────────────────────────────────────────────

const COLOR_BG: Record<TaskColor, string> = {
  blue:   'rgba(59, 130, 246, 0.85)',
  orange: 'rgba(249, 115, 22, 0.85)',
  green:  'rgba(34, 197, 94, 0.85)',
  red:    'rgba(239, 68, 68, 0.85)',
  purple: 'rgba(168, 85, 247, 0.85)',
}

const COLOR_BORDER: Record<TaskColor, string> = {
  blue:   '#3b82f6',
  orange: '#2abfdc',
  green:  '#22c55e',
  red:    '#ef4444',
  purple: '#a855f7',
}

interface GanttBarProps {
  task: AgendaTask
  viewStart: string
  visibleWeeks: number
  pixelsPerDay?: number   // defaults to COLUMN_WIDTH / 7 (week mode)
}

export function GanttBar({ task, viewStart, visibleWeeks, pixelsPerDay = COLUMN_WIDTH / 7 }: GanttBarProps) {
  const { moveTask, updateTask, setEditingTask, selectedTaskId, selectTask } = useAgendaStore()

  const [previewOffsetWeeks, setPreviewOffsetWeeks] = useState(0)
  const [resizeStartDelta, setResizeStartDelta]     = useState(0)
  const [resizeEndDelta, setResizeEndDelta]         = useState(0)
  const [isDragging, setIsDragging]                 = useState(false)
  const [isResizing, setIsResizing]                 = useState(false)

  const hasMoved    = useRef(false)
  const cleanupRef  = useRef<(() => void) | null>(null)
  const onePxWeek   = weekPx(pixelsPerDay)   // px per 7-day snap

  useEffect(() => {
    return () => { if (cleanupRef.current) cleanupRef.current() }
  }, [])

  // Compute bar style
  let barStyle = getBarStyle(task, viewStart, visibleWeeks, previewOffsetWeeks, pixelsPerDay)

  if (isResizing && resizeStartDelta !== 0) {
    barStyle = getBarStyle(
      { ...task, startDate: applyResizeLeft(task, Math.round(resizeStartDelta / onePxWeek)) },
      viewStart, visibleWeeks, 0, pixelsPerDay
    )
  } else if (isResizing && resizeEndDelta !== 0) {
    barStyle = getBarStyle(
      { ...task, endDate: applyResizeRight(task, Math.round(resizeEndDelta / onePxWeek)) },
      viewStart, visibleWeeks, 0, pixelsPerDay
    )
  }

  if (!barStyle.visible) return null

  const isSelected = selectedTaskId === task.id

  // ── Drag (move) handler ────────────────────────────────────────────────────
  const handleBarPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).dataset.resize) return
      e.preventDefault()
      e.stopPropagation()

      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setIsDragging(true)
      hasMoved.current = false

      const startX = e.clientX

      function onMove(ev: PointerEvent) {
        const deltaX = ev.clientX - startX
        if (Math.abs(deltaX) > 4) hasMoved.current = true
        setPreviewOffsetWeeks(Math.round(deltaX / onePxWeek))
      }

      function onUp(ev: PointerEvent) {
        el.removeEventListener('pointermove', onMove)
        cleanupRef.current = null
        setIsDragging(false)

        const deltaWeeks = Math.round((ev.clientX - startX) / onePxWeek)
        setPreviewOffsetWeeks(0)

        if (hasMoved.current && deltaWeeks !== 0) {
          const { newStart, newEnd } = applyDragDelta(task, deltaWeeks)
          moveTask(task.id, newStart, newEnd)
        } else if (!hasMoved.current) {
          selectTask(task.id)
          setEditingTask(task.id)
        }
      }

      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp, { once: true })
      cleanupRef.current = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
    },
    [task, moveTask, setEditingTask, selectTask, onePxWeek]
  )

  // ── Left resize handler ────────────────────────────────────────────────────
  const handleLeftResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setIsResizing(true)
      hasMoved.current = false

      const startX = e.clientX

      function onMove(ev: PointerEvent) {
        const deltaX = ev.clientX - startX
        if (Math.abs(deltaX) > 2) hasMoved.current = true
        setResizeStartDelta(deltaX)
      }

      function onUp(ev: PointerEvent) {
        el.removeEventListener('pointermove', onMove)
        cleanupRef.current = null
        setIsResizing(false)
        const deltaWeeks = Math.round((ev.clientX - startX) / onePxWeek)
        setResizeStartDelta(0)
        if (hasMoved.current && deltaWeeks !== 0) {
          updateTask(task.id, { startDate: applyResizeLeft(task, deltaWeeks) })
        }
      }

      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp, { once: true })
      cleanupRef.current = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
    },
    [task, updateTask, onePxWeek]
  )

  // ── Right resize handler ───────────────────────────────────────────────────
  const handleRightResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setIsResizing(true)
      hasMoved.current = false

      const startX = e.clientX

      function onMove(ev: PointerEvent) {
        const deltaX = ev.clientX - startX
        if (Math.abs(deltaX) > 2) hasMoved.current = true
        setResizeEndDelta(deltaX)
      }

      function onUp(ev: PointerEvent) {
        el.removeEventListener('pointermove', onMove)
        cleanupRef.current = null
        setIsResizing(false)
        const deltaWeeks = Math.round((ev.clientX - startX) / onePxWeek)
        setResizeEndDelta(0)
        if (hasMoved.current && deltaWeeks !== 0) {
          updateTask(task.id, { endDate: applyResizeRight(task, deltaWeeks) })
        }
      }

      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp, { once: true })
      cleanupRef.current = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
    },
    [task, updateTask, onePxWeek]
  )

  const bg     = COLOR_BG[task.color]
  const border = COLOR_BORDER[task.color]

  return (
    <div
      onPointerDown={handleBarPointerDown}
      style={{
        position: 'absolute',
        top: 10,
        left: barStyle.left,
        width: barStyle.width,
        height: 48,
        background: bg,
        borderRadius: 6,
        border: `1.5px solid ${isSelected ? '#fff' : border}`,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        transition: isDragging || isResizing ? 'none' : 'left 0.12s ease, width 0.12s ease',
        opacity: task.status === 'completed' ? 0.65 : 1,
        zIndex: isSelected ? 10 : 2,
        boxShadow: isSelected ? `0 0 0 2px ${border}` : undefined,
      }}
      title={task.title}
    >
      {/* Left resize handle */}
      <div
        data-resize="left"
        onPointerDown={handleLeftResizePointerDown}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 8,
          cursor: 'col-resize', zIndex: 3, borderRadius: '6px 0 0 6px',
        }}
        className="hover:bg-white/20 transition-colors"
      />

      {/* Label */}
      <div
        className="flex items-center h-full overflow-hidden pointer-events-none"
        style={{ paddingLeft: 12, paddingRight: 12 }}
      >
        <span className="text-white text-[11px] font-semibold truncate leading-none">
          {task.title}
        </span>
      </div>

      {/* Right resize handle */}
      <div
        data-resize="right"
        onPointerDown={handleRightResizePointerDown}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
          cursor: 'col-resize', zIndex: 3, borderRadius: '0 6px 6px 0',
        }}
        className="hover:bg-white/20 transition-colors"
      />
    </div>
  )
}
