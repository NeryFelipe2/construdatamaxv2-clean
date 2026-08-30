import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Plus, GanttChart, CalendarDays, Magnet } from 'lucide-react'
import { useAgendaStore } from '@/store/agendaStore'
import { formatViewRange, getViewParams } from '../utils'
import type { AgendaViewMode, AgendaSnapUnit } from '@/types'
import { cn } from '@/lib/utils'
import { format, startOfWeek, parseISO } from 'date-fns'

interface AgendaToolbarProps {
  searchTerm: string
  onSearchChange: (v: string) => void
  onAddTask: () => void
}

const VIEW_MODES: { key: AgendaViewMode; label: string }[] = [
  { key: 'day',      label: 'Dia'       },
  { key: 'week',     label: 'Semana'    },
  { key: 'month',    label: 'Mês'       },
  { key: 'quarter',  label: 'Trimestre' },
  { key: 'semester', label: 'Semestre'  },
  { key: 'year',     label: 'Ano'       },
]

const SNAP_UNITS: { key: AgendaSnapUnit; label: string; title: string }[] = [
  { key: 'week', label: 'Semana', title: 'Arrastar/redimensionar de 7 em 7 dias' },
  { key: 'day',  label: 'Dia',    title: 'Arrastar/redimensionar de 1 em 1 dia (em zooms muito abertos vira semana automaticamente)' },
]

export function AgendaToolbar({ searchTerm, onSearchChange, onAddTask }: AgendaToolbarProps) {
  const {
    viewStart, visibleWeeks, viewMode,
    panLeft, panRight, setViewMode,
    displayView, setDisplayView,
    setVisibleWeeks, setViewStart,
    snapUnit, setSnapUnit,
  } = useAgendaStore()
  const range = formatViewRange(viewStart, visibleWeeks, getViewParams(viewMode).totalDays)

  function handleDateJump(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!val) return
    // val is yyyy-MM-dd; snap to start of that week (Monday)
    const monday = format(startOfWeek(parseISO(val), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    setViewStart(monday)
  }

  return (
    <div className="flex flex-col border-b border-[#525252] bg-[#333333] shrink-0">
      {/* Top row */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-2">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#525252] bg-[#2c2c2c] w-40">
          <Search size={13} className="text-[#6b6b6b] shrink-0" />
          <input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar recurso..."
            className="bg-transparent text-[#f5f5f5] text-xs outline-none w-full placeholder:text-[#6b6b6b]"
            maxLength={100}
          />
        </div>

        {/* Filter */}
        <button
          disabled
          title="Filtros indisponíveis nesta versão"
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#525252] text-[#3f3f3f] cursor-not-allowed"
        >
          <SlidersHorizontal size={14} />
        </button>

        {/* Display view toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDisplayView('gantt')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              displayView === 'gantt'
                ? 'bg-[#f97316]/20 border-[#f97316]/50 text-[#f97316]'
                : 'border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3] hover:border-[#2a3a5e]'
            )}
          >
            <GanttChart size={13} /> Gantt
          </button>
          <button
            onClick={() => setDisplayView('calendar')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              displayView === 'calendar'
                ? 'bg-[#f97316]/20 border-[#f97316]/50 text-[#f97316]'
                : 'border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3] hover:border-[#2a3a5e]'
            )}
          >
            <CalendarDays size={13} /> Calendário
          </button>
        </div>

        <div className="h-5 w-px bg-[#525252]" />

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={panLeft}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#525252] text-[#a3a3a3] hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors"
            title="Recuar"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-[#a3a3a3] font-mono px-2 min-w-[180px] text-center">
            {range}
          </span>
          <button
            onClick={panRight}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#525252] text-[#a3a3a3] hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors"
            title="Avançar"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Jump to date */}
        <div className="flex items-center gap-1.5" title="Ir para data">
          <span className="text-[10px] text-[#6b6b6b] hidden sm:block">Data:</span>
          <input
            type="date"
            defaultValue={viewStart}
            onChange={handleDateJump}
            className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2 py-1 text-xs text-[#a3a3a3] outline-none focus:border-[#f97316]/60 w-32"
          />
        </div>

        {/* Weeks count */}
        <div className="flex items-center gap-1.5" title="Semanas visíveis">
          <input
            type="number"
            min={1}
            max={52}
            value={visibleWeeks}
            onChange={(e) => setVisibleWeeks(parseInt(e.target.value) || 1)}
            className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2 py-1 text-xs text-[#a3a3a3] text-center outline-none focus:border-[#f97316]/60 w-14"
          />
          <span className="text-[10px] text-[#6b6b6b]">sem.</span>
        </div>

        <div className="flex-1" />

        {/* Add task */}
        <button
          onClick={onAddTask}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30 text-[#f97316] text-xs font-semibold hover:bg-[#f97316]/25 transition-colors"
        >
          <Plus size={13} />
          Nova Tarefa
        </button>
      </div>

      {/* ViewMode buttons row — only for Gantt view */}
      {displayView === 'gantt' && (
        <div className="flex items-center gap-1 px-5 pb-2">
          <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mr-2">
            Visualização:
          </span>
          {VIEW_MODES.map((vm) => (
            <button
              key={vm.key}
              onClick={() => setViewMode(vm.key)}
              className={cn(
                'px-3 py-1 rounded-md border text-xs font-medium transition-colors',
                viewMode === vm.key
                  ? 'bg-[#f97316]/20 border-[#f97316]/50 text-[#f97316]'
                  : 'border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3] hover:border-[#2a3a5e]'
              )}
            >
              {vm.label}
            </button>
          ))}

          <div className="h-4 w-px bg-[#525252] mx-2" />

          {/* Snap do drag/resize */}
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mr-1">
            <Magnet size={11} /> Snap:
          </span>
          {SNAP_UNITS.map((su) => (
            <button
              key={su.key}
              onClick={() => setSnapUnit(su.key)}
              title={su.title}
              className={cn(
                'px-3 py-1 rounded-md border text-xs font-medium transition-colors',
                snapUnit === su.key
                  ? 'bg-[#f97316]/20 border-[#f97316]/50 text-[#f97316]'
                  : 'border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3] hover:border-[#2a3a5e]'
              )}
            >
              {su.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
