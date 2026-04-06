/**
 * HistoricoPanel — grid of saved budgets with load/delete actions.
 */
import { useState } from 'react'
import { Save, Trash2, FolderOpen } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const SOURCE_BADGE: Record<string, string> = {
  sinapi:  'bg-blue-900/50 text-blue-300',
  seinfra: 'bg-teal-900/50 text-teal-300',
  custom:  'bg-violet-900/50 text-violet-300',
  manual:  'bg-[#484848] text-[#a3a3a3]',
}

function SaveDialog({ onSave, onClose }: { onSave: (name: string, desc?: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')
  const inputCls = 'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-violet-500'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-white font-semibold text-sm">Salvar Orçamento Atual</h3>
        <div>
          <label className="block text-[#a3a3a3] text-xs mb-1">Nome *</label>
          <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Rede Pluvial Lote A" className={inputCls} />
        </div>
        <div>
          <label className="block text-[#a3a3a3] text-xs mb-1">Descrição (opcional)</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        </div>
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-[#484848] text-[#f5f5f5] text-sm hover:bg-[#525252]">Cancelar</button>
          <button onClick={() => { if (!name.trim()) { setErr('Nome obrigatório'); return } onSave(name.trim(), desc.trim() || undefined); onClose() }} className="px-4 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: '#8b5cf6' }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

export function HistoricoPanel() {
  const { savedBudgets, currentItems, loadBudget, deleteBudget, saveBudget, setActiveTab } = useQuantitativosStore()
  const [showSave, setShowSave] = useState(false)

  function handleLoad(id: string) {
    if (currentItems.length > 0 && !confirm('Carregar este orçamento substituirá a composição atual. Continuar?')) return
    loadBudget(id)
    setActiveTab('composicao')
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir este orçamento do histórico?')) return
    deleteBudget(id)
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-white font-semibold text-lg">Histórico de Orçamentos</h2>
        <button
          onClick={() => setShowSave(true)}
          disabled={currentItems.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#8b5cf6' }}
        >
          <Save size={14} />
          Salvar Orçamento Atual
        </button>
      </div>

      {savedBudgets.length === 0 && (
        <div className="text-center py-20 text-[#6b6b6b]">
          <p className="text-lg">Nenhum orçamento salvo.</p>
          <p className="text-sm mt-1">Crie itens na aba Composição e clique em "Salvar Orçamento Atual".</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {savedBudgets.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((budget) => (
          <div key={budget.id} className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-gray-100 font-semibold text-sm truncate">{budget.name}</h3>
                {budget.description && <p className="text-[#6b6b6b] text-xs mt-0.5 line-clamp-2">{budget.description}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${SOURCE_BADGE[budget.costBase] ?? 'bg-[#484848] text-[#a3a3a3]'}`}>
                {budget.costBase.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[#6b6b6b] text-xs">Total</p>
                <p className="text-violet-400 font-bold text-sm">{fmtBRL(budget.totalBRL)}</p>
              </div>
              <div>
                <p className="text-[#6b6b6b] text-xs">Itens</p>
                <p className="text-[#f5f5f5] font-semibold text-sm">{budget.items.length}</p>
              </div>
              <div>
                <p className="text-[#6b6b6b] text-xs">BDI Global</p>
                <p className="text-[#f5f5f5] text-sm">{budget.bdiGlobal}%</p>
              </div>
              <div>
                <p className="text-[#6b6b6b] text-xs">Ref.</p>
                <p className="text-[#f5f5f5] text-sm">{budget.referenceDate}</p>
              </div>
            </div>

            <p className="text-gray-600 text-xs">Atualizado {fmtDate(budget.updatedAt)}</p>

            <div className="flex items-center gap-2 mt-auto">
              <button
                onClick={() => handleLoad(budget.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white transition-colors"
                style={{ backgroundColor: '#8b5cf6' }}
              >
                <FolderOpen size={14} /> Carregar
              </button>
              <button
                onClick={() => handleDelete(budget.id)}
                className="p-2 rounded-lg bg-[#484848] hover:bg-red-900/30 text-[#a3a3a3] hover:text-red-300 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showSave && <SaveDialog onSave={saveBudget} onClose={() => setShowSave(false)} />}
    </div>
  )
}
