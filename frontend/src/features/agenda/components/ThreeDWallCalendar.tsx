"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useAgendaStore } from "@/store/agendaStore"
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isToday,
  getDay,
  addMonths,
  subMonths,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { getTasksForDate, getTaskColor } from "../calendarUtils"
import { cn } from "@/lib/utils"
import type { AgendaTask, AgendaResource } from "@/types"

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const MOBILE_BREAKPOINT = 768
const DEFAULT_TILT = 18
const DEFAULT_ROTATION = 0
const MIN_TILT = 0
const MAX_TILT = 45

// ─── Priority labels ────────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
}

// ─── Helper: find resource name ──────────────────────────────────────────────

function getResourceName(
  resources: AgendaResource[],
  resourceId: string
): string {
  const r = resources.find((res) => res.id === resourceId)
  return r?.name ?? "—"
}

// ─── Task Dot (with HoverCard + Popover) ─────────────────────────────────────

interface TaskDotProps {
  task: AgendaTask
  resources: AgendaResource[]
  onEdit: (id: string) => void
}

function TaskDot({ task, resources, onEdit }: TaskDotProps) {
  const hexColor = getTaskColor(task.color)
  const resourceName = getResourceName(resources, task.resourceId)

  return (
    <Popover>
      <HoverCard openDelay={200} closeDelay={100}>
        <PopoverTrigger asChild>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/10 transition-transform hover:scale-150 focus:outline-none focus:ring-2 focus:ring-[#f97316]"
              style={{ backgroundColor: hexColor }}
              aria-label={task.title}
              onClick={(e) => e.stopPropagation()}
            />
          </HoverCardTrigger>
        </PopoverTrigger>

        {/* ── Hover preview ── */}
        <HoverCardContent
          side="top"
          className="w-56 p-3 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-semibold text-[#f5f5f5] truncate">{task.title}</p>
          <p className="text-[#a3a3a3] mt-0.5">Recurso: {resourceName}</p>
        </HoverCardContent>

        {/* ── Click popover with full details ── */}
        <PopoverContent
          side="top"
          align="start"
          className="w-72 p-4 text-xs space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-bold text-sm text-[#f5f5f5]">{task.title}</p>
          <div className="space-y-1 text-[#a3a3a3]">
            <p>
              <span className="text-[#d4d4d4]">Recurso:</span> {resourceName}
            </p>
            <p>
              {format(new Date(task.startDate), "dd/MM/yyyy")} &rarr;{" "}
              {format(new Date(task.endDate), "dd/MM/yyyy")}
            </p>
            <p>
              <span className="text-[#d4d4d4]">Prioridade:</span>{" "}
              {PRIORITY_LABEL[task.priority] ?? task.priority}
            </p>
            <p>
              <span className="text-[#d4d4d4]">Progresso:</span>{" "}
              {task.completionPct ?? 0}%
            </p>
          </div>
          <button
            type="button"
            onClick={() => onEdit(task.id)}
            className="mt-2 w-full px-3 py-1.5 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30 text-[#f97316] text-xs font-semibold hover:bg-[#f97316]/25 transition-colors"
          >
            Editar
          </button>
        </PopoverContent>
      </HoverCard>
    </Popover>
  )
}

// ─── Desktop 3D Day Cell ─────────────────────────────────────────────────────

interface DayCellProps {
  day: Date
  tasks: AgendaTask[]
  resources: AgendaResource[]
  onEdit: (id: string) => void
  onNewTask: () => void
}

function DayCell({ day, tasks, resources, onEdit, onNewTask }: DayCellProps) {
  const today = isToday(day)
  const dayTasks = useMemo(
    () => getTasksForDate(tasks, day),
    [tasks, day]
  )

  return (
    <Card
      className={cn(
        "relative flex flex-col justify-between overflow-hidden cursor-pointer select-none transition-colors",
        "bg-[#3d3d3d] border-[#525252] hover:bg-[#484848]",
        today && "border-[#f97316] ring-1 ring-[#f97316]/30"
      )}
      style={{ width: "100%", height: "100%" }}
      onClick={onNewTask}
    >
      <CardContent className="p-2 flex flex-col h-full">
        {/* Header row */}
        <div className="flex items-center justify-between mb-1">
          <span
            className={cn(
              "text-[11px] font-medium uppercase tracking-wide",
              today ? "text-[#f97316]" : "text-[#a3a3a3]"
            )}
          >
            {format(day, "EEE", { locale: ptBR })}
          </span>
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              today ? "text-[#f97316]" : "text-[#f5f5f5]"
            )}
          >
            {format(day, "d")}
          </span>
        </div>

        {/* Today badge */}
        {today && (
          <span className="text-[9px] font-bold text-[#f97316] uppercase tracking-widest mb-1">
            Hoje
          </span>
        )}

        {/* Task dots */}
        <div className="flex flex-wrap gap-1 mt-auto">
          {dayTasks.slice(0, 8).map((t) => (
            <TaskDot
              key={t.id}
              task={t}
              resources={resources}
              onEdit={onEdit}
            />
          ))}
          {dayTasks.length > 8 && (
            <span className="text-[9px] text-[#a3a3a3]">
              +{dayTasks.length - 8}
            </span>
          )}
        </div>

        {/* Event count */}
        {dayTasks.length > 0 && (
          <span className="text-[9px] text-[#a3a3a3] mt-1">
            {dayTasks.length} evento{dayTasks.length > 1 ? "s" : ""}
          </span>
        )}

        {/* Add button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNewTask()
          }}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center transition-opacity"
          aria-label="Novo evento"
        >
          <Plus size={10} className="text-[#f97316]" />
        </button>
      </CardContent>
    </Card>
  )
}

// ─── Mobile Day Row ──────────────────────────────────────────────────────────

interface MobileDayRowProps {
  day: Date
  tasks: AgendaTask[]
  resources: AgendaResource[]
  onEdit: (id: string) => void
  onNewTask: () => void
}

function MobileDayRow({
  day,
  tasks,
  resources,
  onEdit,
  onNewTask,
}: MobileDayRowProps) {
  const today = isToday(day)
  const dayTasks = useMemo(
    () => getTasksForDate(tasks, day),
    [tasks, day]
  )

  return (
    <div
      className={cn(
        "border-b border-[#525252] px-4 py-3",
        today && "bg-[#f97316]/5"
      )}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              today ? "text-[#f97316]" : "text-[#f5f5f5]"
            )}
          >
            {format(day, "d")}
          </span>
          <span
            className={cn(
              "text-xs uppercase tracking-wide",
              today ? "text-[#f97316]" : "text-[#a3a3a3]"
            )}
          >
            {format(day, "EEEE", { locale: ptBR })}
          </span>
          {today && (
            <span className="text-[10px] font-bold text-[#f97316] bg-[#f97316]/15 px-1.5 py-0.5 rounded">
              Hoje
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onNewTask}
          className="w-6 h-6 rounded-full bg-[#f97316]/20 flex items-center justify-center"
          aria-label="Novo evento"
        >
          <Plus size={12} className="text-[#f97316]" />
        </button>
      </div>

      {/* Task list */}
      {dayTasks.length === 0 ? (
        <p className="text-[11px] text-[#525252] italic">Sem eventos</p>
      ) : (
        <div className="space-y-1.5">
          {dayTasks.map((t) => {
            const hexColor = getTaskColor(t.color)
            const resourceName = getResourceName(resources, t.resourceId)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onEdit(t.id)}
                className="w-full flex items-center gap-2 p-2 rounded-lg bg-[#3d3d3d] border border-[#525252] hover:bg-[#484848] text-left transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: hexColor }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#f5f5f5] truncate">
                    {t.title}
                  </p>
                  <p className="text-[10px] text-[#a3a3a3] truncate">
                    {resourceName}
                  </p>
                </div>
                <span className="text-[10px] text-[#a3a3a3] tabular-nums shrink-0">
                  {t.completionPct ?? 0}%
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ThreeDWallCalendar() {
  // ── Store ──
  const { tasks, resources, setEditingTask } = useAgendaStore(
    useShallow((s) => ({
      tasks: s.tasks,
      resources: s.resources,
      setEditingTask: s.setEditingTask,
    }))
  )

  // ── State ──
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [tilt, setTilt] = useState(DEFAULT_TILT)
  const [rotation, setRotation] = useState(DEFAULT_ROTATION)
  const [isMobile, setIsMobile] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startRotation: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // ── Responsive ──
  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ── Month data ──
  const monthLabel = useMemo(
    () => format(currentMonth, "MMMM yyyy", { locale: ptBR }),
    [currentMonth]
  )

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // Leading blank cells (Sunday = 0 ... Saturday = 6)
  const leadingBlanks = useMemo(() => {
    const firstDow = getDay(days[0])
    return firstDow // Sunday-based grid
  }, [days])

  // ── Navigation ──
  const goToPrev = useCallback(
    () => setCurrentMonth((m) => subMonths(m, 1)),
    []
  )
  const goToNext = useCallback(
    () => setCurrentMonth((m) => addMonths(m, 1)),
    []
  )

  // ── Wheel tilt ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setTilt((prev) => {
      const next = prev + (e.deltaY > 0 ? 2 : -2)
      return Math.max(MIN_TILT, Math.min(MAX_TILT, next))
    })
  }, [])

  // ── Pointer drag rotation ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isMobile) return
      setIsDragging(true)
      dragRef.current = { startX: e.clientX, startRotation: rotation }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [rotation, isMobile]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const newRotation = dragRef.current.startRotation + dx * 0.15
      setRotation(Math.max(-30, Math.min(30, newRotation)))
    },
    [isDragging]
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
    dragRef.current = null
  }, [])

  // ── Handlers ──
  const handleEdit = useCallback(
    (id: string) => setEditingTask(id),
    [setEditingTask]
  )
  const handleNewTask = useCallback(
    () => setEditingTask("new"),
    [setEditingTask]
  )

  // ─── Mobile Layout ────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-[#333333]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252] shrink-0">
          <button
            type="button"
            onClick={goToPrev}
            className="flex items-center gap-1 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
            <span>Anterior</span>
          </button>
          <h2 className="text-sm font-bold text-[#f5f5f5] capitalize">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={goToNext}
            className="flex items-center gap-1 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
            aria-label="Próximo mês"
          >
            <span>Próximo</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Scrollable day list */}
        <div className="flex-1 overflow-y-auto">
          {days.map((day) => (
            <MobileDayRow
              key={day.toISOString()}
              day={day}
              tasks={tasks}
              resources={resources}
              onEdit={handleEdit}
              onNewTask={handleNewTask}
            />
          ))}
        </div>
      </div>
    )
  }

  // ─── Desktop 3D Layout ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#333333] select-none">
      {/* ── Month navigation header ── */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-[#525252] shrink-0">
        <button
          type="button"
          onClick={goToPrev}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs font-semibold hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={14} />
          Anterior
        </button>

        <h2 className="text-base font-bold text-[#f5f5f5] capitalize tracking-tight">
          {monthLabel}
        </h2>

        <button
          type="button"
          onClick={goToNext}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs font-semibold hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors"
          aria-label="Próximo mês"
        >
          Próximo
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── 3D perspective container ── */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center p-6"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <div
          className="w-full max-w-[1120px]"
          style={{
            perspective: "1200px",
            perspectiveOrigin: "50% 50%",
          }}
        >
          <div
            ref={gridRef}
            style={{
              transform: `rotateX(${tilt}deg) rotateY(${rotation}deg)`,
              transformStyle: "preserve-3d",
              transition: isDragging ? "none" : "transform 0.3s ease-out",
            }}
          >
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {WEEKDAYS_PT.map((wd) => (
                <div
                  key={wd}
                  className="text-center text-[10px] font-bold uppercase tracking-widest text-[#a3a3a3] py-1"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {/* Leading blanks */}
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div
                  key={`blank-${i}`}
                  className="aspect-[4/3]"
                  style={{ minHeight: "100px" }}
                />
              ))}

              {/* Day cells */}
              {days.map((day, idx) => {
                // Depth effect: rows further from top get more translateZ
                const row = Math.floor((leadingBlanks + idx) / 7)
                const totalRows = Math.ceil((leadingBlanks + days.length) / 7)
                const zDepth = -row * (120 / Math.max(totalRows, 1))

                return (
                  <div
                    key={day.toISOString()}
                    className="group aspect-[4/3]"
                    style={{
                      minHeight: "100px",
                      transform: `translateZ(${zDepth}px)`,
                      transformStyle: "preserve-3d",
                    }}
                  >
                    <DayCell
                      day={day}
                      tasks={tasks}
                      resources={resources}
                      onEdit={handleEdit}
                      onNewTask={handleNewTask}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer hint ── */}
      <div className="flex items-center justify-center gap-4 px-6 py-2 border-t border-[#525252] shrink-0 text-[10px] text-[#525252]">
        <span>Scroll: inclinar</span>
        <span className="w-px h-3 bg-[#525252]" />
        <span>Arrastar: rotacionar</span>
      </div>
    </div>
  )
}
