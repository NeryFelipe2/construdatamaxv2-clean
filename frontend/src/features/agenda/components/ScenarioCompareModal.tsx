/**
 * ScenarioCompareModal — lists saved Planejamento scenarios,
 * allows applying one to the Agenda (imports dates), comparing two side-by-side,
 * creating new scenarios, renaming, and deleting.
 */
import { useState } from 'react'
import { X, Check, GitCompare, Play, Plus, Pencil, Trash2 } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useAgendaStore } from '@/store/agendaStore'
import type { PlanScenario } from '@/types'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function scenarioStats(sc: PlanScenario) {
  const totalMeters = sc.trechos.reduce((s, t) => s + t.lengthM, 0)
  const totalCost   = sc.trechos.reduce((s, t) => s + (t.unitCostBRL ?? 0) * t.lengthM, 0)
  const starts = sc.trechos.map((t) => t.plannedStartDate).filter(Boolean) as string[]
  const ends   = sc.trechos.map((t) => t.plannedEndDate).filter(Boolean) as string[]
  const startDate = starts.sort()[0] ?? '—'
  const endDate   = ends.sort().at(-1) ?? '—'
  const durationDays = starts.length && ends.length
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000)
    : 0
  return { totalMeters, totalCost, startDate, endDate, durationDays }
}

// ─── Scenario Card ─────────────────────────────────────────────────────────────

function ScenarioCard({
  sc, selected, comparing, onSelect, onCompare, onEdit, onDelete,
}: {
  sc: PlanScenario
  selected: boolean
  comparing: boolean
  onSelect: () => void
  onCompare: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { totalMeters, totalCost, startDate, endDate, durationDays } = scenarioStats(sc)
  return (
    <div
      className={`rounded-xl border p-4 cursor-pointer transition-all ${
        selected
          ? 'border-[#22c55e] bg-[#22c55e]/10'
          : comparing
          ? 'border-[#3b82f6] bg-[#3b82f6]/10'
          : 'border-[#525252] bg-[#333333] hover:border-[#1f3c5e]'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[#f5f5f5] text-sm font-semibold truncate">{sc.name}</p>
          {sc.description && <p className="text-[#6b6b6b] text-xs mt-0.5 truncate">{sc.description}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            title="Renomear"
            className="p-1.5 rounded-lg text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#525252] transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Excluir"
            className="p-1.5 rounded-lg text-[#6b6b6b] hover:text-[#f87171] hover:bg-[#525252] transition-colors"
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCompare() }}
            title="Comparar"
            className={`p-1.5 rounded-lg transition-colors ${
              comparing ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#525252]'
            }`}
          >
            <GitCompare size={13} />
          </button>
          {selected && <Check size={14} className="text-[#22c55e] ml-1" />}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Extensão</p>
          <p className="text-xs font-mono text-[#a3a3a3] mt-0.5">{totalMeters.toLocaleString('pt-BR')} m</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Custo Est.</p>
          <p className="text-xs font-mono text-[#a3a3a3] mt-0.5">{totalCost > 0 ? fmtBRL(totalCost) : '—'}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Duração</p>
          <p className="text-xs font-mono text-[#a3a3a3] mt-0.5">{durationDays > 0 ? `${durationDays}d` : '—'}</p>
        </div>
      </div>

      {startDate !== '—' && (
        <p className="text-[9px] text-[#3f3f3f] mt-2 font-mono">
          {startDate} → {endDate}
        </p>
      )}
    </div>
  )
}

// ─── Comparison Panel ──────────────────────────────────────────────────────────

function ComparePanel({ a, b }: { a: PlanScenario; b: PlanScenario }) {
  const statsA = scenarioStats(a)
  const statsB = scenarioStats(b)

  const rows = [
    { label: 'Extensão total',  aVal: `${statsA.totalMeters.toLocaleString('pt-BR')} m`, bVal: `${statsB.totalMeters.toLocaleString('pt-BR')} m` },
    { label: 'Custo estimado',  aVal: statsA.totalCost > 0 ? fmtBRL(statsA.totalCost) : '—', bVal: statsB.totalCost > 0 ? fmtBRL(statsB.totalCost) : '—' },
    { label: 'Duração (dias)',  aVal: statsA.durationDays > 0 ? `${statsA.durationDays}d` : '—', bVal: statsB.durationDays > 0 ? `${statsB.durationDays}d` : '—' },
    { label: 'Trechos',        aVal: String(a.trechos.length), bVal: String(b.trechos.length) },
    { label: 'Equipes',        aVal: String(a.teams.length), bVal: String(b.teams.length) },
    { label: 'Início previsto',aVal: statsA.startDate, bVal: statsB.startDate },
    { label: 'Fim previsto',   aVal: statsA.endDate, bVal: statsB.endDate },
  ]

  return (
    <div className="rounded-xl border border-[#525252] overflow-hidden mt-4">
      <div className="grid grid-cols-3 bg-[#2c2c2c] border-b border-[#525252]">
        <div className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#6b6b6b]">Métrica</div>
        <div className="px-4 py-2.5 text-[10px] font-semibold text-[#22c55e] border-l border-[#525252]">{a.name}</div>
        <div className="px-4 py-2.5 text-[10px] font-semibold text-[#3b82f6] border-l border-[#525252]">{b.name}</div>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-3 border-b border-[#3d3d3d] hover:bg-[#3d3d3d]">
          <div className="px-4 py-2 text-xs text-[#6b6b6b]">{row.label}</div>
          <div className="px-4 py-2 text-xs font-mono text-[#a3a3a3] border-l border-[#525252]">{row.aVal}</div>
          <div className={`px-4 py-2 text-xs font-mono border-l border-[#525252] ${row.aVal !== row.bVal ? 'text-[#f97316]' : 'text-[#a3a3a3]'}`}>
            {row.bVal}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Rename / New Scenario inline form ────────────────────────────────────────

function ScenarioNameForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { name: string; description?: string }
  onSave: (name: string, description: string) => void
  onCancel: () => void
}) {
  const [name, setName]     = useState(initial?.name ?? '')
  const [desc, setDesc]     = useState(initial?.description ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave(name.trim(), desc.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[#f97316]/40 bg-[#2c2c2c] p-4 flex flex-col gap-3">
      <p className="text-[#f5f5f5] text-xs font-semibold">
        {initial ? 'Renomear cenário' : 'Novo cenário'}
      </p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do cenário *"
        className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b] outline-none focus:border-[#f97316]/60 w-full"
        required
      />
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descrição (opcional)"
        className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b] outline-none focus:border-[#f97316]/60 w-full"
      />
      <div className="flex gap-2">
        <button type="submit" className="flex-1 flex items-center justify-center gap-1.5 bg-[#f97316] hover:bg-[#22a8c4] text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors">
          <Check size={12} /> Salvar
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs hover:border-[#6b6b6b] transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function ScenarioCompareModal({ onClose }: { onClose: () => void }) {
  const scenarios       = usePlanejamentoStore((s) => s.scenarios)
  const saveScenario    = usePlanejamentoStore((s) => s.saveScenario)
  const renameScenario  = usePlanejamentoStore((s) => s.renameScenario)
  const removeScenario  = usePlanejamentoStore((s) => s.removeScenario)

  const tasks      = useAgendaStore((s) => s.tasks)
  const updateTask = useAgendaStore((s) => s.updateTask)

  const [selectedId,  setSelectedId]  = useState<string | null>(scenarios[0]?.id ?? null)
  const [compareId,   setCompareId]   = useState<string | null>(null)
  const [applyStatus, setApplyStatus] = useState<'idle' | 'done'>('idle')

  // CRUD state
  const [showNewForm,   setShowNewForm]   = useState(false)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function handleApply() {
    if (!selectedId) return
    const scenario = scenarios.find((s) => s.id === selectedId)
    if (!scenario) return

    tasks.forEach((task) => {
      const match = scenario.trechos.find(
        (t) => task.title.includes(t.code) || task.title.toLowerCase().includes(t.description.toLowerCase())
      )
      if (match?.plannedStartDate && match?.plannedEndDate) {
        updateTask(task.id, {
          startDate: match.plannedStartDate,
          endDate: match.plannedEndDate,
          status: 'scheduled',
        })
      }
    })
    setApplyStatus('done')
    setTimeout(() => { setApplyStatus('idle'); onClose() }, 1200)
  }

  const compareScenario  = compareId  ? scenarios.find((s) => s.id === compareId)  : null
  const selectedScenario = selectedId ? scenarios.find((s) => s.id === selectedId) : null
  const editingScenario  = editingId  ? scenarios.find((s) => s.id === editingId)  : null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#525252] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#525252] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-[#f5f5f5] font-semibold text-sm">Cenários de Planejamento</h3>
            <p className="text-[#6b6b6b] text-xs mt-0.5">
              Selecione, crie ou edite cenários para comparar e aplicar à Agenda.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowNewForm(true); setEditingId(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30 text-[#f97316] text-xs font-semibold hover:bg-[#f97316]/25 transition-colors"
            >
              <Plus size={12} /> Novo Cenário
            </button>
            <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={18} /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* New scenario form */}
          {showNewForm && (
            <ScenarioNameForm
              onSave={(name, desc) => { saveScenario(name, desc); setShowNewForm(false) }}
              onCancel={() => setShowNewForm(false)}
            />
          )}

          {scenarios.length === 0 && !showNewForm && (
            <p className="text-center text-[#3f3f3f] text-xs py-12">
              Nenhum cenário salvo. Clique em "Novo Cenário" para criar um.
            </p>
          )}

          {scenarios.map((sc) => (
            <div key={sc.id}>
              {/* Rename form for this scenario */}
              {editingId === sc.id && editingScenario ? (
                <ScenarioNameForm
                  initial={{ name: editingScenario.name, description: editingScenario.description }}
                  onSave={(name, desc) => { renameScenario(sc.id, name, desc); setEditingId(null) }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <ScenarioCard
                  sc={sc}
                  selected={selectedId === sc.id}
                  comparing={compareId === sc.id}
                  onSelect={() => setSelectedId(sc.id)}
                  onCompare={() => setCompareId(compareId === sc.id ? null : sc.id)}
                  onEdit={() => { setEditingId(sc.id); setShowNewForm(false) }}
                  onDelete={() => setConfirmDelete(sc.id)}
                />
              )}
            </div>
          ))}

          {/* Comparison table */}
          {compareScenario && selectedScenario && selectedId !== compareId && (
            <ComparePanel a={selectedScenario} b={compareScenario} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#525252] flex items-center justify-between shrink-0">
          <p className="text-[#3f3f3f] text-xs">
            {applyStatus === 'done'
              ? '✓ Datas aplicadas à Agenda'
              : selectedScenario
              ? `"${selectedScenario.name}" selecionado — ${selectedScenario.trechos.length} trechos`
              : 'Nenhum cenário selecionado'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-[#3d3d3d] text-[#a3a3a3] text-xs hover:bg-[#525252]">
              Cancelar
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedId || applyStatus === 'done'}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#22c55e]/80 hover:bg-[#22c55e] disabled:opacity-40 transition-colors"
            >
              <Play size={11} className="fill-white" />
              Aplicar à Agenda
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete !== null && (() => {
        const sc = scenarios.find((s) => s.id === confirmDelete)
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
              <h4 className="text-[#f5f5f5] font-semibold mb-2">Confirmar Exclusão</h4>
              <p className="text-[#a3a3a3] text-sm mb-4">
                Excluir o cenário <span className="text-[#f97316] font-semibold">"{sc?.name}"</span>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] text-sm hover:border-[#6b6b6b] transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => { removeScenario(confirmDelete); setConfirmDelete(null); if (selectedId === confirmDelete) setSelectedId(null) }}
                  className="px-4 py-2 rounded-lg bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] text-sm hover:bg-[#ef4444]/30 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
