import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { RefreshCw, Check, X, Plus } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { OcorrenciaDialog } from './dialogs/OcorrenciaDialog'
import type { ReallocationSuggestion, LaborOccurrence } from '@/types'
import { cn } from '@/lib/utils'

// ─── Occurrence type labels & colors ─────────────────────────────────────────

const OCC_META: Record<import('@/types').OccurrenceType, { label: string; color: string }> = {
  weather:           { label: 'Clima',             color: '#3b82f6' },
  material_delay:    { label: 'Atraso Material',   color: '#f59e0b' },
  equipment_failure: { label: 'Falha Equipamento', color: '#ef4444' },
  holiday:           { label: 'Feriado',           color: '#8b5cf6' },
  accident:          { label: 'Acidente',          color: '#ef4444' },
  other:             { label: 'Outro',             color: '#6b7280' },
}

function OccTypeBadge({ type }: { type: import('@/types').OccurrenceType }) {
  const meta = OCC_META[type]
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
    >
      {meta.label}
    </span>
  )
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

function SuggestionCard({
  s,
  onAccept,
  onDismiss,
}: {
  s: ReallocationSuggestion
  onAccept: () => void
  onDismiss: () => void
}) {
  const acted = s.accepted === true || s.accepted === false

  return (
    <div
      className={cn(
        'bg-[#14294e] border rounded-xl p-4',
        s.accepted === true  ? 'border-[#22c55e]/40' :
        s.accepted === false ? 'border-[#20406a] opacity-50' :
                               'border-[#2abfdc]/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#ef4444]/15 text-[#ef4444]">
              Crítico — {s.delayDays}d atraso
            </span>
            <span className="text-[#f5f5f5] text-sm font-semibold truncate">{s.delayedTaskName}</span>
          </div>

          <p className="text-[#6b6b6b] text-xs mt-2 leading-relaxed">{s.reason}</p>

          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            <span className="text-[#6b6b6b]">
              Equipe sugerida: <span className="text-[#f5f5f5]">{s.sourceCrew}</span>
            </span>
            <span className="text-[#6b6b6b]">
              Tarefa fonte: <span className="text-[#f5f5f5]">{s.sourceTaskName}</span>
            </span>
            <span className="text-[#6b6b6b]">
              Folga: <span className="text-[#22c55e] font-semibold">{s.sourceTaskFloat}d</span>
            </span>
          </div>
        </div>

        {!acted && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={onAccept}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#22c55e]/15 text-[#22c55e] text-xs font-semibold hover:bg-[#22c55e]/25 transition-colors"
            >
              <Check size={12} /> Aceitar
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#20406a] text-[#6b6b6b] text-xs font-semibold hover:bg-[#333] transition-colors"
            >
              <X size={12} /> Dispensar
            </button>
          </div>
        )}

        {s.accepted === true && (
          <span className="flex items-center gap-1 text-xs font-semibold text-[#22c55e] shrink-0">
            <Check size={13} /> Aceito
          </span>
        )}
        {s.accepted === false && (
          <span className="flex items-center gap-1 text-xs font-semibold text-[#6b6b6b] shrink-0">
            <X size={13} /> Dispensado
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Occurrence Row ───────────────────────────────────────────────────────────

function OccurrenceRow({
  occ,
  crews,
}: {
  occ: LaborOccurrence
  crews: import('@/types').LaborCrew[]
}) {
  const crewNames = occ.affectedCrewIds
    .map((id) => crews.find((c) => c.id === id)?.name ?? id)
    .join(', ')

  return (
    <tr className="border-b border-[#1e1e1e] last:border-0">
      <td className="py-2 text-[#6b6b6b] text-xs shrink-0">
        {new Date(occ.date + 'T00:00:00').toLocaleDateString('pt-BR')}
      </td>
      <td className="py-2"><OccTypeBadge type={occ.type} /></td>
      <td className="py-2 text-[#f5f5f5] text-xs max-w-[240px] truncate">{occ.description}</td>
      <td className="py-2 text-right text-[#f5f5f5] text-xs font-semibold">{occ.impactHours}h</td>
      <td className="py-2 text-[#6b6b6b] text-xs hidden md:table-cell">{crewNames}</td>
    </tr>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function EscalamentoPanel() {
  const [isOcorrenciaOpen, setIsOcorrenciaOpen] = useState(false)

  const { suggestions, occurrences, crews, runReallocationEngine, acceptSuggestion, dismissSuggestion } =
    useMaoDeObraStore(
      useShallow((s) => ({
        suggestions:          s.suggestions,
        occurrences:          s.occurrences,
        crews:                s.crews,
        runReallocationEngine: s.runReallocationEngine,
        acceptSuggestion:     s.acceptSuggestion,
        dismissSuggestion:    s.dismissSuggestion,
      }))
    )

  const pending  = suggestions.filter((s) => s.accepted === undefined)
  const resolved = suggestions.filter((s) => s.accepted !== undefined)

  return (
    <div className="flex flex-col gap-4">
      {/* Reallocation engine */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[#f5f5f5] text-sm font-semibold">Sugestões de Realocação</p>
            <p className="text-[#6b6b6b] text-xs mt-0.5">
              {pending.length} pendente{pending.length !== 1 ? 's' : ''}
              {resolved.length > 0 && ` · ${resolved.length} resolvida${resolved.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={runReallocationEngine}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-xs font-medium hover:bg-[#1a3662] transition-colors"
          >
            <RefreshCw size={13} />
            Rodar Engine
          </button>
        </div>

        {suggestions.length === 0 ? (
          <p className="text-[#6b6b6b] text-sm">Nenhuma sugestão. Clique em "Rodar Engine" para analisar o cronograma.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onAccept={() => acceptSuggestion(s.id)}
                onDismiss={() => dismissSuggestion(s.id)}
              />
            ))}
            {resolved.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onAccept={() => acceptSuggestion(s.id)}
                onDismiss={() => dismissSuggestion(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Occurrence log */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#f5f5f5] text-sm font-semibold">
            Registro de Ocorrências ({occurrences.length})
          </p>
          <button
            onClick={() => setIsOcorrenciaOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc] hover:bg-[#ea6c0a] text-white text-xs font-semibold transition-colors"
          >
            <Plus size={13} />
            Registrar
          </button>
        </div>

        {occurrences.length === 0 ? (
          <p className="text-[#6b6b6b] text-sm">Nenhuma ocorrência registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#20406a]">
                  <th className="text-left text-[#6b6b6b] font-medium pb-2">Data</th>
                  <th className="text-left text-[#6b6b6b] font-medium pb-2">Tipo</th>
                  <th className="text-left text-[#6b6b6b] font-medium pb-2">Descrição</th>
                  <th className="text-right text-[#6b6b6b] font-medium pb-2">Impacto</th>
                  <th className="text-left text-[#6b6b6b] font-medium pb-2 hidden md:table-cell">Equipes</th>
                </tr>
              </thead>
              <tbody>
                {[...occurrences]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((occ) => (
                    <OccurrenceRow key={occ.id} occ={occ} crews={crews} />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isOcorrenciaOpen && <OcorrenciaDialog onClose={() => setIsOcorrenciaOpen(false)} />}
    </div>
  )
}
