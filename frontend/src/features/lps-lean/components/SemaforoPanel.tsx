/**
 * SemaforoPanel — Ready/Not-Ready semaphore table with inline CNC editing.
 * Columns: Semana | Trecho | Descrição | Equipe | Semáforo | Status | CNC
 */
import { useState, useMemo } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'
import { useLpsStore, computeWeeklyPPC, weekLabel, isoWeek } from '@/store/lpsStore'
import type { LpsActivity, LpsCncCategory, LpsReadyStatus } from '@/types'
import { ConfirmDialog } from './ConfirmDialog'

const CNC_OPTIONS: { value: LpsCncCategory; label: string }[] = [
  { value: 'weather',   label: 'Clima' },
  { value: 'equipment', label: 'Equipamento' },
  { value: 'labor',     label: 'Mão de Obra' },
  { value: 'material',  label: 'Material' },
  { value: 'design',    label: 'Projeto' },
  { value: 'other',     label: 'Outro' },
]

const STATUS_COLORS: Record<LpsReadyStatus, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
}

const STATUS_LABELS: Record<LpsReadyStatus, string> = {
  green:  'Pronto',
  yellow: 'Em risco',
  red:    'Não cumprido',
}

// ─── Inline CNC editor ────────────────────────────────────────────────────────

function CncEditor({ activity, onClose }: { activity: LpsActivity; onClose: () => void }) {
  const updateActivity = useLpsStore((s) => s.updateActivity)
  const [cat,  setCat]       = useState<LpsCncCategory>(activity.cncCategory ?? 'other')
  const [desc, setDesc]      = useState(activity.cncDescription ?? '')
  const [confirming, setConfirming] = useState(false)

  function handleSave() {
    setConfirming(true)
  }
  function confirmSave() {
    updateActivity(activity.id, { cncCategory: cat, cncDescription: desc, readyStatus: 'red' })
    onClose()
  }
  function handleClear() {
    updateActivity(activity.id, { cncCategory: undefined, cncDescription: undefined, readyStatus: 'green' })
    onClose()
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700 min-w-[280px]">
      <p className="text-xs font-semibold text-gray-300">Causa de Não Cumprimento (CNC)</p>
      <select
        value={cat}
        onChange={(e) => setCat(e.target.value as LpsCncCategory)}
        className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
      >
        {CNC_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descreva a causa..."
        rows={2}
        className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 resize-none"
      />
      {confirming ? (
        <ConfirmDialog
          message={`Salvar CNC: ${CNC_OPTIONS.find((o) => o.value === cat)?.label ?? cat}?`}
          confirmLabel="Salvar"
          onConfirm={confirmSave}
          onCancel={() => setConfirming(false)}
          danger={false}
        />
      ) : (
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
            <Check size={11} /> Salvar
          </button>
          <button onClick={handleClear} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
            <X size={11} /> Limpar CNC
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Add activity form ────────────────────────────────────────────────────────

function AddActivityRow({ onClose }: { onClose: () => void }) {
  const addActivity = useLpsStore((s) => s.addActivity)
  const [week, setWeek]  = useState(isoWeek(new Date()))
  const [code, setCode]  = useState('')
  const [desc, setDesc]  = useState('')
  const [team, setTeam]  = useState('')
  const [meters, setMeters] = useState('0')

  function handleAdd() {
    if (!code.trim()) return
    addActivity({
      week,
      trechoCode: code,
      description: desc,
      planned: true,
      completed: false,
      readyStatus: 'green',
      responsibleTeam: team,
      plannedMeters: parseFloat(meters) || 0,
    })
    onClose()
  }

  return (
    <tr className="bg-orange-900/10 border-b border-gray-800">
      <td className="px-3 py-2">
        <input value={week} onChange={(e) => setWeek(e.target.value)}
          className="w-24 bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500" />
      </td>
      <td className="px-3 py-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="T01"
          className="w-16 bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500" />
      </td>
      <td className="px-3 py-2">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição..."
          className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500" />
      </td>
      <td className="px-3 py-2">
        <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Equipe..."
          className="w-24 bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500" />
      </td>
      <td className="px-3 py-2 text-center">
        <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
      </td>
      <td className="px-3 py-2">
        <input value={meters} onChange={(e) => setMeters(e.target.value)} type="number"
          className="w-16 bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500 text-right" />
        <span className="text-xs text-gray-500 ml-1">m</span>
      </td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button onClick={handleAdd} className="px-2 py-1 rounded text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
            <Check size={11} />
          </button>
          <button onClick={onClose} className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
            <X size={11} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SemaforoPanel() {
  const activities     = useLpsStore((s) => s.activities)
  const updateActivity = useLpsStore((s) => s.updateActivity)
  const removeActivity = useLpsStore((s) => s.removeActivity)

  const [filterWeek, setFilterWeek]   = useState('')
  const [filterTeam, setFilterTeam]   = useState('')
  const [cncOpenId,  setCncOpenId]    = useState<string | null>(null)
  const [showAdd,    setShowAdd]      = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const weekly    = useMemo(() => computeWeeklyPPC(activities), [activities])
  const weekOptions = useMemo(() => [...new Set(activities.map((a) => a.week))].sort(), [activities])
  const teamOptions = useMemo(() => [...new Set(activities.map((a) => a.responsibleTeam).filter(Boolean))], [activities])

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (filterWeek && a.week !== filterWeek) return false
      if (filterTeam && a.responsibleTeam !== filterTeam) return false
      return true
    }).sort((a, b) => a.week.localeCompare(b.week) || a.trechoCode.localeCompare(b.trechoCode))
  }, [activities, filterWeek, filterTeam])

  // PPC for current filter
  const filteredWeekly = weekly.filter((w) => !filterWeek || w.week === filterWeek)
  const filteredPpc = filteredWeekly.length > 0
    ? Math.round(filteredWeekly.reduce((s, w) => s + w.ppc, 0) / filteredWeekly.length)
    : null

  function toggleCompleted(a: LpsActivity) {
    const completed = !a.completed
    updateActivity(a.id, {
      completed,
      readyStatus: completed ? 'green' : a.readyStatus === 'green' ? 'red' : a.readyStatus,
    })
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500">
          <option value="">Todas as semanas</option>
          {weekOptions.map((w) => (
            <option key={w} value={w}>{weekLabel(w)} ({w})</option>
          ))}
        </select>

        <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500">
          <option value="">Todas as equipes</option>
          {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {filteredPpc !== null && (
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${
            filteredPpc >= 80 ? 'text-green-400 border-green-800 bg-green-900/20'
            : filteredPpc >= 60 ? 'text-yellow-400 border-yellow-800 bg-yellow-900/20'
            : 'text-red-400 border-red-800 bg-red-900/20'
          }`}>
            PPC: {filteredPpc}%
          </span>
        )}

        <button onClick={() => setShowAdd(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
          <Plus size={13} /> Adicionar Atividade
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/80 border-b border-gray-700">
            <tr>
              <th className="text-left text-gray-400 px-3 py-3 text-xs font-semibold">Semana</th>
              <th className="text-left text-gray-400 px-3 py-3 text-xs font-semibold">Trecho</th>
              <th className="text-left text-gray-400 px-3 py-3 text-xs font-semibold">Descrição</th>
              <th className="text-left text-gray-400 px-3 py-3 text-xs font-semibold">Equipe</th>
              <th className="text-center text-gray-400 px-3 py-3 text-xs font-semibold">Semáforo</th>
              <th className="text-right text-gray-400 px-3 py-3 text-xs font-semibold">Prod. Planj.</th>
              <th className="text-left text-gray-400 px-3 py-3 text-xs font-semibold">CNC</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {showAdd && (
              <AddActivityRow onClose={() => setShowAdd(false)} />
            )}
            {filtered.map((a) => (
              <tr key={a.id} className="bg-gray-900 hover:bg-gray-800/60 transition-colors">
                <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap font-mono">
                  {weekLabel(a.week)}
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-semibold text-white">{a.trechoCode}</span>
                </td>
                <td className="px-3 py-2.5 text-gray-300 text-xs max-w-[220px] truncate">
                  {a.description}
                </td>
                <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                  {a.responsibleTeam ?? '—'}
                </td>

                {/* Semaphore dot — click to toggle completed or open CNC */}
                <td className="px-3 py-2.5 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => {
                        if (a.readyStatus === 'red') {
                          setCncOpenId(cncOpenId === a.id ? null : a.id)
                        } else {
                          toggleCompleted(a)
                        }
                      }}
                      title={STATUS_LABELS[a.readyStatus]}
                      className={`w-4 h-4 rounded-full ${STATUS_COLORS[a.readyStatus]} hover:opacity-80 transition-opacity cursor-pointer`}
                    />
                    {a.completed && (
                      <Check size={9} className="text-green-400" />
                    )}
                  </div>

                  {/* CNC editor inline below the row */}
                  {cncOpenId === a.id && (
                    <div className="absolute z-50 mt-1">
                      <CncEditor activity={a} onClose={() => setCncOpenId(null)} />
                    </div>
                  )}
                </td>

                <td className="px-3 py-2.5 text-right text-gray-300 text-xs font-mono whitespace-nowrap">
                  {a.plannedMeters ? `${a.plannedMeters} m` : '—'}
                  {a.executedMeters ? (
                    <span className="block text-[10px] text-green-400">{a.executedMeters} m exec.</span>
                  ) : null}
                </td>

                <td className="px-3 py-2.5">
                  {a.cncCategory ? (
                    <button
                      onClick={() => setCncOpenId(cncOpenId === a.id ? null : a.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 transition-colors whitespace-nowrap"
                    >
                      {CNC_OPTIONS.find((o) => o.value === a.cncCategory)?.label ?? a.cncCategory}
                    </button>
                  ) : (
                    <button
                      onClick={() => setCncOpenId(cncOpenId === a.id ? null : a.id)}
                      className="text-gray-500 hover:text-gray-300 text-[11px] transition-colors"
                    >
                      + CNC
                    </button>
                  )}
                </td>

                <td className="px-3 py-2.5">
                  {confirmDeleteId === a.id ? (
                    <ConfirmDialog
                      message="Remover atividade?"
                      onConfirm={() => { removeActivity(a.id); setConfirmDeleteId(null) }}
                      onCancel={() => setConfirmDeleteId(null)}
                    />
                  ) : (
                    <button onClick={() => setConfirmDeleteId(a.id)}
                      className="text-gray-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !showAdd && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-600 text-sm">
                  Nenhuma atividade encontrada. Clique em "Adicionar Atividade" para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600">
        {filtered.length} atividades · Clique na bolinha vermelha para registrar CNC · Clique nas demais para alternar conclusão
      </p>
    </div>
  )
}
