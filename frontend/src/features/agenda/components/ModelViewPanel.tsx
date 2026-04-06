/**
 * ScheduleExecutionPanel — slide-in panel showing schedule execution simulation.
 * Uses planejamentoStore ganttRows, auto-loads demo data if empty.
 * Provides Play/Pause animation stepping through time with progress bars.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Play, Pause, RotateCcw, CalendarDays, DollarSign, Clock } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `R$ ${(n / 1_000).toFixed(1)}k`
  return `R$ ${n.toFixed(0)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function ModelViewPanel({ onClose }: { onClose: () => void }) {
  const { ganttRows, projectEndDate, totalCostBRL, trechos, teams, loadDemoData, runSchedule, isScheduleDirty } =
    usePlanejamentoStore((s) => ({
      ganttRows:      s.ganttRows,
      projectEndDate: s.projectEndDate,
      totalCostBRL:   s.totalCostBRL,
      trechos:        s.trechos,
      teams:          s.teams,
      loadDemoData:   s.loadDemoData,
      runSchedule:    s.runSchedule,
      isScheduleDirty: s.isScheduleDirty,
    }))

  // Animation state: simStep = 0–100 (represents % of project timeline elapsed)
  const [simStep, setSimStep]   = useState(0)
  const [playing, setPlaying]   = useState(false)
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load demo data + run schedule on mount if needed
  useEffect(() => {
    if (trechos.length === 0) {
      loadDemoData()
    } else if (isScheduleDirty || ganttRows.length === 0) {
      runSchedule()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  function togglePlay() {
    if (playing) {
      stopInterval()
      setPlaying(false)
    } else {
      if (simStep >= 100) setSimStep(0)
      setPlaying(true)
      intervalRef.current = setInterval(() => {
        setSimStep((prev) => {
          if (prev >= 100) {
            stopInterval()
            setPlaying(false)
            return 100
          }
          return prev + 1
        })
      }, 80)
    }
  }

  function reset() {
    stopInterval()
    setPlaying(false)
    setSimStep(0)
  }

  useEffect(() => () => stopInterval(), [stopInterval])

  // Compute per-row progress based on simStep (0–100 maps to project timeline)
  const rows = ganttRows.slice(0, 12)

  const projectStart = ganttRows.length > 0
    ? ganttRows.reduce((min, r) => r.startDate < min ? r.startDate : min, ganttRows[0].startDate)
    : null
  const projectEnd = projectEndDate

  function rowProgress(startDate: string, endDate: string): number {
    if (!projectStart || !projectEnd) return 0
    const projMs  = new Date(projectEnd).getTime()   - new Date(projectStart).getTime()
    const startMs = new Date(startDate).getTime()    - new Date(projectStart).getTime()
    const endMs   = new Date(endDate).getTime()      - new Date(projectStart).getTime()
    if (projMs <= 0) return 0

    const simMs = (simStep / 100) * projMs
    if (simMs < startMs) return 0
    if (simMs >= endMs)  return 100
    return Math.round(((simMs - startMs) / (endMs - startMs)) * 100)
  }

  const completedCount = rows.filter((r) => {
    if (!projectStart || !projectEnd) return false
    const projMs = new Date(projectEnd).getTime() - new Date(projectStart).getTime()
    const endMs  = new Date(r.endDate).getTime()  - new Date(projectStart).getTime()
    return (simStep / 100) * projMs >= endMs
  }).length

  const simDate = (() => {
    if (!projectStart || !projectEnd) return null
    const startMs = new Date(projectStart).getTime()
    const endMs   = new Date(projectEnd).getTime()
    const curMs   = startMs + (simStep / 100) * (endMs - startMs)
    return new Date(curMs).toISOString().slice(0, 10)
  })()

  const noData = ganttRows.length === 0

  return (
    <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-[#0d1117] border-l border-[#525252] shadow-2xl w-full sm:w-[420px]">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#525252] flex items-center justify-between shrink-0">
        <div>
          <p className="text-[#f5f5f5] text-sm font-semibold">Execução do Modelo</p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            {noData ? 'Carregando cronograma demo…' : `${ganttRows.length} trechos · ${teams.length} equipes`}
          </p>
        </div>
        <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={18} /></button>
      </div>

      {noData ? (
        <div className="flex-1 flex items-center justify-center text-[#3f3f3f] text-xs">
          Calculando cronograma…
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-[#525252] shrink-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-[#6b6b6b] uppercase tracking-wide flex items-center gap-1">
                <CalendarDays size={9} /> Fim Previsto
              </span>
              <span className="text-xs font-bold text-[#f97316]">{fmtDate(projectEnd)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-[#6b6b6b] uppercase tracking-wide flex items-center gap-1">
                <DollarSign size={9} /> Custo Total
              </span>
              <span className="text-xs font-bold text-[#a78bfa]">{fmtBRL(totalCostBRL)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-[#6b6b6b] uppercase tracking-wide flex items-center gap-1">
                <Clock size={9} /> Simulação
              </span>
              <span className="text-xs font-bold text-[#f5f5f5]">{fmtDate(simDate)}</span>
            </div>
          </div>

          {/* Timeline scrubber + controls */}
          <div className="px-4 py-3 border-b border-[#525252] shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={togglePlay}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f97316] hover:bg-[#22a8c4] text-white transition-colors shrink-0"
              >
                {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>
              <button
                onClick={reset}
                className="flex items-center justify-center w-7 h-7 rounded-full border border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3] hover:border-[#6b6b6b] transition-colors shrink-0"
              >
                <RotateCcw size={12} />
              </button>
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={simStep}
                  onChange={(e) => { stopInterval(); setPlaying(false); setSimStep(parseInt(e.target.value)) }}
                  className="w-full accent-[#f97316] h-1.5 cursor-pointer"
                />
              </div>
              <span className="text-[10px] text-[#6b6b6b] tabular-nums w-8 text-right">{simStep}%</span>
            </div>
            <div className="flex justify-between text-[9px] text-[#6b6b6b]">
              <span>{fmtDate(projectStart)}</span>
              <span>{completedCount}/{rows.length} concluídos</span>
              <span>{fmtDate(projectEnd)}</span>
            </div>
          </div>

          {/* Activity progress list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
            {rows.map((row, i) => {
              const pct = rowProgress(row.startDate, row.endDate)
              const isActive = pct > 0 && pct < 100
              const isDone   = pct === 100

              return (
                <div key={row.trecho.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#a3a3a3] truncate font-mono" style={{ maxWidth: '200px' }}>
                      {String(i + 1).padStart(2, '0')} {row.trecho.code}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-semibold tabular-nums ${isDone ? 'text-[#22c55e]' : isActive ? 'text-[#f97316]' : 'text-[#6b6b6b]'}`}>
                        {pct}%
                      </span>
                      {isDone && <span className="text-[9px] text-[#22c55e]">✓</span>}
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#3d3d3d] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-100 ${isDone ? 'bg-[#22c55e]' : 'bg-[#f97316]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-[#3f3f3f]">
                    <span>{fmtDate(row.startDate)}</span>
                    <span>{fmtBRL(row.totalCostBRL)}</span>
                    <span>{fmtDate(row.endDate)}</span>
                  </div>
                </div>
              )
            })}

            {ganttRows.length > 12 && (
              <p className="text-[10px] text-[#3f3f3f] text-center mt-1">
                + {ganttRows.length - 12} trechos adicionais
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#525252] shrink-0 flex items-center justify-between">
            <p className="text-[10px] text-[#3f3f3f]">Simulação baseada em dados demo</p>
            <a
              href="/app/planejamento"
              className="flex items-center gap-1.5 text-xs text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
            >
              Abrir Planejamento ↗
            </a>
          </div>
        </>
      )}
    </div>
  )
}
