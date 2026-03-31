/**
 * ScenarioCompareModal — lists saved Planejamento scenarios,
 * allows applying one to the Agenda (imports dates) or comparing two side-by-side.
 */
import { useState } from 'react'
import { X, Check, GitCompare, Play } from 'lucide-react'
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
  sc, selected, comparing, onSelect, onCompare,
}: {
  sc: PlanScenario
  selected: boolean
  comparing: boolean
  onSelect: () => void
  onCompare: () => void
}) {
  const { totalMeters, totalCost, startDate, endDate, durationDays } = scenarioStats(sc)
  return (
    <div
      className={`rounded-xl border p-4 cursor-pointer transition-all ${
        selected
          ? 'border-[#22c55e] bg-[#22c55e]/10'
          : comparing
          ? 'border-[#3b82f6] bg-[#3b82f6]/10'
          : 'border-[#20406a] bg-[#112645] hover:border-[#1f3c5e]'
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
            onClick={(e) => { e.stopPropagation(); onCompare() }}
            title="Comparar"
            className={`p-1.5 rounded-lg transition-colors ${
              comparing ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#20406a]'
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
    { label: 'Trechos',         aVal: String(a.trechos.length), bVal: String(b.trechos.length) },
    { label: 'Equipes',         aVal: String(a.teams.length), bVal: String(b.teams.length) },
    { label: 'Início previsto', aVal: statsA.startDate, bVal: statsB.startDate },
    { label: 'Fim previsto',    aVal: statsA.endDate, bVal: statsB.endDate },
  ]

  return (
    <div className="rounded-xl border border-[#20406a] overflow-hidden mt-4">
      <div className="grid grid-cols-3 bg-[#0d2040] border-b border-[#20406a]">
        <div className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#6b6b6b]">Métrica</div>
        <div className="px-4 py-2.5 text-[10px] font-semibold text-[#22c55e] border-l border-[#20406a]">{a.name}</div>
        <div className="px-4 py-2.5 text-[10px] font-semibold text-[#3b82f6] border-l border-[#20406a]">{b.name}</div>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-3 border-b border-[#1e1e1e] hover:bg-[#1e1e1e]">
          <div className="px-4 py-2 text-xs text-[#6b6b6b]">{row.label}</div>
          <div className="px-4 py-2 text-xs font-mono text-[#a3a3a3] border-l border-[#20406a]">{row.aVal}</div>
          <div className={`px-4 py-2 text-xs font-mono border-l border-[#20406a] ${row.aVal !== row.bVal ? 'text-[#2abfdc]' : 'text-[#a3a3a3]'}`}>
            {row.bVal}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function ScenarioCompareModal({ onClose }: { onClose: () => void }) {
  const scenarios    = usePlanejamentoStore((s) => s.scenarios)
  const tasks        = useAgendaStore((s) => s.tasks)
  const updateTask   = useAgendaStore((s) => s.updateTask)

  const [selectedId,  setSelectedId]  = useState<string | null>(scenarios[0]?.id ?? null)
  const [compareId,   setCompareId]   = useState<string | null>(null)
  const [applyStatus, setApplyStatus] = useState<'idle' | 'done'>('idle')

  function handleApply() {
    if (!selectedId) return
    const scenario = scenarios.find((s) => s.id === selectedId)
    if (!scenario) return

    // Match agenda tasks by title containing trecho code or description
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

  const compareScenario = compareId ? scenarios.find((s) => s.id === compareId) : null
  const selectedScenario = selectedId ? scenarios.find((s) => s.id === selectedId) : null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#20406a] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#20406a] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-[#f5f5f5] font-semibold text-sm">Cenários de Planejamento</h3>
            <p className="text-[#6b6b6b] text-xs mt-0.5">
              Selecione um cenário para aplicar às datas da Agenda, ou compare dois cenários.
            </p>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={18} /></button>
        </div>

        {/* Scenario list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {scenarios.length === 0 && (
            <p className="text-center text-[#3f3f3f] text-xs py-12">
              Nenhum cenário salvo. Vá até Planejamento → Cenários para criar um.
            </p>
          )}
          {scenarios.map((sc) => (
            <ScenarioCard
              key={sc.id}
              sc={sc}
              selected={selectedId === sc.id}
              comparing={compareId === sc.id}
              onSelect={() => setSelectedId(sc.id)}
              onCompare={() => setCompareId(compareId === sc.id ? null : sc.id)}
            />
          ))}

          {/* Comparison table */}
          {compareScenario && selectedScenario && selectedId !== compareId && (
            <ComparePanel a={selectedScenario} b={compareScenario} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#20406a] flex items-center justify-between shrink-0">
          <p className="text-[#3f3f3f] text-xs">
            {applyStatus === 'done'
              ? '✓ Datas aplicadas à Agenda'
              : selectedScenario
              ? `"${selectedScenario.name}" selecionado — ${selectedScenario.trechos.length} trechos`
              : 'Nenhum cenário selecionado'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-[#1e1e1e] text-[#a3a3a3] text-xs hover:bg-[#20406a]">
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
    </div>
  )
}
