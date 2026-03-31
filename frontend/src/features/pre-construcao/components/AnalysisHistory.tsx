import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { usePreConstrucaoStore } from '@/store/preConstrucaoStore'
import type { PipelineStep } from '@/types'

const STATUS_LABELS: Record<PipelineStep, string> = {
  upload:        'Rascunho',
  extraction:    'Extração',
  normalization: 'Normalização',
  matching:      'Matching',
  proposal:      'Proposta',
}

const STATUS_COLORS: Record<PipelineStep, string> = {
  upload:        'bg-[#1f3c5e] text-[#a3a3a3]',
  extraction:    'bg-[#2563eb]/20 text-[#93c5fd]',
  normalization: 'bg-[#ca8a04]/20 text-[#fbbf24]',
  matching:      'bg-[#7c3aed]/20 text-[#c4b5fd]',
  proposal:      'bg-[#16a34a]/20 text-[#4ade80]',
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function AnalysisHistory() {
  const { sessions, resetPipeline } = usePreConstrucaoStore(useShallow((s) => ({
    sessions:       s.sessions,
    resetPipeline:  s.resetPipeline,
  })))

  return (
    <div className="w-56 shrink-0 flex flex-col bg-[#112645] border-r border-[#20406a] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#20406a]">
        <button
          onClick={resetPipeline}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#2abfdc] hover:bg-[#ea6c0a] text-white text-xs font-semibold transition-colors"
        >
          <Plus size={12} />
          Nova Análise
        </button>
      </div>

      {/* Title */}
      <div className="px-4 py-2">
        <p className="text-[#6b6b6b] text-[10px] font-medium uppercase tracking-wider">
          Histórico
        </p>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col gap-2">
        {sessions.length === 0 ? (
          <p className="text-[#6b6b6b] text-xs text-center py-6 px-2">
            Nenhuma análise anterior
          </p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg p-3 flex flex-col gap-1.5 hover:border-[#1f3c5e] transition-colors"
            >
              {/* Date */}
              <p className="text-[#f5f5f5] text-[11px] font-semibold">
                {new Date(session.createdAt).toLocaleDateString('pt-BR')}
              </p>

              {/* Files */}
              <p className="text-[#6b6b6b] text-[10px] leading-tight truncate">
                {session.fileNames.length} {session.fileNames.length === 1 ? 'arquivo' : 'arquivos'}{' '}
                {session.fileNames[0] && (
                  <span className="text-[#a3a3a3]">— {session.fileNames[0]}</span>
                )}
              </p>

              {/* Items count */}
              <p className="text-[#a3a3a3] text-[10px]">
                {session.totalItems} itens
              </p>

              {/* Total cost */}
              <p className="text-[#2abfdc] text-xs font-bold tabular-nums">
                {formatBRL(session.totalCost)}
              </p>

              {/* Status badge */}
              <span
                className={cn(
                  'self-start px-2 py-0.5 rounded text-[9px] font-semibold',
                  STATUS_COLORS[session.status],
                )}
              >
                {STATUS_LABELS[session.status]}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
