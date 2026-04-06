/**
 * LookAheadPanel — 6-week look-ahead planning grid.
 * Rows = trechos/activities, Columns = next 6 ISO weeks.
 */
import { useMemo } from 'react'
import { Check, X, Minus } from 'lucide-react'
import { useLpsStore, computeWeeklyPPC, weekLabel, weekOffset, isoWeek } from '@/store/lpsStore'
import type { LpsActivity } from '@/types'

const TEAM_COLORS: Record<string, string> = {
  'Equipe A': '#3b82f6',
  'Equipe B': '#8b5cf6',
  'Equipe C': '#10b981',
  'Equipe D': '#f59e0b',
}

function teamColor(team?: string): string {
  if (!team) return '#4b5563'
  return TEAM_COLORS[team] ?? '#6366f1'
}

export function LookAheadPanel() {
  const activities     = useLpsStore((s) => s.activities)
  const updateActivity = useLpsStore((s) => s.updateActivity)
  const addActivity    = useLpsStore((s) => s.addActivity)

  const today = new Date()

  // 6 future weeks starting from current week
  const weeks = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => weekOffset(today, i))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // All unique trecho codes from activities
  const trechos = useMemo(() => {
    const codes = [...new Set(activities.map((a) => ({
      code: a.trechoCode,
      desc: a.description,
      team: a.responsibleTeam,
    })))]
    // Deduplicate by code
    const seen = new Set<string>()
    return codes.filter((c) => {
      if (seen.has(c.code)) return false
      seen.add(c.code)
      return true
    }).sort((a, b) => a.code.localeCompare(b.code))
  }, [activities])

  // Weekly PPC for header row
  const weekly = useMemo(() => computeWeeklyPPC(activities), [activities])

  function getCellActivity(code: string, week: string): LpsActivity | undefined {
    return activities.find((a) => a.trechoCode === code && a.week === week)
  }

  function handleCellClick(code: string, week: string, team?: string) {
    const existing = getCellActivity(code, week)
    if (existing) {
      // Cycle: planned → completed → not planned → planned
      if (!existing.completed) {
        updateActivity(existing.id, { completed: true, readyStatus: 'green' })
      } else {
        // remove
        useLpsStore.getState().removeActivity(existing.id)
      }
    } else {
      // Create new planned activity
      addActivity({
        week,
        trechoCode: code,
        description: trechos.find((t) => t.code === code)?.desc ?? code,
        planned: true,
        completed: false,
        readyStatus: 'green',
        responsibleTeam: team,
      })
    }
  }

  const ppcByWeek = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of weekly) map.set(w.week, w.ppc)
    return map
  }, [weekly])

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Look-ahead — Próximas 6 Semanas</p>
          <p className="text-xs text-[#6b6b6b] mt-0.5">Clique em uma célula para planejar / marcar como concluído / remover</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#6b6b6b]">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-blue-600 inline-block" /> Planejado
          </span>
          <span className="flex items-center gap-1.5">
            <Check size={12} className="text-green-400" /> Concluído
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-[#3d3d3d] border border-[#525252] inline-block" /> Não planejado
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-[#3d3d3d] overflow-hidden overflow-x-auto">
        <table className="text-xs w-full">
          {/* Header */}
          <thead className="bg-[#3d3d3d]/80">
            <tr>
              <th className="text-left text-[#a3a3a3] px-4 py-3 font-semibold w-32 sticky left-0 bg-[#3d3d3d]/80 border-r border-[#525252]">
                Trecho
              </th>
              {weeks.map((w) => {
                const ppc = ppcByWeek.get(w)
                const isCurrentWeek = w === isoWeek(today)
                return (
                  <th key={w} className={`text-center px-2 py-3 font-semibold min-w-[80px] ${isCurrentWeek ? 'text-orange-400' : 'text-[#a3a3a3]'}`}>
                    <div>{weekLabel(w)}</div>
                    {ppc !== undefined && (
                      <div className={`text-[10px] font-normal mt-0.5 ${ppc >= 80 ? 'text-green-400' : ppc >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                        PPC {ppc}%
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#3d3d3d]">
            {trechos.map((t) => (
              <tr key={t.code} className="bg-[#2c2c2c] hover:bg-[#3d3d3d]/30 transition-colors">
                {/* Trecho label */}
                <td className="px-4 py-2.5 sticky left-0 bg-[#2c2c2c] border-r border-[#3d3d3d] z-10">
                  <div className="text-white font-semibold text-xs">{t.code}</div>
                  <div className="text-[#6b6b6b] text-[10px] truncate max-w-[110px]">{t.desc}</div>
                  {t.team && (
                    <div
                      className="text-[10px] font-medium mt-0.5"
                      style={{ color: teamColor(t.team) }}
                    >
                      {t.team}
                    </div>
                  )}
                </td>

                {/* Week cells */}
                {weeks.map((w) => {
                  const cell = getCellActivity(t.code, w)
                  const isCurrentWeek = w === isoWeek(today)
                  const color = teamColor(t.team)

                  return (
                    <td key={w} className={`px-2 py-1.5 text-center ${isCurrentWeek ? 'bg-orange-900/10' : ''}`}>
                      <button
                        onClick={() => handleCellClick(t.code, w, t.team)}
                        className="w-full h-10 rounded-md flex items-center justify-center transition-all"
                        style={
                          cell?.planned && !cell.completed
                            ? { backgroundColor: color + '33', border: `1px solid ${color}66` }
                            : cell?.completed
                              ? { backgroundColor: '#15803d33', border: '1px solid #16a34a66' }
                              : { backgroundColor: '#1f2937', border: '1px solid #374151' }
                        }
                        title={
                          cell?.completed ? 'Concluído — clique para remover'
                          : cell?.planned  ? 'Planejado — clique para marcar como concluído'
                          : 'Não planejado — clique para planejar'
                        }
                      >
                        {cell?.completed
                          ? <Check size={14} className="text-green-400" />
                          : cell?.planned
                            ? <span className="text-[10px] font-semibold" style={{ color }}>{cell.plannedMeters ? `${cell.plannedMeters}m` : '✓'}</span>
                            : <Minus size={12} className="text-gray-700" />
                        }
                        {cell?.cncCategory && (
                          <X size={10} className="text-red-400 ml-0.5" />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}

            {trechos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-600 text-sm">
                  Nenhum trecho encontrado. Adicione atividades na aba Semáforo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
