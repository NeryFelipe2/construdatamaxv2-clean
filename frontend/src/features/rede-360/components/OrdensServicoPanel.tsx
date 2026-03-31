/**
 * OrdensServicoPanel — Kanban view for service orders.
 */
import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'
import { ConfirmDialog } from '@/features/lps-lean/components/ConfirmDialog'
import type { Rede360ServiceOrderStatus, ServiceOrderPriority } from '@/types'

const STATUS_COLUMNS: { id: Rede360ServiceOrderStatus; label: string }[] = [
  { id: 'pending',     label: 'Pendente'     },
  { id: 'in_progress', label: 'Em Execução'  },
  { id: 'completed',   label: 'Concluída'    },
  { id: 'cancelled',   label: 'Cancelada'    },
]

const PRIORITY_BADGE: Record<ServiceOrderPriority, string> = {
  low:       'bg-gray-800 text-gray-400',
  medium:    'bg-yellow-900/40 text-yellow-300',
  high:      'bg-orange-900/40 text-orange-300',
  emergency: 'bg-red-900/40 text-red-300',
}

const PRIORITY_LABELS: Record<ServiceOrderPriority, string> = {
  low:       'Baixa',
  medium:    'Média',
  high:      'Alta',
  emergency: 'Emergência',
}

const TYPE_OPTIONS = ['Inspeção', 'Manutenção', 'Emergência', 'Troca', 'Outro']

const STATUS_NEXT: Record<string, Rede360ServiceOrderStatus | null> = {
  pending:     'in_progress',
  in_progress: 'completed',
  completed:   null,
  cancelled:   null,
}

interface NewOsForm {
  assetId: string
  type: string
  priority: ServiceOrderPriority
  description: string
  assignedTo: string
  scheduledDate: string
  estimatedHours: string
}

const EMPTY_FORM: NewOsForm = {
  assetId: '',
  type: 'Inspeção',
  priority: 'medium',
  description: '',
  assignedTo: '',
  scheduledDate: '',
  estimatedHours: '',
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function OrdensServicoPanel() {
  const { assets, serviceOrders, addServiceOrder, updateServiceOrder, removeServiceOrder } = useRede360Store(
    useShallow((s) => ({
      assets:               s.assets,
      serviceOrders:        s.serviceOrders,
      addServiceOrder:      s.addServiceOrder,
      updateServiceOrder:   s.updateServiceOrder,
      removeServiceOrder:   s.removeServiceOrder,
    }))
  )

  const [showNewOs, setShowNewOs] = useState(false)
  const [form, setForm] = useState<NewOsForm>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function handleSave() {
    if (!form.description.trim()) return
    addServiceOrder({
      code:           `OS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      assetId:        form.assetId || null,
      type:           form.type,
      priority:       form.priority,
      status:         'pending',
      description:    form.description,
      assignedTo:     form.assignedTo || undefined,
      scheduledDate:  form.scheduledDate || undefined,
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
    })
    setForm(EMPTY_FORM)
    setShowNewOs(false)
  }

  const inputCls = 'w-full bg-[#14294e] border border-[#1f3c5e] rounded px-2 py-1.5 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none'

  return (
    <div className="p-4 h-full flex flex-col overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="text-[#f5f5f5] text-sm font-semibold">Ordens de Serviço</h2>
        <button
          onClick={() => setShowNewOs(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc] hover:bg-[#1a9ab8] text-white text-xs font-semibold transition-colors"
        >
          <Plus size={14} />
          Nova OS
        </button>
      </div>

      {/* New OS panel */}
      {showNewOs && (
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4 mb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#f5f5f5] text-sm font-medium">Nova Ordem de Serviço</span>
            <button onClick={() => { setShowNewOs(false); setForm(EMPTY_FORM) }} className="text-[#6b6b6b] hover:text-[#f5f5f5]">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[#6b6b6b] text-xs mb-1 block">Ativo</label>
              <select value={form.assetId} onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))} className={inputCls}>
                <option value="">Sem ativo vinculado</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[#6b6b6b] text-xs mb-1 block">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[#6b6b6b] text-xs mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as ServiceOrderPriority }))} className={inputCls}>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="emergency">Emergência</option>
              </select>
            </div>
            <div>
              <label className="text-[#6b6b6b] text-xs mb-1 block">Responsável</label>
              <input type="text" value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} placeholder="Nome da equipe" className={inputCls} />
            </div>
            <div>
              <label className="text-[#6b6b6b] text-xs mb-1 block">Data Prevista</label>
              <input type="date" value={form.scheduledDate} onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-[#6b6b6b] text-xs mb-1 block">Horas Estimadas</label>
              <input type="number" value={form.estimatedHours} onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))} min={0} placeholder="0" className={inputCls} />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[#6b6b6b] text-xs mb-1 block">Descrição *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Descreva a atividade..."
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-1.5 rounded bg-[#2abfdc] hover:bg-[#1a9ab8] text-white text-xs font-semibold transition-colors">Salvar</button>
            <button onClick={() => { setShowNewOs(false); setForm(EMPTY_FORM) }} className="px-4 py-1.5 rounded bg-[#14294e] hover:bg-[#1a3662] border border-[#20406a] text-[#8fb3c8] text-xs transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex gap-3 flex-1 overflow-x-auto overflow-y-hidden">
        {STATUS_COLUMNS.map((col) => {
          const colOrders = serviceOrders.filter((o) => o.status === col.id)
          return (
            <div key={col.id} className="flex flex-col w-72 shrink-0 bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
              {/* Column header */}
              <div className="px-3 py-2 border-b border-[#20406a] flex items-center gap-2 shrink-0">
                <span className="text-[#f5f5f5] text-xs font-semibold">{col.label}</span>
                <span className="text-xs bg-[#14294e] text-[#8fb3c8] px-1.5 py-0.5 rounded-full">{colOrders.length}</span>
              </div>

              {/* Cards */}
              <div className="overflow-y-auto flex-1 p-2 space-y-2" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                {colOrders.length === 0 && (
                  <p className="text-[#6b6b6b] text-xs italic text-center py-4">Nenhuma OS</p>
                )}
                {colOrders.map((order) => {
                  const asset = assets.find((a) => a.id === order.assetId)
                  const next = STATUS_NEXT[order.status]
                  return (
                    <div key={order.id} className="bg-[#14294e] rounded-lg border border-[#20406a] p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[#6b6b6b] text-xs font-mono">{order.code}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_BADGE[order.priority]}`}>
                          {PRIORITY_LABELS[order.priority]}
                        </span>
                      </div>
                      <div className="text-[#f5f5f5] text-xs mb-1">{order.description}</div>
                      <div className="text-[#6b6b6b] text-xs space-y-0.5">
                        {asset && <div>Ativo: <span className="text-[#8fb3c8]">{asset.code}</span></div>}
                        {order.assignedTo && <div>Equipe: <span className="text-[#8fb3c8]">{order.assignedTo}</span></div>}
                        {order.scheduledDate && <div>Previsto: <span className="text-[#8fb3c8]">{fmtDate(order.scheduledDate)}</span></div>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {next && (
                          <button
                            onClick={() => updateServiceOrder(order.id, { status: next })}
                            className="text-xs px-2 py-1 rounded bg-[#112645] hover:bg-[#20406a] text-[#2abfdc] transition-colors border border-[#20406a]"
                          >
                            Avançar →
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDeleteId(order.id)}
                          className="ml-auto p-1 rounded hover:bg-red-900/30 text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {confirmDeleteId === order.id && (
                        <div className="mt-2">
                          <ConfirmDialog
                            message="Excluir esta OS?"
                            confirmLabel="Excluir"
                            onConfirm={() => { removeServiceOrder(order.id); setConfirmDeleteId(null) }}
                            onCancel={() => setConfirmDeleteId(null)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
