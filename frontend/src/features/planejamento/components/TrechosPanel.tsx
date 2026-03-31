/**
 * TrechosPanel — editable table of construction segments (trechos).
 * Supports inline editing, reordering via HTML5 drag-and-drop, and deletion.
 */
import { useState, useRef } from 'react'
import { Plus, Trash2, GripVertical, Download } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import type { PlanTrecho, PlanSoilType } from '@/types'

const SOIL_LABELS: Record<PlanSoilType, string> = {
  normal: 'Normal',
  rocky:  'Rochoso',
  mixed:  'Misto',
}

const ABC_COLORS: Record<string, string> = {
  A: 'bg-red-900/40 text-red-300 border-red-700/50',
  B: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  C: 'bg-green-900/40 text-green-300 border-green-700/50',
}

const DEFAULT_TRECHO: Omit<PlanTrecho, 'id'> = {
  code: '',
  description: '',
  lengthM: 100,
  depthM: 1.5,
  diameterMm: 200,
  soilType: 'normal',
  requiresShoring: false,
  unitCostBRL: 350,
}

// ─── Inline cell ──────────────────────────────────────────────────────────────

function EditableCell({ value, onChange, type = 'text', min, max, step, className = '' }: {
  value: string | number
  onChange: (v: string) => void
  type?: 'text' | 'number'
  min?: number
  max?: number
  step?: number
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type={type}
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        onBlur={(e) => { onChange(e.target.value); setEditing(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            if (e.key === 'Enter') onChange((e.target as HTMLInputElement).value)
            setEditing(false)
          }
        }}
        className={`w-full bg-gray-600 border border-orange-500 rounded px-2 py-1 text-sm text-white focus:outline-none ${className}`}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text hover:bg-gray-700 rounded px-1 py-0.5 transition-colors text-sm text-gray-200 ${className}`}
    >
      {value}
    </span>
  )
}

// ─── TrechosPanel ─────────────────────────────────────────────────────────────

export function TrechosPanel() {
  const {
    trechos, addTrecho, updateTrecho, removeTrecho,
    reorderTrechos, importTrechosFromPlatform,
  } = usePlanejamentoStore()

  // Drag-and-drop state
  const dragIdx = useRef<number | null>(null)

  function handleDragStart(idx: number) { dragIdx.current = idx }

  function handleDrop(targetIdx: number) {
    const from = dragIdx.current
    if (from === null || from === targetIdx) return
    const next = [...trechos]
    const [moved] = next.splice(from, 1)
    next.splice(targetIdx, 0, moved)
    reorderTrechos(next)
    dragIdx.current = null
  }

  function update(id: string, field: keyof Omit<PlanTrecho, 'id'>, raw: string) {
    const numFields = ['lengthM', 'depthM', 'diameterMm', 'unitCostBRL'] as const
    if ((numFields as readonly string[]).includes(field)) {
      updateTrecho(id, { [field]: parseFloat(raw) || 0 })
    } else {
      updateTrecho(id, { [field]: raw } as Partial<Omit<PlanTrecho, 'id'>>)
    }
  }

  function addNew() {
    const n = trechos.length + 1
    addTrecho({ ...DEFAULT_TRECHO, code: `T${String(n).padStart(2, '0')}` })
  }

  const totalMeters = trechos.reduce((s, t) => s + t.lengthM, 0)

  return (
    <div className="p-6">
      {/* Actions */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span><strong className="text-white">{trechos.length}</strong> trechos</span>
          <span><strong className="text-orange-400">{totalMeters.toFixed(0)} m</strong> total</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={importTrechosFromPlatform}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            <Download size={14} />
            Importar da Pré-Construção
          </button>
          <button
            onClick={addNew}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-orange-600 hover:bg-orange-500 text-white transition-colors"
          >
            <Plus size={14} />
            Novo Trecho
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="w-8 px-2 py-3"></th>
              <th className="text-left text-gray-400 px-3 py-3 font-medium">#</th>
              <th className="text-left text-gray-400 px-3 py-3 font-medium">Código</th>
              <th className="text-left text-gray-400 px-3 py-3 font-medium">Descrição</th>
              <th className="text-right text-gray-400 px-3 py-3 font-medium">Comp. (m)</th>
              <th className="text-right text-gray-400 px-3 py-3 font-medium">Prof. (m)</th>
              <th className="text-right text-gray-400 px-3 py-3 font-medium">Diam. (mm)</th>
              <th className="text-left text-gray-400 px-3 py-3 font-medium">Solo</th>
              <th className="text-center text-gray-400 px-3 py-3 font-medium">Escoram.</th>
              <th className="text-right text-gray-400 px-3 py-3 font-medium">R$/m</th>
              <th className="text-right text-gray-400 px-3 py-3 font-medium">Executado</th>
              <th className="text-center text-gray-400 px-3 py-3 font-medium">Zona</th>
              <th className="w-8 px-2 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {trechos.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Nenhum trecho cadastrado. Clique em "+ Novo Trecho" ou importe da Pré-Construção.
                </td>
              </tr>
            )}
            {trechos.map((t, idx) => (
              <tr
                key={t.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                className="bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                {/* Drag handle */}
                <td className="px-2 py-2 text-gray-600 cursor-grab active:cursor-grabbing">
                  <GripVertical size={14} />
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{idx + 1}</td>
                <td className="px-3 py-2">
                  <EditableCell value={t.code} onChange={(v) => update(t.id, 'code', v)} />
                </td>
                <td className="px-3 py-2 min-w-[200px]">
                  <EditableCell value={t.description} onChange={(v) => update(t.id, 'description', v)} className="w-full" />
                </td>
                <td className="px-3 py-2 text-right">
                  <EditableCell value={t.lengthM} type="number" min={0.1} step={1}
                    onChange={(v) => update(t.id, 'lengthM', v)} className="text-right" />
                </td>
                <td className="px-3 py-2 text-right">
                  <EditableCell value={t.depthM} type="number" min={0.1} step={0.1}
                    onChange={(v) => update(t.id, 'depthM', v)} className="text-right" />
                </td>
                <td className="px-3 py-2 text-right">
                  <EditableCell value={t.diameterMm} type="number" min={50} step={50}
                    onChange={(v) => update(t.id, 'diameterMm', v)} className="text-right" />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={t.soilType}
                    onChange={(e) => updateTrecho(t.id, { soilType: e.target.value as PlanSoilType })}
                    className="bg-transparent text-sm text-gray-200 focus:outline-none cursor-pointer"
                  >
                    {Object.entries(SOIL_LABELS).map(([k, v]) => (
                      <option key={k} value={k} className="bg-gray-800">{v}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={t.requiresShoring}
                    onChange={(e) => updateTrecho(t.id, { requiresShoring: e.target.checked })}
                    className="accent-orange-500"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <EditableCell
                    value={t.unitCostBRL ?? 0} type="number" min={0} step={10}
                    onChange={(v) => update(t.id, 'unitCostBRL', v)} className="text-right" />
                </td>
                <td className="px-3 py-2 text-right">
                  {(t.executedMeters ?? 0) > 0 ? (
                    <div className="flex items-center gap-1 justify-end">
                      <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, ((t.executedMeters ?? 0) / t.lengthM) * 100)}%` }} />
                      </div>
                      <span className="text-emerald-400 text-[10px] font-mono">{((t.executedMeters ?? 0) / t.lengthM * 100).toFixed(0)}%</span>
                    </div>
                  ) : (
                    <span className="text-gray-600 text-[10px]">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {t.abcZone && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${ABC_COLORS[t.abcZone]}`}>
                      {t.abcZone}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => {
                      if (confirm(`Remover trecho ${t.code}?`)) removeTrecho(t.id)
                    }}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {trechos.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          Arraste pela coluna <GripVertical size={11} className="inline" /> para reordenar. Clique em qualquer célula para editar.
        </p>
      )}
    </div>
  )
}
