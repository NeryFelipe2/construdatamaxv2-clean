import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useShallow } from 'zustand/react/shallow'
import type { Requisition, RequisitionStatus } from '@/types'
import { ChevronRight, Plus } from 'lucide-react'

// ─── Column config ─────────────────────────────────────────────────────────────

const COLUMNS: { status: RequisitionStatus; label: string; color: string; bg: string }[] = [
  { status: 'submitted',       label: 'Submetida',           color: 'text-gray-400',   bg: 'bg-gray-800/60'  },
  { status: 'parsing',         label: 'Extração de Dados',   color: 'text-blue-400',   bg: 'bg-blue-900/20'  },
  { status: 'ontology_matched',label: 'Mapeamento Ontologia', color: 'text-purple-400', bg: 'bg-purple-900/20'},
  { status: 'proposals',       label: 'Propostas IA',        color: 'text-amber-400',  bg: 'bg-amber-900/20' },
  { status: 'ordered',         label: 'Pedido Colocado',     color: 'text-green-400',  bg: 'bg-green-900/20' },
]

const CATEGORY_COLORS: Record<string, string> = {
  'Cimento e Argamassa': 'bg-orange-500/20 text-orange-300',
  'Aço / Vergalhão':     'bg-blue-500/20 text-blue-300',
  'Concreto Usinado':    'bg-yellow-500/20 text-yellow-300',
  'Tubulação e Saneamento': 'bg-cyan-500/20 text-cyan-300',
  'Impermeabilização':   'bg-pink-500/20 text-pink-300',
}

// ─── Nova Requisição form ──────────────────────────────────────────────────────

interface NewReqFormProps {
  onSubmit: (req: Requisition) => void
  onCancel: () => void
}

function NewReqForm({ onSubmit, onCancel }: NewReqFormProps) {
  const [material, setMaterial]   = useState('')
  const [category, setCategory]   = useState('Cimento e Argamassa')
  const [quantity, setQuantity]   = useState('')
  const [unit, setUnit]           = useState('sc')
  const [requestedBy, setRequestedBy] = useState('')
  const [projectRef, setProjectRef]   = useState('PRJ-001')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!material.trim() || !requestedBy.trim() || !quantity) return
    const now = new Date().toISOString()
    onSubmit({
      id:          `req-${Date.now()}`,
      code:        `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
      material:    material.trim(),
      category,
      quantity:    parseFloat(quantity),
      unit,
      requestedBy: requestedBy.trim(),
      projectRef,
      requestedAt: now,
      status:      'submitted',
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800 border border-gray-600 rounded-lg p-3 flex flex-col gap-2 text-xs"
    >
      <input
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 outline-none focus:border-[#2abfdc]"
        placeholder="Material *"
        value={material}
        onChange={(e) => setMaterial(e.target.value)}
        required
      />
      <select
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200 outline-none focus:border-[#2abfdc]"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {Object.keys(CATEGORY_COLORS).map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
        <option value="Outros">Outros</option>
      </select>
      <div className="flex gap-1.5">
        <input
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 outline-none focus:border-[#2abfdc] w-20"
          placeholder="Qtd *"
          type="number"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <input
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 outline-none focus:border-[#2abfdc] flex-1"
          placeholder="Un (sc, kg…)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>
      <input
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 outline-none focus:border-[#2abfdc]"
        placeholder="Solicitante *"
        value={requestedBy}
        onChange={(e) => setRequestedBy(e.target.value)}
        required
      />
      <input
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 outline-none focus:border-[#2abfdc]"
        placeholder="Projeto (PRJ-001)"
        value={projectRef}
        onChange={(e) => setProjectRef(e.target.value)}
      />
      <div className="flex gap-1.5 mt-1">
        <button
          type="submit"
          className="flex-1 bg-[#2abfdc] hover:bg-[#22a8c4] text-white rounded px-2 py-1.5 font-medium transition-colors"
        >
          Submeter
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Kanban card ───────────────────────────────────────────────────────────────

interface CardProps {
  req: Requisition
  isLast: boolean
  onAdvance: () => void
}

function ReqCard({ req, isLast, onAdvance }: CardProps) {
  const catColor = CATEGORY_COLORS[req.category] ?? 'bg-gray-700/50 text-gray-300'
  const date = new Date(req.requestedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex flex-col gap-2 text-xs">
      {/* Material + category */}
      <div>
        <p className="text-gray-100 font-medium leading-snug">{req.material}</p>
        <span className={cn('inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium', catColor)}>
          {req.category}
        </span>
      </div>

      {/* Quantity */}
      <p className="text-gray-300 tabular-nums">
        {req.quantity.toLocaleString('pt-BR')} {req.unit}
      </p>

      {/* Meta */}
      <div className="text-gray-500 space-y-0.5">
        <p>{req.requestedBy}</p>
        <p>{req.projectRef} · {date}</p>
      </div>

      {/* Ontology match */}
      {req.ontologyMatch && (
        <p className="text-purple-400 text-[10px] bg-purple-900/20 rounded px-1.5 py-0.5 font-mono">
          {req.ontologyMatch}
        </p>
      )}

      {/* Suggested suppliers */}
      {req.suggestedSuppliers && req.suggestedSuppliers.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {req.suggestedSuppliers.map((s) => (
            <span
              key={s}
              className="text-[10px] text-amber-300 bg-amber-900/20 px-1.5 py-0.5 rounded"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Linked PO */}
      {req.linkedPoId && (
        <span className="text-[10px] text-green-300 bg-green-900/20 px-1.5 py-0.5 rounded">
          OC: {req.linkedPoId}
        </span>
      )}

      {/* Code */}
      <p className="text-gray-600 text-[10px] font-mono">{req.code}</p>

      {/* Advance button */}
      {!isLast && (
        <button
          onClick={onAdvance}
          className="mt-1 flex items-center justify-center gap-1 px-2 py-1 rounded border border-[#2abfdc]/40 text-[#2abfdc] hover:bg-[#2abfdc]/10 transition-colors font-medium"
        >
          <ChevronRight size={11} />
          Avançar
        </button>
      )}
    </div>
  )
}

// ─── Pipeline ──────────────────────────────────────────────────────────────────

export function RequisicoesPipeline() {
  const { requisitions, addRequisition, advanceRequisitionStatus } =
    useSuprimentosStore(
      useShallow((s) => ({
        requisitions:             s.requisitions,
        addRequisition:           s.addRequisition,
        advanceRequisitionStatus: s.advanceRequisitionStatus,
      }))
    )

  const [showNewForm, setShowNewForm] = useState(false)

  return (
    <div className="flex-1 min-h-0 overflow-x-auto">
      <div className="flex gap-3 h-full min-w-[900px] pb-2">
        {COLUMNS.map((col, colIdx) => {
          const cards = requisitions.filter((r) => r.status === col.status)
          const isLastCol = colIdx === COLUMNS.length - 1

          return (
            <div key={col.status} className={cn('flex flex-col flex-1 min-w-[170px] rounded-xl border border-gray-700/60', col.bg)}>
              {/* Column header */}
              <div className={cn('px-3 pt-3 pb-2 flex items-center justify-between')}>
                <span className={cn('text-[11px] font-semibold uppercase tracking-wide', col.color)}>
                  {col.label}
                </span>
                <span className="text-[10px] bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded-full tabular-nums">
                  {cards.length}
                </span>
              </div>

              {/* Cards scroll area */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-2">
                {/* Nova Requisição — only on first column */}
                {col.status === 'submitted' && (
                  showNewForm ? (
                    <NewReqForm
                      onSubmit={(req) => { addRequisition(req); setShowNewForm(false) }}
                      onCancel={() => setShowNewForm(false)}
                    />
                  ) : (
                    <button
                      onClick={() => setShowNewForm(true)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#2abfdc] transition-colors py-1"
                    >
                      <Plus size={13} />
                      Nova Requisição
                    </button>
                  )
                )}

                {cards.map((req) => (
                  <ReqCard
                    key={req.id}
                    req={req}
                    isLast={isLastCol}
                    onAdvance={() => advanceRequisitionStatus(req.id)}
                  />
                ))}

                {cards.length === 0 && !showNewForm && (
                  <p className="text-gray-600 text-xs text-center py-4">—</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
