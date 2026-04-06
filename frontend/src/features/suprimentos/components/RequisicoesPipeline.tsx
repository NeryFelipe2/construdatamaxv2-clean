import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useShallow } from 'zustand/react/shallow'
import type { Requisition, RequisitionStatus } from '@/types'
import { ChevronRight, Plus, Pencil, X, Check } from 'lucide-react'

// ─── Column config ─────────────────────────────────────────────────────────────

const COLUMNS: { status: RequisitionStatus; label: string; color: string; bg: string }[] = [
  { status: 'submitted',        label: 'Submetida',            color: 'text-[#a3a3a3]',   bg: 'bg-[#3d3d3d]/60'  },
  { status: 'parsing',          label: 'Extração de Dados',    color: 'text-blue-400',   bg: 'bg-blue-900/20'  },
  { status: 'ontology_matched', label: 'Mapeamento Ontologia', color: 'text-purple-400', bg: 'bg-purple-900/20'},
  { status: 'proposals',        label: 'Propostas IA',         color: 'text-amber-400',  bg: 'bg-amber-900/20' },
  { status: 'ordered',          label: 'Pedido Colocado',      color: 'text-green-400',  bg: 'bg-green-900/20' },
]

const CATEGORY_OPTIONS = [
  'Cimento e Argamassa',
  'Aço / Vergalhão',
  'Concreto Usinado',
  'Tubulação e Saneamento',
  'Impermeabilização',
  'Outros',
]

const CATEGORY_COLORS: Record<string, string> = {
  'Cimento e Argamassa':     'bg-orange-500/20 text-orange-300',
  'Aço / Vergalhão':         'bg-blue-500/20 text-blue-300',
  'Concreto Usinado':        'bg-yellow-500/20 text-yellow-300',
  'Tubulação e Saneamento':  'bg-[#f97316]/20 text-[#f97316]',
  'Impermeabilização':       'bg-pink-500/20 text-pink-300',
}

// ─── Shared field styles ───────────────────────────────────────────────────────

const INPUT = 'bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-[#f5f5f5] placeholder-[#6b6b6b] outline-none focus:border-[#f97316] text-xs w-full'
const SELECT = 'bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-[#f5f5f5] outline-none focus:border-[#f97316] text-xs w-full'

// ─── Nova Requisição form ──────────────────────────────────────────────────────

interface NewReqFormProps {
  onSubmit: (req: Requisition) => void
  onCancel: () => void
}

function NewReqForm({ onSubmit, onCancel }: NewReqFormProps) {
  const [material, setMaterial]       = useState('')
  const [category, setCategory]       = useState('Cimento e Argamassa')
  const [quantity, setQuantity]       = useState('')
  const [unit, setUnit]               = useState('sc')
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
    <form onSubmit={handleSubmit} className="bg-[#3d3d3d] border border-[#5e5e5e] rounded-lg p-3 flex flex-col gap-2">
      <input className={INPUT} placeholder="Material *" value={material} onChange={(e) => setMaterial(e.target.value)} required />
      <select className={SELECT} value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <div className="flex gap-1.5">
        <input className={cn(INPUT, 'w-20')} placeholder="Qtd *" type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        <input className={cn(INPUT, 'flex-1')} placeholder="Un (sc, kg…)" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <input className={INPUT} placeholder="Solicitante *" value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} required />
      <input className={INPUT} placeholder="Projeto (PRJ-001)" value={projectRef} onChange={(e) => setProjectRef(e.target.value)} />
      <div className="flex gap-1.5 mt-1">
        <button type="submit" className="flex-1 bg-[#f97316] hover:bg-[#22a8c4] text-white rounded px-2 py-1.5 text-xs font-medium transition-colors">
          Submeter
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded border border-[#5e5e5e] text-[#a3a3a3] hover:text-[#f5f5f5] text-xs transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Edit Requisition Modal ────────────────────────────────────────────────────

interface EditReqModalProps {
  req: Requisition
  onSave: (patch: Partial<Requisition>) => void
  onClose: () => void
}

function EditReqModal({ req, onSave, onClose }: EditReqModalProps) {
  const [material, setMaterial]       = useState(req.material)
  const [category, setCategory]       = useState(req.category)
  const [quantity, setQuantity]       = useState(String(req.quantity))
  const [unit, setUnit]               = useState(req.unit)
  const [requestedBy, setRequestedBy] = useState(req.requestedBy)
  const [projectRef, setProjectRef]   = useState(req.projectRef)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!material.trim() || !requestedBy.trim() || !quantity) return
    onSave({
      material:    material.trim(),
      category,
      quantity:    parseFloat(quantity),
      unit,
      requestedBy: requestedBy.trim(),
      projectRef,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252]">
          <h4 className="text-[#f5f5f5] font-semibold text-sm">Editar Requisição</h4>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-4 flex flex-col gap-3">
          <div>
            <label className="text-[#a3a3a3] text-[10px] uppercase tracking-wide mb-1 block">Material</label>
            <input className={cn(INPUT, 'bg-[#2c2c2c] border-[#525252] text-[#f5f5f5]')} value={material} onChange={(e) => setMaterial(e.target.value)} required />
          </div>
          <div>
            <label className="text-[#a3a3a3] text-[10px] uppercase tracking-wide mb-1 block">Categoria</label>
            <select className={cn(SELECT, 'bg-[#2c2c2c] border-[#525252] text-[#f5f5f5]')} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[#a3a3a3] text-[10px] uppercase tracking-wide mb-1 block">Quantidade</label>
              <input className={cn(INPUT, 'bg-[#2c2c2c] border-[#525252] text-[#f5f5f5]')} type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="w-24">
              <label className="text-[#a3a3a3] text-[10px] uppercase tracking-wide mb-1 block">Unidade</label>
              <input className={cn(INPUT, 'bg-[#2c2c2c] border-[#525252] text-[#f5f5f5]')} value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[#a3a3a3] text-[10px] uppercase tracking-wide mb-1 block">Solicitante</label>
            <input className={cn(INPUT, 'bg-[#2c2c2c] border-[#525252] text-[#f5f5f5]')} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} required />
          </div>
          <div>
            <label className="text-[#a3a3a3] text-[10px] uppercase tracking-wide mb-1 block">Projeto</label>
            <input className={cn(INPUT, 'bg-[#2c2c2c] border-[#525252] text-[#f5f5f5]')} value={projectRef} onChange={(e) => setProjectRef(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex-1 flex items-center justify-center gap-1.5 bg-[#f97316] hover:bg-[#22a8c4] text-white rounded-lg px-3 py-2 text-xs font-semibold transition-colors">
              <Check size={13} /> Salvar
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs hover:border-[#6b6b6b] transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Kanban card ───────────────────────────────────────────────────────────────

interface CardProps {
  req: Requisition
  isLast: boolean
  onAdvance: () => void
  onEdit: () => void
}

function ReqCard({ req, isLast, onAdvance, onEdit }: CardProps) {
  const catColor = CATEGORY_COLORS[req.category] ?? 'bg-[#484848]/50 text-[#f5f5f5]'
  const date = new Date(req.requestedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-lg p-3 flex flex-col gap-2 text-xs">
      {/* Material + category + edit button */}
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-gray-100 font-medium leading-snug">{req.material}</p>
          <span className={cn('inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium', catColor)}>
            {req.category}
          </span>
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 p-1 rounded text-[#6b6b6b] hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
          title="Editar requisição"
        >
          <Pencil size={11} />
        </button>
      </div>

      {/* Quantity */}
      <p className="text-[#f5f5f5] tabular-nums">
        {req.quantity.toLocaleString('pt-BR')} {req.unit}
      </p>

      {/* Meta */}
      <div className="text-[#6b6b6b] space-y-0.5">
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
            <span key={s} className="text-[10px] text-amber-300 bg-amber-900/20 px-1.5 py-0.5 rounded">
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
          className="mt-1 flex items-center justify-center gap-1 px-2 py-1 rounded border border-[#f97316]/40 text-[#f97316] hover:bg-[#f97316]/10 transition-colors font-medium"
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
  const { requisitions, addRequisition, updateRequisition, advanceRequisitionStatus } =
    useSuprimentosStore(
      useShallow((s) => ({
        requisitions:             s.requisitions,
        addRequisition:           s.addRequisition,
        updateRequisition:        s.updateRequisition,
        advanceRequisitionStatus: s.advanceRequisitionStatus,
      }))
    )

  const [showNewForm, setShowNewForm] = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)

  const editingReq = editingId ? requisitions.find((r) => r.id === editingId) : null

  return (
    <div className="flex-1 min-h-0 overflow-x-auto">
      {/* Edit modal */}
      {editingReq && (
        <EditReqModal
          req={editingReq}
          onSave={(patch) => updateRequisition(editingReq.id, patch)}
          onClose={() => setEditingId(null)}
        />
      )}

      <div className="flex gap-3 h-full min-w-[900px] pb-2">
        {COLUMNS.map((col, colIdx) => {
          const cards = requisitions.filter((r) => r.status === col.status)
          const isLastCol = colIdx === COLUMNS.length - 1

          return (
            <div key={col.status} className={cn('flex flex-col flex-1 min-w-[170px] rounded-xl border border-[#525252]/60', col.bg)}>
              {/* Column header */}
              <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                <span className={cn('text-[11px] font-semibold uppercase tracking-wide', col.color)}>
                  {col.label}
                </span>
                <span className="text-[10px] bg-[#484848]/60 text-[#a3a3a3] px-1.5 py-0.5 rounded-full tabular-nums">
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
                      className="flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#f97316] transition-colors py-1"
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
                    onEdit={() => setEditingId(req.id)}
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
