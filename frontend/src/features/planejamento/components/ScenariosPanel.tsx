/**
 * ScenariosPanel — Save, load, rename, and delete planning scenarios.
 */
import { useState } from 'react'
import { Save, Upload, Pencil, Trash2, X, Check } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import type { PlanScenario } from '@/types'
import { planScenarioSchema } from '../schemas'

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}
function fmtR(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ─── Save Dialog ──────────────────────────────────────────────────────────────

function SaveDialog({ onClose, onSave }: { onClose: () => void; onSave: (name: string, desc: string) => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSave() {
    const result = planScenarioSchema.safeParse({ name, description: desc })
    if (!result.success) {
      const errs: Record<string, string> = {}
      for (const issue of result.error.issues) {
        if (issue.path[0]) errs[String(issue.path[0])] = issue.message
      }
      setErrors(errs)
      return
    }
    onSave(name.trim(), desc.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-600 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-white font-semibold">Salvar Planejamento</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Nome do Planejamento *</label>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }}
              maxLength={100} placeholder="Ex: Cenário Otimista — 3 Equipes"
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
            {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Descrição (opcional)</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
              maxLength={500} rows={3} placeholder="Notas sobre este cenário…"
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#2abfdc' }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Scenario Card ────────────────────────────────────────────────────────────

function ScenarioCard({ scenario, onLoad, onRename, onDelete }: {
  scenario: PlanScenario
  onLoad:   () => void
  onRename: (name: string, desc: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(scenario.name)
  const [editDesc, setEditDesc] = useState(scenario.description ?? '')

  const totalMeters = scenario.trechos.reduce((s, t) => s + t.lengthM, 0)

  function handleRename() {
    const result = planScenarioSchema.safeParse({ name: editName, description: editDesc })
    if (!result.success) return
    onRename(editName.trim(), editDesc.trim())
    setEditing(false)
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col gap-4">
      {/* Header */}
      {editing ? (
        <div className="space-y-2">
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
            maxLength={100}
            className="w-full bg-gray-700 border border-orange-500 rounded px-2 py-1 text-sm text-white focus:outline-none" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
            maxLength={500} rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white resize-none focus:outline-none focus:border-orange-500" />
          <div className="flex gap-2">
            <button onClick={handleRename}
              className="flex items-center gap-1 px-2 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs transition-colors">
              <Check size={12} /> Salvar
            </button>
            <button onClick={() => { setEditing(false); setEditName(scenario.name); setEditDesc(scenario.description ?? '') }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-200 text-xs transition-colors">
              <X size={12} /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-white font-semibold text-sm">{scenario.name}</div>
            {scenario.description && (
              <div className="text-gray-400 text-xs mt-0.5 line-clamp-2">{scenario.description}</div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEditing(true)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={() => {
              if (confirm(`Excluir "${scenario.name}"?`)) onDelete()
            }} className="text-red-400 hover:text-red-300 p-1 rounded transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-700/50 rounded-lg px-3 py-2">
          <div className="text-gray-400">Trechos</div>
          <div className="text-white font-medium">{scenario.trechos.length}</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg px-3 py-2">
          <div className="text-gray-400">Metros</div>
          <div className="text-orange-400 font-medium">{totalMeters.toFixed(0)} m</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg px-3 py-2">
          <div className="text-gray-400">Equipes</div>
          <div className="text-white font-medium">{scenario.teams.length}</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg px-3 py-2">
          <div className="text-gray-400">Início</div>
          <div className="text-white font-medium">{scenario.scheduleConfig.startDate}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700">
        <span>Salvo em {fmtDate(scenario.createdAt)}</span>
        <button
          onClick={() => {
            if (confirm(`Carregar o cenário "${scenario.name}"? As configurações atuais serão substituídas.`)) {
              onLoad()
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          <Upload size={12} /> Carregar
        </button>
      </div>
    </div>
  )
}

// ─── ScenariosPanel ───────────────────────────────────────────────────────────

export function ScenariosPanel() {
  const { scenarios, saveScenario, loadScenario, renameScenario, removeScenario, trechos, teams, totalCostBRL } = usePlanejamentoStore()
  const [showDialog, setShowDialog] = useState(false)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-white font-semibold text-lg">Planejamentos Salvos</h2>
          <p className="text-gray-400 text-sm mt-0.5">{scenarios.length} cenário(s) salvo(s)</p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors"
        >
          <Save size={15} /> Salvar Planejamento Atual
        </button>
      </div>

      {/* Current config summary */}
      <div className="bg-gray-800 rounded-xl border border-orange-500/30 p-4 mb-6">
        <div className="text-xs text-orange-400 font-medium uppercase tracking-wide mb-3">Configuração Atual (não salva)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-gray-400 text-xs">Trechos</div>
            <div className="text-white font-medium">{trechos.length}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Metros</div>
            <div className="text-orange-400 font-medium">{trechos.reduce((s, t) => s + t.lengthM, 0).toFixed(0)} m</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Equipes</div>
            <div className="text-white font-medium">{teams.length}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Custo Estimado</div>
            <div className="text-white font-medium">{totalCostBRL > 0 ? fmtR(totalCostBRL) : '— (gere o planejamento)'}</div>
          </div>
        </div>
      </div>

      {/* Scenario cards */}
      {scenarios.length === 0 && (
        <div className="text-center text-gray-500 py-12 text-sm">
          Nenhum planejamento salvo. Clique em "Salvar Planejamento Atual" para criar o primeiro cenário.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((s) => (
          <ScenarioCard
            key={s.id}
            scenario={s}
            onLoad={() => loadScenario(s.id)}
            onRename={(name, desc) => renameScenario(s.id, name, desc)}
            onDelete={() => removeScenario(s.id)}
          />
        ))}
      </div>

      {showDialog && (
        <SaveDialog
          onClose={() => setShowDialog(false)}
          onSave={(name, desc) => saveScenario(name, desc)}
        />
      )}
    </div>
  )
}
