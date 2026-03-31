import { useState, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Camera, Check, X, ChevronRight, FileEdit, Clock, Send } from 'lucide-react'
import { useGestao360Store } from '@/store/gestao360Store'
import { useProjetosStore } from '@/store/projetosStore'
import type { ChangeOrder, ChangeOrderType } from '@/types'

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META = {
  draft:     { label: 'Rascunho',    color: '#6b6b6b', bg: '#6b6b6b18', icon: FileEdit },
  submitted: { label: 'Aguard. Aprovação', color: '#2abfdc', bg: '#2abfdc18', icon: Clock  },
  approved:  { label: 'Aprovada',    color: '#22c55e', bg: '#22c55e18', icon: Check   },
  rejected:  { label: 'Rejeitada',   color: '#ef4444', bg: '#ef444418', icon: X       },
} as const

const TYPE_OPTIONS: Array<{ value: ChangeOrderType; label: string }> = [
  { value: 'scope',    label: 'Escopo'       },
  { value: 'cost',     label: 'Custo'        },
  { value: 'schedule', label: 'Prazo'        },
  { value: 'safety',   label: 'Segurança'    },
]

// ─── CO list item ─────────────────────────────────────────────────────────────

function COListItem({
  co,
  selected,
  onClick,
}: {
  co: ChangeOrder
  selected: boolean
  onClick: () => void
}) {
  const meta = STATUS_META[co.status]
  const Icon = meta.icon

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-lg border transition-colors flex items-start gap-3 ${
        selected
          ? 'bg-[#2abfdc]/10 border-[#2abfdc]/40'
          : 'bg-[#14294e] border-[#20406a] hover:border-[#1f3c5e]'
      }`}
    >
      <Icon size={14} className="mt-0.5 shrink-0" style={{ color: meta.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[#f5f5f5] text-xs font-semibold truncate">{co.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-[#6b6b6b] text-[10px]">
            {co.impactCostBRL >= 0 ? '+' : ''}R${(co.impactCostBRL / 1000).toFixed(0)}k
          </span>
        </div>
      </div>
      <ChevronRight size={12} className="text-[#6b6b6b] shrink-0 mt-1" />
    </button>
  )
}

// ─── Detail / form panel ──────────────────────────────────────────────────────

function CODetail({ co }: { co: ChangeOrder }) {
  const { submitChangeOrder, reviewChangeOrder, addPhoto } = useGestao360Store(
    useShallow((s) => ({
      submitChangeOrder: s.submitChangeOrder,
      reviewChangeOrder: s.reviewChangeOrder,
      addPhoto:          s.addPhoto,
    }))
  )
  const meta = STATUS_META[co.status]
  const Icon = meta.icon
  const fileRef = useRef<HTMLInputElement>(null)

  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewer,    setReviewer]    = useState('Gerente de Projeto')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      addPhoto(co.id, {
        base64,
        label: file.name,
        capturedAt: new Date().toISOString(),
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 flex flex-col gap-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ backgroundColor: meta.bg, color: meta.color }}>
              <Icon size={10} className="inline mr-1" />{meta.label}
            </span>
            <span className="text-[#6b6b6b] text-[10px]">{co.projectCode}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#20406a] text-[#6b6b6b]">
              {TYPE_OPTIONS.find((t) => t.value === co.type)?.label ?? co.type}
            </span>
          </div>
          <p className="text-[#f5f5f5] text-sm font-semibold">{co.title}</p>
        </div>
      </div>

      {/* Description */}
      <div>
        <p className="text-[#6b6b6b] text-xs mb-1 font-medium">Descrição</p>
        <p className="text-[#f5f5f5] text-xs leading-relaxed">{co.description}</p>
      </div>

      {/* Impact */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#14294e] rounded-lg p-3">
          <p className="text-[#6b6b6b] text-[10px] mb-1">Impacto de Custo</p>
          <p className={`text-base font-bold ${co.impactCostBRL >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
            {co.impactCostBRL >= 0 ? '+' : ''}R${Math.abs(co.impactCostBRL).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="bg-[#14294e] rounded-lg p-3">
          <p className="text-[#6b6b6b] text-[10px] mb-1">Impacto de Prazo</p>
          <p className={`text-base font-bold ${co.impactDays > 0 ? 'text-[#ef4444]' : co.impactDays < 0 ? 'text-[#22c55e]' : 'text-[#6b6b6b]'}`}>
            {co.impactDays > 0 ? '+' : ''}{co.impactDays} dias
          </p>
        </div>
      </div>

      {/* Photos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[#6b6b6b] text-xs font-medium">Fotos ({co.photos.length})</p>
          {(co.status === 'draft' || co.status === 'submitted') && (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 text-[#2abfdc] text-[10px] font-semibold hover:underline"
            >
              <Camera size={11} /> Adicionar
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>
        {co.photos.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {co.photos.map((p) => (
              <img
                key={p.id}
                src={p.base64}
                alt={p.label}
                className="w-16 h-16 object-cover rounded-lg border border-[#20406a]"
                title={p.label}
              />
            ))}
          </div>
        ) : (
          <p className="text-[#6b6b6b] text-xs italic">Nenhuma foto anexada</p>
        )}
      </div>

      {/* Metadata */}
      <div className="text-[10px] text-[#6b6b6b] border-t border-[#20406a] pt-3">
        <p>Submetido por <span className="text-[#f5f5f5]">{co.submittedBy}</span> em{' '}
          {new Date(co.submittedAt).toLocaleDateString('pt-BR')}</p>
        {co.reviewedBy && (
          <p className="mt-0.5">
            {co.status === 'approved' ? 'Aprovado' : 'Rejeitado'} por{' '}
            <span className="text-[#f5f5f5]">{co.reviewedBy}</span> em{' '}
            {co.reviewedAt ? new Date(co.reviewedAt).toLocaleDateString('pt-BR') : '—'}
          </p>
        )}
        {co.reviewNotes && (
          <p className="mt-1 text-[#a3a3a3] italic">"{co.reviewNotes}"</p>
        )}
        {co.linkedModule && (
          <p className="mt-1">Origem: <span className="text-[#3b82f6]">{co.linkedModule}</span></p>
        )}
      </div>

      {/* Actions */}
      {co.status === 'draft' && (
        <button
          onClick={() => submitChangeOrder(co.id)}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-[#2abfdc]/15 text-[#2abfdc] text-sm font-semibold hover:bg-[#2abfdc]/25 transition-colors"
        >
          <Send size={14} /> Enviar para Aprovação
        </button>
      )}

      {co.status === 'submitted' && (
        <div className="flex flex-col gap-2">
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="Revisor"
            className="px-3 py-1.5 rounded-lg bg-[#14294e] border border-[#20406a] text-[#f5f5f5] text-xs focus:outline-none focus:border-[#2abfdc]/60"
          />
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Notas de revisão (opcional)"
            rows={2}
            className="px-3 py-1.5 rounded-lg bg-[#14294e] border border-[#20406a] text-[#f5f5f5] text-xs resize-none focus:outline-none focus:border-[#2abfdc]/60"
          />
          <div className="flex gap-2">
            <button
              onClick={() => reviewChangeOrder(co.id, 'approved', reviewer, reviewNotes)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#22c55e]/15 text-[#22c55e] text-xs font-semibold hover:bg-[#22c55e]/25 transition-colors"
            >
              <Check size={13} /> Aprovar
            </button>
            <button
              onClick={() => reviewChangeOrder(co.id, 'rejected', reviewer, reviewNotes)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#ef4444]/15 text-[#ef4444] text-xs font-semibold hover:bg-[#ef4444]/25 transition-colors"
            >
              <X size={13} /> Rejeitar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New CO form ──────────────────────────────────────────────────────────────

function NewCOForm({ onClose }: { onClose: () => void }) {
  const { addChangeOrder, selectedProjectId } = useGestao360Store(
    useShallow((s) => ({ addChangeOrder: s.addChangeOrder, selectedProjectId: s.selectedProjectId }))
  )
  const projects = useProjetosStore((s) => s.projects)
  const project  = projects.find((p) => p.id === selectedProjectId) ?? projects[0]

  const [form, setForm] = useState({
    title:          '',
    type:           'scope' as ChangeOrderType,
    description:    '',
    impactCostBRL:  0,
    impactDays:     0,
    submittedBy:    '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.submittedBy.trim() || !project) return
    addChangeOrder({
      projectId:    project.id,
      projectCode:  project.code,
      title:        form.title.trim(),
      type:         form.type,
      description:  form.description.trim(),
      impactCostBRL: form.impactCostBRL,
      impactDays:   form.impactDays,
      submittedBy:  form.submittedBy.trim(),
    })
    onClose()
  }

  const inputCls = "w-full px-3 py-1.5 rounded-lg bg-[#14294e] border border-[#20406a] text-[#f5f5f5] text-xs focus:outline-none focus:border-[#2abfdc]/60"

  return (
    <form onSubmit={handleSubmit} className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 flex flex-col gap-3">
      <p className="text-[#f5f5f5] text-sm font-semibold">Nova Ordem de Mudança</p>

      <div>
        <label className="text-[#6b6b6b] text-[10px] mb-1 block">Título *</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={inputCls} placeholder="Descreva brevemente a mudança" required />
      </div>

      <div>
        <label className="text-[#6b6b6b] text-[10px] mb-1 block">Tipo</label>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ChangeOrderType })}
          className={inputCls}>
          {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div>
        <label className="text-[#6b6b6b] text-[10px] mb-1 block">Descrição</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={`${inputCls} resize-none`} rows={3} placeholder="Detalhe a situação no campo..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[#6b6b6b] text-[10px] mb-1 block">Impacto de Custo (R$)</label>
          <input type="number" value={form.impactCostBRL}
            onChange={(e) => setForm({ ...form, impactCostBRL: Number(e.target.value) })}
            className={inputCls} placeholder="0" />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] mb-1 block">Impacto de Prazo (dias)</label>
          <input type="number" value={form.impactDays}
            onChange={(e) => setForm({ ...form, impactDays: Number(e.target.value) })}
            className={inputCls} placeholder="0" />
        </div>
      </div>

      <div>
        <label className="text-[#6b6b6b] text-[10px] mb-1 block">Engenheiro responsável *</label>
        <input value={form.submittedBy} onChange={(e) => setForm({ ...form, submittedBy: e.target.value })}
          className={inputCls} placeholder="Nome do responsável" required />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit"
          className="flex-1 py-2 rounded-lg bg-[#2abfdc]/15 text-[#2abfdc] text-xs font-semibold hover:bg-[#2abfdc]/25 transition-colors">
          Criar Rascunho
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2 rounded-lg bg-[#20406a] text-[#6b6b6b] text-xs font-semibold hover:bg-[#333] transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ChangeOrderPanel() {
  const changeOrders = useGestao360Store((s) => s.changeOrders)
  const selectedProjectId = useGestao360Store((s) => s.selectedProjectId)

  const [selectedCO, setSelectedCO] = useState<string | null>(null)
  const [showNew,    setShowNew]    = useState(false)

  const filtered = selectedProjectId
    ? changeOrders.filter((co) => co.projectId === selectedProjectId)
    : changeOrders

  const selected = filtered.find((co) => co.id === selectedCO)

  const counts = {
    draft:     filtered.filter((co) => co.status === 'draft').length,
    submitted: filtered.filter((co) => co.status === 'submitted').length,
    approved:  filtered.filter((co) => co.status === 'approved').length,
    rejected:  filtered.filter((co) => co.status === 'rejected').length,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.entries(counts) as [keyof typeof counts, number][]).map(([status, count]) => {
          const meta = STATUS_META[status]
          return (
            <div key={status} className="bg-[#14294e] border border-[#20406a] rounded-xl px-3 py-2 text-center">
              <p className="text-lg font-bold" style={{ color: meta.color }}>{count}</p>
              <p className="text-[#6b6b6b] text-[10px]">{meta.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* List column */}
        <div className="lg:col-span-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[#f5f5f5] text-sm font-semibold">
              Ordens de Mudança ({filtered.length})
            </p>
            <button
              onClick={() => { setShowNew(true); setSelectedCO(null) }}
              className="flex items-center gap-1 text-[#2abfdc] text-xs font-semibold hover:underline"
            >
              <Plus size={13} /> Nova OM
            </button>
          </div>

          {filtered.length === 0 && !showNew && (
            <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 text-center">
              <p className="text-[#6b6b6b] text-xs">Nenhuma ordem de mudança. Clique em "Nova OM" para criar.</p>
            </div>
          )}

          {filtered.map((co) => (
            <COListItem
              key={co.id}
              co={co}
              selected={selectedCO === co.id}
              onClick={() => { setSelectedCO(co.id); setShowNew(false) }}
            />
          ))}
        </div>

        {/* Detail / form column */}
        <div className="lg:col-span-3">
          {showNew ? (
            <NewCOForm onClose={() => setShowNew(false)} />
          ) : selected ? (
            <CODetail co={selected} />
          ) : (
            <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-6 text-center h-full flex items-center justify-center">
              <p className="text-[#6b6b6b] text-sm">Selecione uma ordem de mudança para ver os detalhes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
