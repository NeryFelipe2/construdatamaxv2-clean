/**
 * BancoDadosPanel — cost base selector (SINAPI/SEINFRA/Custom) with import and CRUD.
 */
import { useState, useRef } from 'react'
import { Plus, Trash2, Upload, Download, Search, X, Check } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { exportCustomBaseToCsv, exportCustomBaseToXlsx, parseExcelToCustomBase } from '../utils/exportEngine'
import { mockSinapi } from '@/data/mockSinapi'
import { mockSeinfra } from '@/data/mockSeinfra'
import type { CostBaseSource, CustomBaseEntry } from '@/types'

const ACCENT = '#8b5cf6'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

// Inline editable custom entry
function EntryRow({ entry, onUpdate, onDelete }: {
  entry: CustomBaseEntry
  onUpdate: (id: string, updates: Partial<Omit<CustomBaseEntry, 'id'>>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...entry })

  function save() {
    onUpdate(entry.id, { code: draft.code, description: draft.description, unit: draft.unit, unitCost: draft.unitCost, category: draft.category })
    setEditing(false)
  }

  const cellInput = 'bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-violet-500 w-full'

  if (editing) {
    return (
      <tr className="border-b border-gray-700/50 bg-gray-750/30">
        <td className="px-3 py-2"><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={cellInput} /></td>
        <td className="px-3 py-2"><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={cellInput} /></td>
        <td className="px-3 py-2"><input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className={`${cellInput} w-16`} /></td>
        <td className="px-3 py-2"><input type="number" value={draft.unitCost} onChange={(e) => setDraft({ ...draft, unitCost: parseFloat(e.target.value) || 0 })} className={`${cellInput} w-24`} /></td>
        <td className="px-3 py-2"><input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={cellInput} /></td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button onClick={save} className="p-1 text-emerald-400"><Check size={13} /></button>
            <button onClick={() => setEditing(false)} className="p-1 text-gray-500"><X size={13} /></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-750/20 cursor-pointer" onClick={() => setEditing(true)}>
      <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{entry.code}</td>
      <td className="px-3 py-2.5 text-gray-200 text-sm">{entry.description}</td>
      <td className="px-3 py-2.5 text-gray-400 text-sm">{entry.unit}</td>
      <td className="px-3 py-2.5 text-right text-gray-300 text-sm">{fmtBRL(entry.unitCost)}</td>
      <td className="px-3 py-2.5 text-gray-400 text-sm">{entry.category}</td>
      <td className="px-3 py-2.5">
        <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

// Add entry form (inline at bottom)
function AddEntryRow({ onAdd }: { onAdd: (e: Omit<CustomBaseEntry, 'id'>) => void }) {
  const [form, setForm] = useState({ code: '', description: '', unit: 'un', unitCost: 0, category: 'Geral', source: 'Manual' })
  const [err, setErr] = useState('')

  function submit() {
    if (!form.code.trim() || !form.description.trim()) { setErr('Código e Descrição obrigatórios'); return }
    onAdd(form)
    setForm({ code: '', description: '', unit: 'un', unitCost: 0, category: 'Geral', source: 'Manual' })
    setErr('')
  }

  const cellInput = 'bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-violet-500 w-full'

  return (
    <>
      <tr className="border-b border-gray-600 bg-gray-750/50">
        <td className="px-3 py-2"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Código" className={cellInput} /></td>
        <td className="px-3 py-2"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição" className={cellInput} /></td>
        <td className="px-3 py-2"><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={`${cellInput} w-16`} /></td>
        <td className="px-3 py-2"><input type="number" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })} className={`${cellInput} w-24`} /></td>
        <td className="px-3 py-2"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Categoria" className={cellInput} /></td>
        <td className="px-3 py-2">
          <button onClick={submit} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: ACCENT }}>
            <Plus size={12} /> Add
          </button>
        </td>
      </tr>
      {err && (
        <tr><td colSpan={6} className="px-3 py-1 text-red-400 text-xs">{err}</td></tr>
      )}
    </>
  )
}

export function BancoDadosPanel() {
  const { costBase, setCostBase, customBase, importCustomBase, addCustomEntry, removeCustomEntry } = useQuantitativosStore()
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const BASE_OPTIONS: { value: CostBaseSource; label: string; desc: string; count: number }[] = [
    { value: 'sinapi',  label: 'SINAPI',  desc: 'Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil — CAIXA/CEF', count: mockSinapi.length },
    { value: 'seinfra', label: 'SEINFRA', desc: 'Tabela de referência de custos de obras públicas — Secretaria de Infraestrutura', count: mockSeinfra.length },
    { value: 'custom',  label: 'Base Própria', desc: 'Tabela de custos personalizada — importe via PDF ou Excel ou adicione manualmente', count: customBase.length },
  ]

  // Entries to display (SINAPI, SEINFRA, or custom)
  const displayEntries: { code: string; description: string; unit: string; unitCost: number; category: string }[] =
    costBase === 'sinapi'  ? mockSinapi :
    costBase === 'seinfra' ? mockSeinfra :
    customBase

  const filtered = displayEntries.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return e.description.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
  })

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImporting(true)
    try {
      const entries = await parseExcelToCustomBase(file)
      if (entries.length === 0) { setImportError('Nenhum item válido encontrado no arquivo. Verifique as colunas: Código, Descrição, Unidade, Custo Unitário (R$), Categoria.'); return }
      importCustomBase(entries)
    } catch {
      setImportError('Erro ao processar o arquivo. Verifique o formato.')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Base selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {BASE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setCostBase(opt.value)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              costBase === opt.value
                ? 'border-violet-500 bg-violet-950/30'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-200 font-semibold text-sm">{opt.label}</span>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${costBase === opt.value ? 'border-violet-500 bg-violet-500' : 'border-gray-600'}`}>
                {costBase === opt.value && <span className="w-2 h-2 bg-white rounded-full" />}
              </span>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">{opt.desc}</p>
            <p className="text-violet-400 text-xs mt-1 font-medium">{opt.count} entradas</p>
          </button>
        ))}
      </div>

      {/* Custom base import controls */}
      {costBase === 'custom' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-3">
          <h3 className="text-gray-200 font-medium text-sm">Importar Base de Custos</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {importing ? 'Importando...' : 'Importar Excel / CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => exportCustomBaseToCsv(customBase)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            >
              <Download size={14} /> Exportar Base (CSV)
            </button>
            <button
              onClick={() => exportCustomBaseToXlsx(customBase)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            >
              <Download size={14} /> Exportar Base (Excel)
            </button>
          </div>
          {importError && <p className="text-red-400 text-sm">{importError}</p>}
          <p className="text-gray-500 text-xs">
            O arquivo Excel/CSV deve ter as colunas: <span className="text-gray-400">Código, Descrição, Unidade, Custo Unitário (R$), Categoria</span>
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar em ${costBase === 'sinapi' ? 'SINAPI' : costBase === 'seinfra' ? 'SEINFRA' : 'Base Própria'}...`}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700">
          <p className="text-gray-400 text-xs">{filtered.length} entradas{search && ` de ${displayEntries.length}`}</p>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800 z-10">
              <tr className="text-gray-500 text-xs border-b border-gray-700">
                <th className="text-left px-3 py-2.5 font-medium">Código</th>
                <th className="text-left px-3 py-2.5 font-medium">Descrição</th>
                <th className="text-left px-3 py-2.5 font-medium">Unidade</th>
                <th className="text-right px-3 py-2.5 font-medium">Custo Unit. (R$)</th>
                <th className="text-left px-3 py-2.5 font-medium">Categoria</th>
                {costBase === 'custom' && <th className="px-3 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-500 py-10">Nenhuma entrada encontrada.</td></tr>
              )}
              {costBase === 'custom' ? (
                <>
                  {(filtered as CustomBaseEntry[]).map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={(id, updates) => {
                        const store = useQuantitativosStore.getState()
                        const existing = store.customBase.find((e) => e.id === id)
                        if (existing) {
                          store.removeCustomEntry(id)
                          store.addCustomEntry({ ...existing, ...updates })
                        }
                      }}
                      onDelete={removeCustomEntry}
                    />
                  ))}
                  <AddEntryRow onAdd={addCustomEntry} />
                </>
              ) : (
                filtered.map((e) => (
                  <tr key={e.code} className="border-b border-gray-700/50 hover:bg-gray-750/20">
                    <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{e.code}</td>
                    <td className="px-3 py-2.5 text-gray-200">{e.description}</td>
                    <td className="px-3 py-2.5 text-gray-400">{e.unit}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmtBRL(e.unitCost)}</td>
                    <td className="px-3 py-2.5 text-gray-400">{e.category}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
