/**
 * DerivacaoPanel — Médio Prazo: Look-ahead 6-week grid.
 * Rows = unique activities grouped by networkType (ÁGUA / ESGOTO / SERVIÇOS CIVIS).
 * Columns = 6 ISO weeks. PPC row at section bottom.
 * Click cell → detail modal.
 */
import { useState, useMemo } from 'react'
import { RefreshCw, X, AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type { LookaheadDerivedActivity } from '@/types'
import { cn } from '@/lib/utils'

// ─── Status helpers ───────────────────────────────────────────────────────────

type DaStatus = LookaheadDerivedActivity['status']

const STATUS_DOT: Record<DaStatus, string> = {
  planned:   'bg-[#f97316]',
  ready:     'bg-[#22c55e]',
  blocked:   'bg-[#ef4444]',
  completed: 'bg-[#3b82f6]',
}

const STATUS_LABEL: Record<DaStatus, string> = {
  planned:   'P',
  ready:     'P',
  blocked:   'B',
  completed: 'E',
}

const STATUS_TEXT: Record<DaStatus, string> = {
  planned:   'Planejado',
  ready:     'Pronto',
  blocked:   'Bloqueado',
  completed: 'Executado',
}

const STATUS_BG: Record<DaStatus, string> = {
  planned:   'bg-[#f97316]/8',
  ready:     'bg-[#22c55e]/8',
  blocked:   'bg-[#ef4444]/8',
  completed: 'bg-[#3b82f6]/8',
}

type NetworkFilter = 'all' | 'agua' | 'esgoto'
type NetworkType   = 'agua' | 'esgoto' | 'civil' | 'geral' | undefined

function sectionOf(nt: NetworkType): 'agua' | 'esgoto' | 'civil' {
  if (nt === 'agua')  return 'agua'
  if (nt === 'civil') return 'civil'
  return 'esgoto'
}

/** Returns "S15/26" */
function weekShort(weekIso: string): string {
  const [year, wPart] = weekIso.split('-W')
  return `S${wPart}/${year.slice(2)}`
}

/** Returns Mon–Fri date range string for an ISO week */
function weekDateRange(weekIso: string): string {
  const [year, wStr] = weekIso.split('-W')
  const w = parseInt(wStr, 10)
  const jan4 = new Date(parseInt(year, 10), 0, 4)
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (w - 1) * 7)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${fmt(monday)}–${fmt(friday)}`
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  da: LookaheadDerivedActivity
  onClose: () => void
}

function DetailModal({ da, onClose }: DetailModalProps) {
  const updateDerivedActivity = usePlanejamentoMestreStore((s) => s.updateDerivedActivity)
  const [status, setStatus]   = useState<DaStatus>(da.status)
  const [notes, setNotes]     = useState(da.notes ?? '')

  function handleSave() {
    updateDerivedActivity(da.id, { status, notes: notes || undefined })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div>
            <h3 className="text-[#f5f5f5] font-bold text-sm">{da.name}</h3>
            <p className="text-[#6b6b6b] text-[10px] mt-0.5">{weekShort(da.weekIso)} · {da.responsible}</p>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[#6b6b6b] text-[10px] mb-2 uppercase tracking-widest">Status</p>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(STATUS_LABEL) as DaStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                    status === s
                      ? 'bg-[#f97316] text-white border-[#f97316]'
                      : 'bg-transparent text-[#6b6b6b] border-[#525252] hover:text-[#a3a3a3]'
                  )}
                >
                  {STATUS_TEXT[s]}
                </button>
              ))}
            </div>
          </div>

          {da.linkedRestrictionIds && da.linkedRestrictionIds.length > 0 && (
            <div>
              <p className="text-[#6b6b6b] text-[10px] mb-1 uppercase tracking-widest">Restrições</p>
              {da.linkedRestrictionIds.map((rid) => (
                <div key={rid} className="flex items-center gap-1.5 text-xs text-[#ef4444] mt-0.5">
                  <AlertTriangle size={11} /><span>{rid}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-[#6b6b6b] text-[10px] mb-1 uppercase tracking-widest">Observações</p>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações..."
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#525252]">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-xs text-[#6b6b6b] hover:text-[#a3a3a3]">Cancelar</button>
          <button onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c]">Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Grid Cell ────────────────────────────────────────────────────────────────

interface CellProps {
  da?: LookaheadDerivedActivity
  onClick: () => void
  actName: string
}

function Cell({ da, onClick, actName }: CellProps) {
  if (!da) {
    return (
      <td
        className="border border-[#525252]/30 min-w-[88px] h-8"
        style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 6px)' }}
      />
    )
  }

  const dot  = STATUS_DOT[da.status]
  const lbl  = STATUS_LABEL[da.status]
  const bg   = STATUS_BG[da.status]
  const pct  = da.percentComplete
  const rest = da.linkedRestrictionIds?.length ?? 0

  return (
    <td
      title={`${actName} — ${STATUS_TEXT[da.status]}${pct ? ` (${pct}%)` : ''}${rest ? ` · ${rest} restrição(ões)` : ''}`}
      className={cn('border border-[#525252]/30 cursor-pointer transition-colors min-w-[88px] h-8 px-2 py-1 align-middle', bg, 'hover:brightness-125')}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
        <span className="text-[10px] font-bold text-[#f5f5f5]">{lbl}</span>
        {pct !== undefined && pct > 0 && pct < 100 && (
          <span className="text-[9px] text-[#a3a3a3]">{pct}%</span>
        )}
        {rest > 0 && <span className="text-[9px] text-[#ef4444] ml-auto">⚠{rest}</span>}
      </div>
    </td>
  )
}

// ─── Section header row ───────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string
  color: string
  colSpan: number
}

function SectionHeaderRow({ label, color, colSpan }: SectionHeaderProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-[#525252]/50"
        style={{ background: `${color}18`, color, borderLeft: `3px solid ${color}` }}
      >
        {label}
      </td>
    </tr>
  )
}

// ─── PPC row for a set of weeks/das ──────────────────────────────────────────

interface PpcRowProps {
  weeks: string[]
  das: LookaheadDerivedActivity[]
}

function PpcRow({ weeks, das }: PpcRowProps) {
  function ppc(weekIso: string): number | null {
    const week = das.filter((d) => d.weekIso === weekIso)
    if (week.length === 0) return null
    return Math.round((week.filter((d) => d.status === 'completed').length / week.length) * 100)
  }

  function ppcColor(v: number) {
    if (v >= 80) return 'text-[#22c55e] bg-[#22c55e]/15 border-[#22c55e]/30'
    if (v >= 60) return 'text-[#fbbf24] bg-[#fbbf24]/15 border-[#fbbf24]/30'
    return 'text-[#ef4444] bg-[#ef4444]/15 border-[#ef4444]/30'
  }

  return (
    <tr className="bg-[#0d1c36]">
      <td className="px-3 py-1.5 text-[9px] font-bold text-[#6b6b6b] uppercase tracking-widest sticky left-0 bg-[#0d1c36] z-10 border border-[#525252]/30 whitespace-nowrap">
        PPC Semana
      </td>
      {weeks.map((w) => {
        const v = ppc(w)
        return (
          <td key={w} className="px-2 py-1.5 text-center border border-[#525252]/30">
            {v === null ? (
              <span className="text-[#525252] text-[9px]">—</span>
            ) : (
              <span className={cn('px-1.5 py-0.5 rounded border text-[9px] font-bold tabular-nums', ppcColor(v))}>
                {v}%
              </span>
            )}
          </td>
        )
      })}
    </tr>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function DerivacaoPanel() {
  const { derivedActivities, activities } = usePlanejamentoMestreStore(
    useShallow((s) => ({
      derivedActivities: s.derivedActivities,
      activities:        s.activities,
    }))
  )
  const deriveFromMaster = usePlanejamentoMestreStore((s) => s.deriveFromMaster)

  const [filter,     setFilter]     = useState<NetworkFilter>('all')
  const [selectedDa, setSelectedDa] = useState<LookaheadDerivedActivity | null>(null)

  // Build sorted 6-week list
  const allWeeks = useMemo(
    () => [...new Set(derivedActivities.map((d) => d.weekIso))].sort().slice(0, 6),
    [derivedActivities]
  )

  // masterActivityId → master activity (for networkType fallback)
  const actMap = useMemo(
    () => new Map<string, typeof activities[number]>(activities.map((a) => [a.id, a])),
    [activities]
  )

  // Build rows
  const rows = useMemo(() => {
    const uniqueIds = [...new Set(derivedActivities.map((d) => d.masterActivityId))]
    return uniqueIds.map((mid) => {
      const das = derivedActivities.filter((d) => d.masterActivityId === mid)
      const first = das[0]
      const masterAct = actMap.get(mid)
      const networkType: NetworkType = first?.networkType ?? masterAct?.networkType
      const cellMap = new Map<string, LookaheadDerivedActivity>(das.map((d) => [d.weekIso, d]))
      return {
        masterActivityId: mid,
        name: first?.name ?? masterAct?.name ?? mid,
        responsible: first?.responsible ?? '—',
        networkType,
        section: sectionOf(networkType),
        cellMap,
      }
    })
  }, [derivedActivities, actMap])

  const filteredRows = rows.filter((r) => {
    if (filter === 'agua')   return r.section === 'agua'
    if (filter === 'esgoto') return r.section !== 'agua'
    return true
  })

  const aguaRows   = filteredRows.filter((r) => r.section === 'agua')
  const esgotoRows = filteredRows.filter((r) => r.section === 'esgoto')
  const civilRows  = filteredRows.filter((r) => r.section === 'civil')

  const hasData = derivedActivities.length > 0
  const colSpan = allWeeks.length + 1

  return (
    <div className="flex flex-col gap-4 overflow-hidden h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <button
          onClick={deriveFromMaster}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] transition-colors"
        >
          <RefreshCw size={12} />
          Derivar do Mestre (6 Semanas)
        </button>

        <div className="flex items-center gap-1 bg-[#3d3d3d] border border-[#525252] rounded-lg p-0.5 ml-auto">
          {([['all', 'Todas'], ['agua', 'Água'], ['esgoto', 'Esgoto']] as [NetworkFilter, string][]).map(([key, lbl]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors',
                filter === key ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#a3a3a3]'
              )}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-[#6b6b6b] text-sm">Clique em &ldquo;Derivar do Mestre&rdquo; para gerar o look-ahead de 6 semanas.</p>
        </div>
      ) : (
        <div className="overflow-auto flex-1 rounded-xl border border-[#525252]">
          <table className="border-collapse text-xs min-w-full">
            {/* Header */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0a1628]">
                <th className="px-3 py-2.5 text-left text-[#6b6b6b] font-semibold border border-[#525252]/50 min-w-[190px] sticky left-0 bg-[#0a1628] z-30">
                  Atividade
                </th>
                {allWeeks.map((w) => (
                  <th key={w} className="px-2 py-1.5 text-center border border-[#525252]/50 min-w-[88px]">
                    <div className="text-[#f5f5f5] font-bold text-[11px]">{weekShort(w)}</div>
                    <div className="text-[#6b6b6b] text-[9px] font-normal mt-0.5">{weekDateRange(w)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ── ÁGUA section ── */}
              {aguaRows.length > 0 && (
                <>
                  <SectionHeaderRow label="Água" color="#f97316" colSpan={colSpan} />
                  {aguaRows.map((row) => (
                    <tr key={row.masterActivityId} className="hover:bg-[#3d3d3d]/40 transition-colors">
                      <td className="px-3 py-1.5 border border-[#525252]/30 sticky left-0 bg-[#0d1117] z-10">
                        <p className="text-[#f5f5f5] font-medium text-[11px] truncate max-w-[170px]">{row.name}</p>
                        <p className="text-[#6b6b6b] text-[9px]">{row.responsible}</p>
                      </td>
                      {allWeeks.map((w) => (
                        <Cell
                          key={w}
                          da={row.cellMap.get(w)}
                          actName={row.name}
                          onClick={() => { const d = row.cellMap.get(w); if (d) setSelectedDa(d) }}
                        />
                      ))}
                    </tr>
                  ))}
                  <PpcRow
                    weeks={allWeeks}
                    das={derivedActivities.filter((d) => {
                      const r = rows.find((r) => r.masterActivityId === d.masterActivityId)
                      return r?.section === 'agua'
                    })}
                  />
                </>
              )}

              {/* ── ESGOTO section ── */}
              {esgotoRows.length > 0 && (
                <>
                  <SectionHeaderRow label="Esgoto" color="#22c55e" colSpan={colSpan} />
                  {esgotoRows.map((row) => (
                    <tr key={row.masterActivityId} className="hover:bg-[#3d3d3d]/40 transition-colors">
                      <td className="px-3 py-1.5 border border-[#525252]/30 sticky left-0 bg-[#0d1117] z-10">
                        <p className="text-[#f5f5f5] font-medium text-[11px] truncate max-w-[170px]">{row.name}</p>
                        <p className="text-[#6b6b6b] text-[9px]">{row.responsible}</p>
                      </td>
                      {allWeeks.map((w) => (
                        <Cell
                          key={w}
                          da={row.cellMap.get(w)}
                          actName={row.name}
                          onClick={() => { const d = row.cellMap.get(w); if (d) setSelectedDa(d) }}
                        />
                      ))}
                    </tr>
                  ))}
                  <PpcRow
                    weeks={allWeeks}
                    das={derivedActivities.filter((d) => {
                      const r = rows.find((r) => r.masterActivityId === d.masterActivityId)
                      return r?.section === 'esgoto'
                    })}
                  />
                </>
              )}

              {/* ── SERVIÇOS CIVIS section ── */}
              {civilRows.length > 0 && (
                <>
                  <SectionHeaderRow label="Serviços Civis" color="#f59e0b" colSpan={colSpan} />
                  {civilRows.map((row) => (
                    <tr key={row.masterActivityId} className="hover:bg-[#3d3d3d]/40 transition-colors">
                      <td className="px-3 py-1.5 border border-[#525252]/30 sticky left-0 bg-[#0d1117] z-10">
                        <p className="text-[#f5f5f5] font-medium text-[11px] truncate max-w-[170px]">{row.name}</p>
                        <p className="text-[#6b6b6b] text-[9px]">{row.responsible}</p>
                      </td>
                      {allWeeks.map((w) => (
                        <Cell
                          key={w}
                          da={row.cellMap.get(w)}
                          actName={row.name}
                          onClick={() => { const d = row.cellMap.get(w); if (d) setSelectedDa(d) }}
                        />
                      ))}
                    </tr>
                  ))}
                  <PpcRow
                    weeks={allWeeks}
                    das={derivedActivities.filter((d) => {
                      const r = rows.find((r) => r.masterActivityId === d.masterActivityId)
                      return r?.section === 'civil'
                    })}
                  />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {hasData && (
        <div className="flex items-center gap-4 shrink-0 text-[10px] text-[#6b6b6b]">
          <span className="font-semibold">Legenda:</span>
          {(Object.entries(STATUS_DOT) as [DaStatus, string][]).map(([s, dot]) => (
            <div key={s} className="flex items-center gap-1">
              <span className={cn('w-2 h-2 rounded-full', dot)} />
              <span>{STATUS_TEXT[s]}</span>
            </div>
          ))}
          <span className="ml-2">⚠ = Restrição</span>
        </div>
      )}

      {selectedDa && <DetailModal da={selectedDa} onClose={() => setSelectedDa(null)} />}
    </div>
  )
}
