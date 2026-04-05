/**
 * PlanoContasPanel — Industrial Cost Plan with 4 pillars for the EVM module.
 * Sections: Material, Equipamentos, Mão de Obra, Impostos/Indiretos.
 */
import { useState } from 'react'
import { Plus, Trash2, Package, Wrench, Users, FileText } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { formatCurrency } from '@/lib/utils'
import type { CostPillar } from '@/types'

interface PillarConfig {
  key: CostPillar
  label: string
  color: string
  icon: typeof Package
}

const PILLARS: PillarConfig[] = [
  { key: 'material', label: 'Material', color: '#38bdf8', icon: Package },
  { key: 'equipamento', label: 'Equipamentos', color: '#f97316', icon: Wrench },
  { key: 'mao_de_obra', label: 'Mão de Obra', color: '#22c55e', icon: Users },
  { key: 'impostos_indiretos', label: 'Impostos / Indiretos', color: '#a78bfa', icon: FileText },
]

interface NewEntryForm {
  pillar: CostPillar
  description: string
  unitCostBRL: string
  quantity: string
  activityId: string
}

const EMPTY_FORM: NewEntryForm = {
  pillar: 'material',
  description: '',
  unitCostBRL: '',
  quantity: '',
  activityId: '',
}

export function PlanoContasPanel() {
  const { costAccounts, addCostAccount, removeCostAccount } = useEvmStore()
  const [addingPillar, setAddingPillar] = useState<CostPillar | null>(null)
  const [form, setForm] = useState<NewEntryForm>({ ...EMPTY_FORM })

  function entriesForPillar(pillar: CostPillar) {
    return costAccounts.filter((ca) => ca.pillar === pillar)
  }

  function pillarTotal(pillar: CostPillar) {
    return entriesForPillar(pillar).reduce((sum, ca) => sum + ca.totalCostBRL, 0)
  }

  const grandTotal = costAccounts.reduce((sum, ca) => sum + ca.totalCostBRL, 0)

  function openAddForm(pillar: CostPillar) {
    setAddingPillar(pillar)
    setForm({ ...EMPTY_FORM, pillar })
  }

  function handleAdd() {
    const unitCost = parseFloat(form.unitCostBRL)
    const qty = parseFloat(form.quantity)
    if (!form.description.trim() || isNaN(unitCost) || isNaN(qty)) return
    addCostAccount({
      activityId: form.activityId || crypto.randomUUID().slice(0, 8),
      pillar: form.pillar,
      description: form.description,
      unitCostBRL: unitCost,
      quantity: qty,
    })
    setAddingPillar(null)
    setForm({ ...EMPTY_FORM })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[#f5f5f5] text-sm font-semibold">Plano de Contas Industrial — 4 Pilares</h2>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-2">
          <span className="text-[#a3a3a3] text-xs mr-2">Total Geral</span>
          <span className="font-mono text-[#f97316] text-sm font-semibold">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      {PILLARS.map((pillar) => {
        const entries = entriesForPillar(pillar.key)
        const total = pillarTotal(pillar.key)
        const Icon = pillar.icon
        const isAdding = addingPillar === pillar.key

        return (
          <div key={pillar.key} className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
            {/* Section header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-[#525252]"
              style={{ borderLeftWidth: 4, borderLeftColor: pillar.color }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${pillar.color}20` }}
                >
                  <Icon size={15} style={{ color: pillar.color }} />
                </div>
                <span className="text-[#f5f5f5] text-sm font-semibold">{pillar.label}</span>
                <span className="text-[#6b6b6b] text-xs">({entries.length} itens)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold" style={{ color: pillar.color }}>
                  {formatCurrency(total)}
                </span>
                <button
                  onClick={() => openAddForm(pillar.key)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
                >
                  <Plus size={13} />
                  Adicionar
                </button>
              </div>
            </div>

            {/* Add form */}
            {isAdding && (
              <div className="px-4 py-3 bg-[#2c2c2c] border-b border-[#525252] space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-[#a3a3a3] text-xs block mb-1">Descrição</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
                      placeholder="Descrição do item"
                    />
                  </div>
                  <div>
                    <label className="text-[#a3a3a3] text-xs block mb-1">Custo Unit. (R$)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.unitCostBRL}
                      onChange={(e) => setForm({ ...form, unitCostBRL: e.target.value })}
                      className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] font-mono outline-none focus:border-[#f97316]"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="text-[#a3a3a3] text-xs block mb-1">Quantidade</label>
                    <input
                      type="number"
                      min={0}
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] font-mono outline-none focus:border-[#f97316]"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setAddingPillar(null); setForm({ ...EMPTY_FORM }) }}
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
            {entries.length === 0 ? (
              <div className="flex items-center justify-center h-[60px] text-[#6b6b6b] text-xs">
                Nenhum item nesta categoria.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#525252]/50">
                    <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2">Descrição</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2 w-32">Custo Unit.</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2 w-20">Qtd.</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2 w-36">Total</th>
                    <th className="text-center text-[#a3a3a3] text-xs font-medium px-4 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((ca) => (
                    <tr key={ca.id} className="border-b border-[#525252]/30 hover:bg-[#484848]/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="text-[#f5f5f5] text-sm">{ca.description}</span>
                        <span className="text-[#6b6b6b] text-[10px] font-mono ml-2">{ca.activityId}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#a3a3a3] text-sm">
                        {formatCurrency(ca.unitCostBRL)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#a3a3a3] text-sm">
                        {ca.quantity.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#f5f5f5] text-sm font-semibold">
                        {formatCurrency(ca.totalCostBRL)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => removeCostAccount(ca.id)}
                          className="text-[#6b6b6b] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#2c2c2c]/50">
                    <td colSpan={3} className="px-4 py-2.5 text-right text-[#a3a3a3] text-xs font-medium">
                      Subtotal {pillar.label}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold" style={{ color: pillar.color }}>
                      {formatCurrency(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}
