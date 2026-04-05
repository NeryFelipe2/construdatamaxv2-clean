/**
 * MedicaoPonderadaPanel — Weighted Measurement Matrix for the EVM module.
 * Displays a table of weighted measurements with editable cells and colored bars.
 */
import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import type { WeightedMeasurement } from '@/types'

type EditingCell = {
  id: string
  field: keyof Pick<WeightedMeasurement, 'financialWeight' | 'durationWeight' | 'economicWeight' | 'specificWeight'>
} | null

function WeightBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(Math.max(value * 100, 0), 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 bg-[#2c2c2c] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-xs text-[#a3a3a3] w-10 text-right">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  )
}

export function MedicaoPonderadaPanel() {
  const { measurements, addMeasurement, updateMeasurement, removeMeasurement } = useEvmStore()
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newActivity, setNewActivity] = useState({ activityId: '', activityName: '', financialWeight: 0.25, durationWeight: 0.25, economicWeight: 0.25, specificWeight: 0.25 })

  function startEdit(id: string, field: NonNullable<EditingCell>['field'], currentValue: number) {
    setEditingCell({ id, field })
    setEditValue((currentValue * 100).toFixed(0))
  }

  function confirmEdit() {
    if (!editingCell) return
    const num = parseFloat(editValue) / 100
    if (!isNaN(num) && num >= 0 && num <= 1) {
      updateMeasurement(editingCell.id, { [editingCell.field]: num })
    }
    setEditingCell(null)
    setEditValue('')
  }

  function cancelEdit() {
    setEditingCell(null)
    setEditValue('')
  }

  function handleAdd() {
    if (!newActivity.activityName.trim()) return
    addMeasurement({
      activityId: newActivity.activityId || crypto.randomUUID().slice(0, 8),
      activityName: newActivity.activityName,
      financialWeight: newActivity.financialWeight,
      durationWeight: newActivity.durationWeight,
      economicWeight: newActivity.economicWeight,
      specificWeight: newActivity.specificWeight,
    })
    setNewActivity({ activityId: '', activityName: '', financialWeight: 0.25, durationWeight: 0.25, economicWeight: 0.25, specificWeight: 0.25 })
    setShowAddForm(false)
  }

  const WEIGHT_COLS: { key: NonNullable<EditingCell>['field']; label: string; color: string }[] = [
    { key: 'financialWeight', label: 'Peso Financeiro', color: '#38bdf8' },
    { key: 'durationWeight', label: 'Peso Duração', color: '#f97316' },
    { key: 'economicWeight', label: 'Peso Econômico', color: '#22c55e' },
    { key: 'specificWeight', label: 'Peso Específico', color: '#a78bfa' },
  ]

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[#f5f5f5] text-sm font-semibold">Matriz de Medição Ponderada</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
        >
          <Plus size={15} />
          Adicionar Medição
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 space-y-3">
          <p className="text-[#f5f5f5] text-sm font-semibold">Nova Medição</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[#a3a3a3] text-xs block mb-1">ID Atividade</label>
              <input
                type="text"
                value={newActivity.activityId}
                onChange={(e) => setNewActivity({ ...newActivity, activityId: e.target.value })}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
                placeholder="ex: ma-sm-eg"
              />
            </div>
            <div>
              <label className="text-[#a3a3a3] text-xs block mb-1">Nome da Atividade</label>
              <input
                type="text"
                value={newActivity.activityName}
                onChange={(e) => setNewActivity({ ...newActivity, activityName: e.target.value })}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
                placeholder="ex: Escavação de vala"
              />
            </div>
            {WEIGHT_COLS.map((col) => (
              <div key={col.key}>
                <label className="text-[#a3a3a3] text-xs block mb-1">{col.label} (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={(newActivity[col.key] * 100).toFixed(0)}
                  onChange={(e) =>
                    setNewActivity({ ...newActivity, [col.key]: parseFloat(e.target.value) / 100 || 0 })
                  }
                  className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] font-mono outline-none focus:border-[#f97316]"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        {measurements.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-[#6b6b6b] text-sm">
            Nenhuma medição cadastrada. Clique em &quot;Carregar Demo&quot; ou adicione manualmente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#525252]">
                  <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-3">Atividade</th>
                  {WEIGHT_COLS.map((col) => (
                    <th key={col.key} className="text-left text-xs font-medium px-4 py-3" style={{ color: col.color }}>
                      {col.label}
                    </th>
                  ))}
                  <th className="text-left text-[#f97316] text-xs font-medium px-4 py-3">Score Composto</th>
                  <th className="text-center text-[#a3a3a3] text-xs font-medium px-4 py-3 w-16">Ações</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => (
                  <tr key={m.id} className="border-b border-[#525252]/50 hover:bg-[#484848]/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[#f5f5f5] text-sm">{m.activityName}</p>
                      <p className="text-[#6b6b6b] text-[10px] font-mono">{m.activityId}</p>
                    </td>
                    {WEIGHT_COLS.map((col) => {
                      const isEditing = editingCell?.id === m.id && editingCell?.field === col.key
                      return (
                        <td key={col.key} className="px-4 py-3 min-w-[160px]">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') confirmEdit()
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                                autoFocus
                                className="w-16 bg-[#2c2c2c] border border-[#f97316] rounded px-2 py-1 text-xs text-[#f5f5f5] font-mono outline-none"
                              />
                              <span className="text-[#6b6b6b] text-xs">%</span>
                              <button onClick={confirmEdit} className="text-green-400 hover:text-green-300">
                                <Check size={13} />
                              </button>
                              <button onClick={cancelEdit} className="text-red-400 hover:text-red-300">
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div
                              className="cursor-pointer group"
                              onClick={() => startEdit(m.id, col.key, m[col.key])}
                            >
                              <WeightBar value={m[col.key]} color={col.color} />
                              <Pencil size={10} className="text-[#6b6b6b] opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3">
                      <span className="font-mono text-[#f97316] text-sm font-semibold">
                        {m.compositeScore.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeMeasurement(m.id)}
                        className="text-[#6b6b6b] hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
