import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { PODialog } from './PODialog'
import type { DemandForecast } from '@/types'

const STATUS_CLS: Record<DemandForecast['status'], string> = {
  suggested: 'bg-[#2563eb]/20 text-[#93c5fd]',
  ordered:   'bg-[#16a34a]/20 text-[#4ade80]',
  dismissed: 'bg-[#1f3c5e] text-[#6b6b6b]',
}
const STATUS_LABELS: Record<DemandForecast['status'], string> = {
  suggested: 'Sugerida',
  ordered:   'Pedido Criado',
  dismissed: 'Descartada',
}

const CATEGORIES = ['Cimento e Argamassa', 'Aço / Vergalhão', 'Concreto Usinado', 'Tubulação e Saneamento', 'Impermeabilização', 'Outros']
const UNITS = ['sc', 'kg', 'm³', 'un', 'm', 'm²', 'br', 'l']
const PHASES = ['Fundações', 'Estrutura', 'Alvenaria', 'Instalações', 'Acabamento', 'Geral']

// ─── Forecast form ─────────────────────────────────────────────────────────────

interface ForecastFormState {
  weekLabel: string
  materialCategory: string
  unit: string
  relatedPhase: string
  estimatedQty: string
  estimatedValue: string
  suggestedOrderDate: string
}

function ForecastForm({
  initialValues,
  onSave,
  onCancel,
}: {
  initialValues?: Partial<ForecastFormState>
  onSave: (data: ForecastFormState) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<ForecastFormState>({
    weekLabel:          initialValues?.weekLabel          ?? '',
    materialCategory:   initialValues?.materialCategory   ?? CATEGORIES[0],
    unit:               initialValues?.unit               ?? 'sc',
    relatedPhase:       initialValues?.relatedPhase       ?? PHASES[0],
    estimatedQty:       initialValues?.estimatedQty       ?? '',
    estimatedValue:     initialValues?.estimatedValue     ?? '',
    suggestedOrderDate: initialValues?.suggestedOrderDate ?? today,
  })

  function set<K extends keyof ForecastFormState>(key: K, val: ForecastFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  const isValid = form.weekLabel.trim() && Number(form.estimatedQty) > 0 && Number(form.estimatedValue) > 0

  return (
    <div className="bg-[#2c2c2c] border border-[#f97316]/30 rounded-xl p-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Semana / Rótulo</label>
          <input
            type="text"
            value={form.weekLabel}
            onChange={(e) => set('weekLabel', e.target.value)}
            placeholder="Ex: Sem 12 / 2025"
            className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Categoria</label>
          <select
            value={form.materialCategory}
            onChange={(e) => set('materialCategory', e.target.value)}
            className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Fase Relacionada</label>
          <select
            value={form.relatedPhase}
            onChange={(e) => set('relatedPhase', e.target.value)}
            className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
          >
            {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Qtd Estimada</label>
          <input
            type="number"
            min="0"
            value={form.estimatedQty}
            onChange={(e) => set('estimatedQty', e.target.value)}
            className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Unidade</label>
          <select
            value={form.unit}
            onChange={(e) => set('unit', e.target.value)}
            className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Valor Estimado (R$)</label>
          <input
            type="number"
            min="0"
            value={form.estimatedValue}
            onChange={(e) => set('estimatedValue', e.target.value)}
            className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Data Pedido Sugerida</label>
          <input
            type="date"
            value={form.suggestedOrderDate}
            onChange={(e) => set('suggestedOrderDate', e.target.value)}
            className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#f5f5f5] transition-colors"
        >
          <X size={12} /> Cancelar
        </button>
        <button
          onClick={() => { if (isValid) onSave(form) }}
          disabled={!isValid}
          className="px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PrevisaoDemandaPanel() {
  const { forecasts, addForecast, updateForecast } = useSuprimentosStore(
    useShallow((s) => ({ forecasts: s.forecasts, addForecast: s.addForecast, updateForecast: s.updateForecast }))
  )
  const [showNewPO,   setShowNewPO]   = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)

  const suggested  = forecasts.filter((f) => f.status === 'suggested').length
  const totalValue = forecasts.filter((f) => f.status === 'suggested').reduce((acc, f) => acc + f.estimatedValue, 0)
  const nextCritical = forecasts
    .filter((f) => f.status === 'suggested')
    .sort((a, b) => a.suggestedOrderDate.localeCompare(b.suggestedOrderDate))[0]
  const daysToNext = nextCritical
    ? Math.ceil((new Date(nextCritical.suggestedOrderDate).getTime() - Date.now()) / 86_400_000)
    : null

  const kpis = [
    { label: 'Sugestões Pendentes',    value: String(suggested),                                           color: 'text-[#f97316]' },
    { label: 'Valor Total Previsto',   value: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: 'text-[#f5f5f5]' },
    { label: 'Dias até Próxima Compra', value: daysToNext !== null ? `${daysToNext}d` : '—',              color: daysToNext !== null && daysToNext <= 7 ? 'text-[#f87171]' : 'text-[#fbbf24]' },
  ]

  function handleAdd(data: ForecastFormState) {
    addForecast({
      weekLabel:          data.weekLabel,
      materialCategory:   data.materialCategory,
      estimatedQty:       Number(data.estimatedQty),
      unit:               data.unit,
      relatedPhase:       data.relatedPhase,
      suggestedOrderDate: data.suggestedOrderDate,
      estimatedValue:     Number(data.estimatedValue),
      status:             'suggested',
    })
    setShowAddForm(false)
  }

  function handleEdit(f: DemandForecast, data: ForecastFormState) {
    // updateForecast only changes status; use store directly for field updates
    useSuprimentosStore.setState((s) => ({
      forecasts: s.forecasts.map((fc) =>
        fc.id !== f.id ? fc : {
          ...fc,
          weekLabel:          data.weekLabel,
          materialCategory:   data.materialCategory,
          estimatedQty:       Number(data.estimatedQty),
          unit:               data.unit,
          relatedPhase:       data.relatedPhase,
          suggestedOrderDate: data.suggestedOrderDate,
          estimatedValue:     Number(data.estimatedValue),
        }
      ),
    }))
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      {/* KPI cards + header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div className="grid grid-cols-3 gap-3 flex-1">
          {kpis.map(({ label, value, color }) => (
            <div key={label} className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4 flex flex-col gap-1">
              <p className="text-[#6b6b6b] text-xs">{label}</p>
              <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => { setShowAddForm((v) => !v); setEditingId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-xs font-semibold transition-colors shrink-0 mt-0.5"
        >
          <Plus size={12} />
          Nova Demanda
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <ForecastForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto overflow-x-auto bg-[#2c2c2c] border border-[#525252] rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#484848]">
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Semana</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Categoria</th>
              <th className="text-right text-[#6b6b6b] text-xs font-medium px-3 py-2 w-24">Qtd Estimada</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-10">Un</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Fase Relacionada</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-32">Data Pedido Sugerida</th>
              <th className="text-right text-[#6b6b6b] text-xs font-medium px-3 py-2 w-28">Valor Estimado</th>
              <th className="text-center text-[#6b6b6b] text-xs font-medium px-3 py-2 w-24">Status</th>
              <th className="text-center text-[#6b6b6b] text-xs font-medium px-3 py-2 w-36">Ações</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((f) => {
              const daysLeft = Math.ceil(
                (new Date(f.suggestedOrderDate).getTime() - Date.now()) / 86_400_000
              )
              return (
                <>
                  <tr key={f.id} className="border-t border-[#525252] hover:bg-[#484848]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[#f5f5f5] text-xs">{f.weekLabel}</td>
                    <td className="px-3 py-2.5 text-[#f5f5f5] text-xs font-medium">{f.materialCategory}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#f5f5f5] text-xs">{f.estimatedQty.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2.5 text-[#a3a3a3] text-xs">{f.unit}</td>
                    <td className="px-3 py-2.5 text-[#a3a3a3] text-xs">{f.relatedPhase}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[#f5f5f5] text-xs">{new Date(f.suggestedOrderDate).toLocaleDateString('pt-BR')}</span>
                        {f.status === 'suggested' && (
                          <span className={cn('text-[10px]', daysLeft <= 3 ? 'text-[#f87171]' : daysLeft <= 7 ? 'text-[#fbbf24]' : 'text-[#6b6b6b]')}>
                            {daysLeft > 0 ? `em ${daysLeft}d` : 'vencido'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#f5f5f5] text-xs">
                      {f.estimatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_CLS[f.status])}>
                        {STATUS_LABELS[f.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => setEditingId(editingId === f.id ? null : f.id)}
                          className="px-2 py-0.5 rounded bg-[#3d3d3d] hover:bg-[#484848] text-[#a3a3a3] text-[10px] font-semibold transition-colors"
                        >
                          Editar
                        </button>
                        {f.status === 'suggested' ? (
                          <>
                            <button
                              onClick={() => { updateForecast(f.id, 'ordered'); setShowNewPO(true) }}
                              className="px-2 py-0.5 rounded bg-[#f97316]/20 hover:bg-[#f97316]/30 text-[#f97316] text-[10px] font-semibold transition-colors"
                            >
                              Criar OC
                            </button>
                            <button
                              onClick={() => updateForecast(f.id, 'dismissed')}
                              className="px-2 py-0.5 rounded bg-[#1f3c5e] hover:bg-[#525252] text-[#6b6b6b] text-[10px] font-semibold transition-colors"
                            >
                              Descartar
                            </button>
                          </>
                        ) : (
                          <span className="text-[#1f3c5e] text-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingId === f.id && (
                    <tr key={`${f.id}-edit`} className="border-t border-[#525252]">
                      <td colSpan={9} className="px-3 py-3">
                        <ForecastForm
                          initialValues={{
                            weekLabel:          f.weekLabel,
                            materialCategory:   f.materialCategory,
                            unit:               f.unit,
                            relatedPhase:       f.relatedPhase,
                            estimatedQty:       String(f.estimatedQty),
                            estimatedValue:     String(f.estimatedValue),
                            suggestedOrderDate: f.suggestedOrderDate,
                          }}
                          onSave={(data) => handleEdit(f, data)}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {showNewPO && <PODialog onClose={() => setShowNewPO(false)} />}
    </div>
  )
}
