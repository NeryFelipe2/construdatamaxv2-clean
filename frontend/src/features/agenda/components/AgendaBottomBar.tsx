import { useState } from 'react'
import { ChevronUp, ChevronDown, RefreshCw, BookOpen, Undo2, Redo2, RotateCcw, CheckCircle } from 'lucide-react'
import { useAgendaStore, getUnscheduledCount } from '@/store/agendaStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'

export function AgendaBottomBar() {
  const tasks = useAgendaStore((s) => s.tasks)
  const unscheduled = getUnscheduledCount(tasks)
  const runSchedule = usePlanejamentoStore((s) => s.runSchedule)
  const [showUnscheduled, setShowUnscheduled] = useState(false)

  const unscheduledTasks = tasks.filter((t) => t.status === 'unscheduled')

  return (
    <div className="relative flex items-center gap-4 px-5 py-2.5 border-t border-[#525252] bg-[#333333] shrink-0">
      {/* Unscheduled badge */}
      <button
        onClick={() => setShowUnscheduled((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded bg-[#525252] font-mono text-[10px] font-bold text-[#f5f5f5]">
          {unscheduled}
        </span>
        <span>Não agendados</span>
        {showUnscheduled ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {showUnscheduled && (
        <div className="absolute bottom-full left-5 mb-1 w-64 max-h-64 overflow-y-auto rounded-lg border border-[#525252] bg-[#2c2c2c] shadow-lg z-20">
          {unscheduledTasks.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#6b6b6b]">Nenhuma tarefa não agendada</div>
          ) : (
            unscheduledTasks.map((t) => (
              <div key={t.id} className="px-3 py-2 text-xs text-[#f5f5f5] border-b border-[#3a3a3a] last:border-b-0">
                {t.title}
              </div>
            ))
          )}
        </div>
      )}

      <div className="h-4 w-px bg-[#525252]" />

      {/* Actions */}
      <button
        onClick={() => runSchedule()}
        className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
      >
        <RefreshCw size={12} />
        Re-avaliar regras
      </button>

      <button
        disabled
        title="Changelog indisponível nesta versão"
        className="flex items-center gap-1.5 text-xs text-[#3f3f3f] cursor-not-allowed"
      >
        <BookOpen size={12} />
        Changelog
      </button>

      <div className="h-4 w-px bg-[#525252]" />

      {/* Undo / Redo (visual only — full undo history is a future feature) */}
      <div className="flex items-center gap-1">
        <button
          disabled
          className="flex items-center justify-center w-6 h-6 rounded text-[#3f3f3f] cursor-not-allowed"
          title="Desfazer"
        >
          <Undo2 size={13} />
        </button>
        <button
          disabled
          className="flex items-center justify-center w-6 h-6 rounded text-[#3f3f3f] cursor-not-allowed"
          title="Refazer"
        >
          <Redo2 size={13} />
        </button>
      </div>

      <div className="h-4 w-px bg-[#525252]" />

      <button
        onClick={() => useAgendaStore.getState().loadDemoData()}
        className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
      >
        <RotateCcw size={12} />
        Resetar
      </button>

      <div className="flex-1" />

      <button
        disabled
        title="Revisão de alterações indisponível nesta versão"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#525252] text-[#8a8a8a] text-xs font-semibold cursor-not-allowed"
      >
        <CheckCircle size={13} />
        Revisar alterações
      </button>
    </div>
  )
}
