import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { ExcecaoRoutingDialog } from './ExcecaoRoutingDialog'
import type { MatchException, ExceptionStatus, ExceptionType } from '@/types'

const TYPE_LABELS: Record<ExceptionType, string> = {
  price_diff:    'Divergência de Preço',
  quantity_diff: 'Entrega Parcial',
  item_missing:  'Item Não Entregue',
  duplicate:     'Possível Duplicata',
}

const STATUS_LABELS: Record<ExceptionStatus, string> = {
  open:       'Aberta',
  in_review:  'Em Análise',
  resolved:   'Resolvida',
  escalated:  'Escalada',
}

const STATUS_CLS: Record<ExceptionStatus, string> = {
  open:       'bg-[#dc2626]/20 text-[#f87171]',
  in_review:  'bg-[#ca8a04]/20 text-[#fbbf24]',
  resolved:   'bg-[#16a34a]/20 text-[#4ade80]',
  escalated:  'bg-[#7c3aed]/20 text-[#c4b5fd]',
}

const TYPE_CLS: Record<ExceptionType, string> = {
  price_diff:    'bg-[#ca8a04]/20 text-[#fbbf24]',
  quantity_diff: 'bg-[#2563eb]/20 text-[#93c5fd]',
  item_missing:  'bg-[#dc2626]/20 text-[#f87171]',
  duplicate:     'bg-[#7c3aed]/20 text-[#c4b5fd]',
}

const ALL_STATUSES: (ExceptionStatus | 'all')[] = ['all', 'open', 'in_review', 'escalated', 'resolved']
const ALL_TYPES: (ExceptionType | 'all')[] = ['all', 'price_diff', 'quantity_diff', 'item_missing', 'duplicate']

// ─── Exception form ───────────────────────────────────────────────────────────

interface ExFormState {
  poId: string
  type: ExceptionType
  description: string
  responsible: string
}

function ExceptionForm({
  initialValues,
  purchaseOrders,
  onSave,
  onCancel,
}: {
  initialValues?: Partial<ExFormState>
  purchaseOrders: { id: string; code: string; supplier: string }[]
  onSave: (data: ExFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<ExFormState>({
    poId:        initialValues?.poId        ?? purchaseOrders[0]?.id ?? '',
    type:        initialValues?.type        ?? 'price_diff',
    description: initialValues?.description ?? '',
    responsible: initialValues?.responsible ?? '',
  })

  function set<K extends keyof ExFormState>(key: K, val: ExFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <div className="bg-[#2c2c2c] border border-[#f97316]/30 rounded-xl p-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">OC</label>
          <select
            value={form.poId}
            onChange={(e) => set('poId', e.target.value)}
            className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
          >
            {purchaseOrders.map((po) => (
              <option key={po.id} value={po.id}>{po.code} — {po.supplier}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Tipo</label>
          <select
            value={form.type}
            onChange={(e) => set('type', e.target.value as ExceptionType)}
            className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
          >
            {(Object.keys(TYPE_LABELS) as ExceptionType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Descrição</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Descreva a exceção..."
          className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Responsável</label>
        <input
          type="text"
          value={form.responsible}
          onChange={(e) => set('responsible', e.target.value)}
          placeholder="Nome do responsável"
          className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#f5f5f5] transition-colors"
        >
          <X size={12} /> Cancelar
        </button>
        <button
          onClick={() => { if (form.description.trim()) onSave(form) }}
          className="px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-xs font-semibold transition-colors"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ExcecoesPanel() {
  const { exceptions, purchaseOrders, addException, updateException } = useSuprimentosStore(
    useShallow((s) => ({
      exceptions:      s.exceptions,
      purchaseOrders:  s.purchaseOrders,
      addException:    s.addException,
      updateException: s.updateException,
    }))
  )

  const [filterStatus, setFilterStatus] = useState<ExceptionStatus | 'all'>('all')
  const [filterType,   setFilterType]   = useState<ExceptionType | 'all'>('all')
  const [routing,      setRouting]      = useState<MatchException | undefined>()
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)

  const filtered = exceptions.filter((e) => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterType   !== 'all' && e.type   !== filterType)   return false
    return true
  })

  const filterBtnCls = (active: boolean) =>
    cn(
      'px-2.5 py-1 rounded text-xs font-medium transition-colors',
      active ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]'
    )

  function handleAdd(data: { poId: string; type: ExceptionType; description: string; responsible: string }) {
    const po = purchaseOrders.find((p) => p.id === data.poId)
    addException({
      id:              crypto.randomUUID(),
      matchId:         data.poId,
      poId:            data.poId,
      type:            data.type,
      description:     data.description,
      suggestedAction: 'Verificar com fornecedor e requerer documentação.',
      assignedTo:      data.responsible ? [data.responsible] : [],
      status:          'open',
      createdAt:       new Date().toISOString(),
    })
    void po
    setShowAddForm(false)
  }

  function handleEdit(ex: MatchException, data: { poId: string; type: ExceptionType; description: string; responsible: string }) {
    updateException(ex.id, {
      poId:        data.poId,
      type:        data.type,
      description: data.description,
      assignedTo:  data.responsible ? [data.responsible] : ex.assignedTo,
    })
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 flex-wrap">
            <span className="text-[#6b6b6b] text-xs self-center mr-1">Status:</span>
            {ALL_STATUSES.map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)} className={filterBtnCls(filterStatus === s)}>
                {s === 'all' ? 'Todos' : STATUS_LABELS[s as ExceptionStatus]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            <span className="text-[#6b6b6b] text-xs self-center mr-1">Tipo:</span>
            {ALL_TYPES.map((t) => (
              <button key={t} onClick={() => setFilterType(t)} className={filterBtnCls(filterType === t)}>
                {t === 'all' ? 'Todos' : TYPE_LABELS[t as ExceptionType]}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => { setShowAddForm((v) => !v); setEditingId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-xs font-semibold transition-colors shrink-0"
        >
          <Plus size={12} />
          Nova Exceção
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <ExceptionForm
          purchaseOrders={purchaseOrders}
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto overflow-x-auto bg-[#2c2c2c] border border-[#525252] rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#484848]">
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">OC</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Fornecedor</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-36">Tipo</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Descrição</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-28">Responsáveis</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-24">Status</th>
              <th className="text-center text-[#6b6b6b] text-xs font-medium px-3 py-2 w-36">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-[#6b6b6b] text-sm py-10">
                  Nenhuma exceção encontrada
                </td>
              </tr>
            ) : (
              filtered.map((ex) => {
                const po = purchaseOrders.find((p) => p.id === ex.poId)
                return (
                  <>
                    <tr key={ex.id} className="border-t border-[#525252] hover:bg-[#484848]/50 transition-colors">
                      <td className="px-3 py-3">
                        <span className="font-mono text-[#a3a3a3] text-xs">{po?.code ?? ex.poId}</span>
                      </td>
                      <td className="px-3 py-3 text-[#f5f5f5] text-xs">{po?.supplier ?? '—'}</td>
                      <td className="px-3 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', TYPE_CLS[ex.type])}>
                          {TYPE_LABELS[ex.type]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#a3a3a3] text-xs leading-relaxed max-w-xs">
                        <p className="line-clamp-2">{ex.description}</p>
                        <p className="text-[#f97316] text-[10px] italic mt-0.5 line-clamp-1">{ex.suggestedAction}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          {ex.assignedTo.map((name) => (
                            <span key={name} className="text-[#f5f5f5] text-[10px]">{name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_CLS[ex.status])}>
                          {STATUS_LABELS[ex.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setEditingId(editingId === ex.id ? null : ex.id)}
                            className="px-2 py-1 rounded bg-[#3d3d3d] hover:bg-[#484848] text-[#a3a3a3] text-[10px] font-semibold transition-colors"
                          >
                            Editar
                          </button>
                          {ex.status !== 'resolved' && (
                            <>
                              <button
                                onClick={() => setRouting(ex)}
                                className="px-2 py-1 rounded bg-[#f97316]/20 hover:bg-[#f97316]/30 text-[#f97316] text-[10px] font-semibold transition-colors"
                              >
                                Rotear
                              </button>
                              <button
                                onClick={() => updateException(ex.id, { status: 'resolved', resolvedAt: new Date().toISOString() })}
                                className="px-2 py-1 rounded bg-[#16a34a]/20 hover:bg-[#16a34a]/30 text-[#4ade80] text-[10px] font-semibold transition-colors"
                              >
                                Resolver
                              </button>
                            </>
                          )}
                          {ex.status === 'resolved' && (
                            <span className="text-[#1f3c5e] text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingId === ex.id && (
                      <tr key={`${ex.id}-edit`} className="border-t border-[#525252]">
                        <td colSpan={7} className="px-3 py-3">
                          <ExceptionForm
                            initialValues={{
                              poId:        ex.poId,
                              type:        ex.type,
                              description: ex.description,
                              responsible: ex.assignedTo[0] ?? '',
                            }}
                            purchaseOrders={purchaseOrders}
                            onSave={(data) => handleEdit(ex, data)}
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {routing && (
        <ExcecaoRoutingDialog exception={routing} onClose={() => setRouting(undefined)} />
      )}
    </div>
  )
}
