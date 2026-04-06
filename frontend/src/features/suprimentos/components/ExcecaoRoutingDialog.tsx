import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import type { MatchException } from '@/types'

const BUYERS = [
  'Ana Rodrigues',
  'Carlos Menezes',
  'Beatriz Lima',
  'Roberto Souza',
  'Fernanda Costa',
]

interface Props {
  exception: MatchException
  onClose: () => void
}

export function ExcecaoRoutingDialog({ exception, onClose }: Props) {
  const { updateException } = useSuprimentosStore(useShallow((s) => ({ updateException: s.updateException })))

  const [selected, setSelected] = useState<string[]>(exception.assignedTo)
  const [notes,    setNotes]     = useState(exception.notes ?? '')

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  function handleSend() {
    updateException(exception.id, {
      assignedTo: selected,
      notes:      notes.trim() || undefined,
      status:     exception.status === 'open' ? 'in_review' : exception.status,
    })
    onClose()
  }

  const typeLabels: Record<string, string> = {
    price_diff:    'Divergência de Preço',
    quantity_diff: 'Entrega Parcial',
    item_missing:  'Item Não Entregue',
    duplicate:     'Possível Duplicata',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div>
            <h2 className="text-[#f5f5f5] font-semibold">Rotear Exceção</h2>
            <p className="text-[#6b6b6b] text-xs mt-0.5">{typeLabels[exception.type] ?? exception.type}</p>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"><X size={16} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Description */}
          <div className="bg-[#484848] rounded-lg p-3 text-[#a3a3a3] text-xs leading-relaxed">
            {exception.description}
          </div>

          {/* Suggested action */}
          <div className="flex flex-col gap-1">
            <p className="text-[#a3a3a3] text-xs font-medium">Sugestão de ação</p>
            <p className="text-[#f97316] text-xs italic leading-relaxed">{exception.suggestedAction}</p>
          </div>

          {/* Assignees */}
          <div className="flex flex-col gap-2">
            <p className="text-[#f5f5f5] text-sm font-semibold">Responsáveis</p>
            <div className="flex flex-col gap-1.5">
              {BUYERS.map((name) => (
                <label key={name} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selected.includes(name)}
                    onChange={() => toggle(name)}
                    className="accent-[#f97316] w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[#f5f5f5] text-sm group-hover:text-[#f97316] transition-colors">{name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-[#a3a3a3] text-xs">Observações</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais para os responsáveis..."
              className="w-full bg-[#333333] border border-[#1f3c5e] rounded px-3 py-2 text-[#f5f5f5] text-sm focus:outline-none focus:border-[#f97316] resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[#1f3c5e] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555] transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={selected.length === 0}
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#f97316] hover:bg-[#ea6c0a] text-white transition-colors disabled:bg-[#525252] disabled:text-[#6b6b6b] disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send size={14} />
              Enviar Alerta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
