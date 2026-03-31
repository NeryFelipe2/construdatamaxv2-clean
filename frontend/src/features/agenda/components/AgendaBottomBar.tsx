import { ChevronUp, RefreshCw, BookOpen, Undo2, Redo2, RotateCcw, CheckCircle } from 'lucide-react'
import { useAgendaStore, getUnscheduledCount } from '@/store/agendaStore'

export function AgendaBottomBar() {
  const tasks = useAgendaStore((s) => s.tasks)
  const unscheduled = getUnscheduledCount(tasks)

  return (
    <div className="flex items-center gap-4 px-5 py-2.5 border-t border-[#20406a] bg-[#112645] shrink-0">
      {/* Unscheduled badge */}
      <button className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
        <span className="flex items-center justify-center w-5 h-5 rounded bg-[#20406a] font-mono text-[10px] font-bold text-[#f5f5f5]">
          {unscheduled}
        </span>
        <span>Não agendados</span>
        <ChevronUp size={12} />
      </button>

      <div className="h-4 w-px bg-[#20406a]" />

      {/* Actions */}
      <button className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
        <RefreshCw size={12} />
        Re-avaliar regras
      </button>

      <button className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
        <BookOpen size={12} />
        Changelog
      </button>

      <div className="h-4 w-px bg-[#20406a]" />

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

      <div className="h-4 w-px bg-[#20406a]" />

      <button className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
        <RotateCcw size={12} />
        Resetar
      </button>

      <div className="flex-1" />

      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] transition-colors">
        <CheckCircle size={13} />
        Revisar alterações
      </button>
    </div>
  )
}
