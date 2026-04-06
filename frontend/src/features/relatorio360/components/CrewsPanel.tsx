import { Users, Clock, ChevronDown, ChevronUp, Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { useState } from 'react'
import { cn, formatCurrency, formatHours } from '@/lib/utils'
import { useCurrentReport } from '@/hooks/useRelatorio360'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useShallow } from 'zustand/react/shallow'
import type { Crew, Timecard } from '@/types'

interface CrewCardProps {
  crew: Crew
  onUpdateCrew: (crewId: string, patch: Partial<Pick<Crew, 'foremanName' | 'crewType'>>) => void
  onAddTimecard: (crewId: string, tc: Omit<Timecard, 'id'>) => void
  onUpdateTimecard: (crewId: string, tcId: string, patch: Partial<Omit<Timecard, 'id'>>) => void
  onDeleteTimecard: (crewId: string, tcId: string) => void
}

function CrewCard({ crew, onUpdateCrew, onAddTimecard, onUpdateTimecard, onDeleteTimecard }: CrewCardProps) {
  const [open, setOpen]         = useState(false)
  const [editing, setEditing]   = useState(false)
  const report = useCurrentReport()

  // Draft state for crew header fields
  const [draftForeman, setDraftForeman] = useState(crew.foremanName)
  const [draftType, setDraftType]       = useState(crew.crewType)

  // Draft state for timecard edits: id -> partial patch
  const [tcEdits, setTcEdits] = useState<Record<string, Partial<Omit<Timecard, 'id'>>>>({})
  const [editingTcId, setEditingTcId] = useState<string | null>(null)

  // New timecard row
  const [addingTc, setAddingTc] = useState(false)
  const [newTc, setNewTc] = useState<Omit<Timecard, 'id'>>({
    workerName: '', role: '', hoursWorked: 8, hourlyRate: 0,
  })

  const totalHours = crew.timecards.reduce((s, t) => s + t.hoursWorked, 0)
  const totalCost  = crew.timecards.reduce((s, t) => s + t.hoursWorked * t.hourlyRate, 0)

  const crewActivities = report?.activities.filter((a) => crew.activityIds.includes(a.id)) ?? []

  function saveCrew() {
    onUpdateCrew(crew.id, { foremanName: draftForeman.trim() || crew.foremanName, crewType: draftType.trim() || crew.crewType })
    setEditing(false)
  }

  function cancelEdit() {
    setDraftForeman(crew.foremanName)
    setDraftType(crew.crewType)
    setEditing(false)
  }

  function saveTc(tcId: string) {
    const patch = tcEdits[tcId]
    if (patch) onUpdateTimecard(crew.id, tcId, patch)
    setEditingTcId(null)
    setTcEdits((prev) => { const next = { ...prev }; delete next[tcId]; return next })
  }

  function cancelTc() {
    setEditingTcId(null)
    setTcEdits({})
  }

  function submitNewTc() {
    if (!newTc.workerName.trim()) return
    onAddTimecard(crew.id, newTc)
    setNewTc({ workerName: '', role: '', hoursWorked: 8, hourlyRate: 0 })
    setAddingTc(false)
  }

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] overflow-hidden">
      <div className="w-full flex items-center justify-between px-4 py-3">
        {editing ? (
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <input
              value={draftForeman}
              onChange={(e) => setDraftForeman(e.target.value)}
              className="flex-1 min-w-[120px] bg-[#333333] border border-[#525252] rounded-lg px-2 py-1 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
              placeholder="Encarregado"
            />
            <input
              value={draftType}
              onChange={(e) => setDraftType(e.target.value)}
              className="w-28 bg-[#333333] border border-[#525252] rounded-lg px-2 py-1 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
              placeholder="Tipo"
            />
            <button onClick={saveCrew} className="text-[#22c55e] hover:text-[#22c55e]/80 transition-colors" title="Salvar">
              <Check size={15} />
            </button>
            <button onClick={cancelEdit} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors" title="Cancelar">
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(!open)}
            className="flex-1 text-left flex flex-col gap-0.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-[#f5f5f5] font-semibold text-sm">{crew.foremanName}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f97316]/15 text-[#f97316] font-semibold uppercase tracking-wider">
                {crew.crewType}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#a3a3a3]">
              <span className="flex items-center gap-1"><Users size={11} />{crew.timecards.length} apontamentos</span>
              <span className="flex items-center gap-1"><Clock size={11} />{formatHours(totalHours)}</span>
              <span className="text-[#f97316] font-mono font-semibold">{formatCurrency(totalCost)}</span>
            </div>
          </button>
        )}

        <div className="flex items-center gap-2 ml-2">
          {!editing && (
            <button
              onClick={() => { setEditing(true); setOpen(true) }}
              className="text-[#6b6b6b] hover:text-[#f97316] transition-colors"
              title="Editar equipe"
            >
              <Pencil size={13} />
            </button>
          )}
          <button onClick={() => setOpen(!open)} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#525252] px-4 py-3 flex flex-col gap-3">
          {/* Timecards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">Apontamentos</p>
              {editing && (
                <button
                  onClick={() => setAddingTc(true)}
                  className="flex items-center gap-1 text-[#f97316] text-xs hover:text-[#f97316]/80 transition-colors"
                >
                  <Plus size={11} /> Adicionar membro
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {crew.timecards.map((tc) => (
                <div key={tc.id} className="flex items-center justify-between text-xs text-[#a3a3a3]">
                  {editing && editingTcId === tc.id ? (
                    <div className="flex-1 grid grid-cols-4 gap-1.5">
                      <input
                        value={tcEdits[tc.id]?.workerName ?? tc.workerName}
                        onChange={(e) => setTcEdits((p) => ({ ...p, [tc.id]: { ...p[tc.id], workerName: e.target.value } }))}
                        className="bg-[#333333] border border-[#525252] rounded px-1.5 py-0.5 text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
                        placeholder="Nome"
                      />
                      <input
                        value={tcEdits[tc.id]?.role ?? tc.role}
                        onChange={(e) => setTcEdits((p) => ({ ...p, [tc.id]: { ...p[tc.id], role: e.target.value } }))}
                        className="bg-[#333333] border border-[#525252] rounded px-1.5 py-0.5 text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
                        placeholder="Função"
                      />
                      <input
                        type="number" min={0} step={0.5}
                        value={tcEdits[tc.id]?.hoursWorked ?? tc.hoursWorked}
                        onChange={(e) => setTcEdits((p) => ({ ...p, [tc.id]: { ...p[tc.id], hoursWorked: Number(e.target.value) } }))}
                        className="bg-[#333333] border border-[#525252] rounded px-1.5 py-0.5 text-[#f5f5f5] text-center focus:outline-none focus:border-[#f97316]/60"
                      />
                      <div className="flex items-center gap-1">
                        <button onClick={() => saveTc(tc.id)} className="text-[#22c55e]"><Check size={12} /></button>
                        <button onClick={cancelTc} className="text-[#6b6b6b]"><X size={12} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[#f5f5f5] font-medium">{tc.workerName}</span>
                        <span className="text-[#6b6b6b]">{tc.role}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono">{formatHours(tc.hoursWorked)}</span>
                        <span className="font-mono text-[#f97316]">{formatCurrency(tc.hoursWorked * tc.hourlyRate)}</span>
                        {editing && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditingTcId(tc.id)} className="text-[#6b6b6b] hover:text-[#f97316]"><Pencil size={10} /></button>
                            <button onClick={() => onDeleteTimecard(crew.id, tc.id)} className="text-[#6b6b6b] hover:text-[#ef4444]"><Trash2 size={10} /></button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* New timecard row */}
              {addingTc && (
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  <input
                    value={newTc.workerName}
                    onChange={(e) => setNewTc((p) => ({ ...p, workerName: e.target.value }))}
                    className="bg-[#333333] border border-[#f97316]/40 rounded px-1.5 py-0.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
                    placeholder="Nome *"
                    autoFocus
                  />
                  <input
                    value={newTc.role}
                    onChange={(e) => setNewTc((p) => ({ ...p, role: e.target.value }))}
                    className="bg-[#333333] border border-[#f97316]/40 rounded px-1.5 py-0.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
                    placeholder="Função"
                  />
                  <input
                    type="number" min={0} step={0.5}
                    value={newTc.hoursWorked}
                    onChange={(e) => setNewTc((p) => ({ ...p, hoursWorked: Number(e.target.value) }))}
                    className="bg-[#333333] border border-[#f97316]/40 rounded px-1.5 py-0.5 text-xs text-[#f5f5f5] text-center focus:outline-none focus:border-[#f97316]/60"
                  />
                  <div className="flex items-center gap-1">
                    <button onClick={submitNewTc} disabled={!newTc.workerName.trim()} className="text-[#22c55e] disabled:opacity-40"><Check size={12} /></button>
                    <button onClick={() => setAddingTc(false)} className="text-[#6b6b6b]"><X size={12} /></button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Activities */}
          {crewActivities.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-2">Atividades</p>
              <div className="flex flex-wrap gap-1.5">
                {crewActivities.map((act) => (
                  <span
                    key={act.id}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider',
                      act.status === 'completed'
                        ? 'bg-[#22c55e]/15 text-[#22c55e]'
                        : act.status === 'in_progress'
                        ? 'bg-[#f97316]/15 text-[#f97316]'
                        : 'bg-[#3f3f3f] text-[#a3a3a3]'
                    )}
                  >
                    {act.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CrewsPanel() {
  const report = useCurrentReport()
  const crews  = report?.crews ?? []

  const { updateCrew, addTimecard, updateTimecard, deleteTimecard } = useRelatorio360Store(
    useShallow((s) => ({
      updateCrew:     s.updateCrew,
      addTimecard:    s.addTimecard,
      updateTimecard: s.updateTimecard,
      deleteTimecard: s.deleteTimecard,
    }))
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] flex items-center gap-2">
          <Users size={13} />
          Equipes em Campo
        </h2>
        <span className="text-xs font-mono text-[#6b6b6b]">{crews.length} equipes</span>
      </div>

      {crews.length === 0 ? (
        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-6 text-center text-sm text-[#6b6b6b]">
          Nenhuma equipe registrada
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {crews.map((crew) => (
            <CrewCard
              key={crew.id}
              crew={crew}
              onUpdateCrew={updateCrew}
              onAddTimecard={addTimecard}
              onUpdateTimecard={updateTimecard}
              onDeleteTimecard={deleteTimecard}
            />
          ))}
        </div>
      )}
    </div>
  )
}
