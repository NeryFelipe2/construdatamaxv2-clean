import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { usePreConstrucaoStore } from '@/store/preConstrucaoStore'
import type { ClauseSeverity } from '@/types'

// Inline editable cell (shared with ComposicaoPanel pattern)
function EditCell({ value, onSave, type = 'text' }: {
  value: string | number
  onSave: (v: string | number) => void
  type?: 'text' | 'number'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(String(value))

  function commit() {
    const v = type === 'number' ? parseFloat(draft) || 0 : draft
    onSave(v)
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(String(value)); setEditing(true) }}
        className="cursor-pointer hover:text-orange-400 transition-colors"
        title="Clique para editar"
      >
        {value}
      </span>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-[#525252] border border-[#f97316]/50 rounded px-1.5 py-0.5 text-xs text-[#f5f5f5] focus:outline-none"
      />
      <button onClick={commit} className="text-[#4ade80] hover:text-emerald-300 p-0.5"><Check size={11} /></button>
      <button onClick={() => setEditing(false)} className="text-[#6b6b6b] hover:text-[#a3a3a3] p-0.5"><X size={11} /></button>
    </div>
  )
}

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 80 ? 'bg-[#16a34a]/20 text-[#4ade80]' :
    value >= 60 ? 'bg-[#ca8a04]/20 text-[#fbbf24]' :
                  'bg-[#dc2626]/20 text-[#f87171]'
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-semibold', color)}>
      {value}%
    </span>
  )
}

function SeverityBadge({ severity }: { severity: ClauseSeverity }) {
  if (severity === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#dc2626]/20 text-[#f87171]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] inline-block" />
        Crítico
      </span>
    )
  }
  if (severity === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#ca8a04]/20 text-[#fbbf24]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] inline-block" />
        Atenção
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#2563eb]/20 text-[#93c5fd]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] inline-block" />
      Info
    </span>
  )
}

export function ExtractionView() {
  const [clausesOpen, setClausesOpen] = useState(true)

  const { takeoffItems, clauses, setStep, addTakeoffItem, updateTakeoffItem, removeTakeoffItem } =
    usePreConstrucaoStore(useShallow((s) => ({
      takeoffItems:      s.takeoffItems,
      clauses:           s.clauses,
      setStep:           s.setStep,
      addTakeoffItem:    s.addTakeoffItem,
      updateTakeoffItem: s.updateTakeoffItem,
      removeTakeoffItem: s.removeTakeoffItem,
    })))

  return (
    <div className="flex gap-4 h-full">
      {/* LEFT — Takeoff items table */}
      <div className="flex flex-col flex-1 min-w-0 bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252]">
          <h2 className="text-[#f5f5f5] font-semibold text-sm">Itens Extraídos</h2>
          <div className="flex items-center gap-2">
            {takeoffItems.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#f97316]/20 text-[#f97316] text-xs font-semibold">
                {takeoffItems.length} itens
              </span>
            )}
            <button
              onClick={addTakeoffItem}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#f97316]/20 hover:bg-[#f97316]/30 text-[#f97316] text-xs transition-colors"
            >
              <Plus size={11} /> Adicionar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto overflow-x-auto">
          {takeoffItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[#6b6b6b] text-sm">
              Nenhum item extraído ainda
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#484848]">
                  <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-10">#</th>
                  <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Descrição</th>
                  <th className="text-right text-[#6b6b6b] text-xs font-medium px-3 py-2">Quantidade</th>
                  <th className="text-left  text-[#6b6b6b] text-xs font-medium px-3 py-2">Unidade</th>
                  <th className="text-center text-[#6b6b6b] text-xs font-medium px-3 py-2">Confiança</th>
                  <th className="text-left  text-[#6b6b6b] text-xs font-medium px-3 py-2">Arquivo</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {takeoffItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#525252] hover:bg-[#484848] transition-colors group"
                  >
                    <td className="px-3 py-2 text-[#6b6b6b] text-xs">{idx + 1}</td>
                    <td className="px-3 py-2 text-[#f5f5f5]">
                      <EditCell value={item.description} onSave={(v) => updateTakeoffItem(item.id, { description: String(v) })} />
                    </td>
                    <td className="px-3 py-2 text-[#f5f5f5] text-right tabular-nums">
                      <EditCell value={item.quantity} onSave={(v) => updateTakeoffItem(item.id, { quantity: Number(v) })} type="number" />
                    </td>
                    <td className="px-3 py-2 text-[#a3a3a3]">
                      <EditCell value={item.unit} onSave={(v) => updateTakeoffItem(item.id, { unit: String(v) })} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ConfidenceBadge value={item.confidence} />
                    </td>
                    <td className="px-3 py-2 text-[#6b6b6b] text-xs truncate max-w-[120px]">
                      {item.source}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeTakeoffItem(item.id)}
                        className="p-1 text-[#1f3c5e] hover:text-[#f87171] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#525252] flex gap-2">
          <button
            onClick={() => setStep('upload')}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-[#1f3c5e] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555] transition-colors shrink-0"
          >
            ← Voltar
          </button>
          <button
            onClick={() => setStep('normalization')}
            disabled={takeoffItems.length === 0}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
              takeoffItems.length > 0
                ? 'bg-[#f97316] hover:bg-[#ea6c0a] text-white'
                : 'bg-[#525252] text-[#6b6b6b] cursor-not-allowed',
            )}
          >
            Avançar → Normalização
          </button>
        </div>
      </div>

      {/* RIGHT — Contract clauses */}
      <div className="w-80 shrink-0 flex flex-col bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
        <button
          onClick={() => setClausesOpen((v) => !v)}
          className="flex items-center justify-between px-4 py-3 border-b border-[#525252] hover:bg-[#484848] transition-colors"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[#f5f5f5] font-semibold text-sm">Cláusulas de Risco</h2>
            {clauses.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#dc2626]/20 text-[#f87171] text-xs font-semibold">
                {clauses.length}
              </span>
            )}
          </div>
          {clausesOpen ? (
            <ChevronUp size={14} className="text-[#6b6b6b]" />
          ) : (
            <ChevronDown size={14} className="text-[#6b6b6b]" />
          )}
        </button>

        {clausesOpen && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {clauses.length === 0 ? (
              <p className="text-[#6b6b6b] text-sm text-center py-6">
                Nenhuma cláusula de risco identificada
              </p>
            ) : (
              clauses.map((clause) => (
                <div
                  key={clause.id}
                  className="bg-[#484848] border border-[#525252] rounded-lg p-3 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <SeverityBadge severity={clause.severity} />
                  </div>
                  <p className="text-[#f5f5f5] text-xs font-bold">{clause.type}</p>
                  {clause.excerpt && (
                    <p className="text-[#a3a3a3] text-[10px] font-mono bg-[#333333] rounded px-2 py-1 break-words">
                      "{clause.excerpt}"
                    </p>
                  )}
                  <p className="text-[#a3a3a3] text-xs leading-relaxed">{clause.explanation}</p>
                  <p className="text-[#f97316] text-xs italic leading-relaxed">
                    {clause.recommendation}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
