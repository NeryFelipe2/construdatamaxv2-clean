/**
 * PlanoContasPanel — Industrial Cost Plan with 4 pillars for the EVM module.
 * Sections: Material, Equipamentos, Mão de Obra, Impostos/Indiretos.
 */
import { useState } from 'react'
import { Plus, Trash2, Package, Wrench, Users, FileText, AlertTriangle, Info } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { useAppModeStore } from '@/store/appModeStore'
import { useProjectContext } from '@/store/projectContext'
import { usePlanoContasReal } from '@/hooks/usePlanoContasReal'
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

/**
 * PlanoContasPanel — decide entre o Plano de Contas mock (Modo Demo ligado,
 * com orçado × real completo) e o Plano de Contas real (Modo Demo desligado).
 */
export function PlanoContasPanel() {
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)

  if (isDemoMode) return <PlanoContasPanelMock />
  return <PlanoContasPanelReal activeProjectId={activeProjectId} />
}

function PlanoContasPanelMock() {
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

/* ─── Plano de Contas com dado real ───────────────────────────────────
 * Não existe orçamento detalhado por pilar em lugar nenhum hoje — `projetos`
 * só tem `orcamento_total` (um número único). Este bloco mostra SÓ o lado
 * REAL (despesas de `lancamentos_financeiros`, mapeadas por `categoria`
 * texto-livre para um dos 4 pilares) com aviso explícito da ausência do
 * orçado. Categorias que não batem no dicionário aparecem separadas, nunca
 * descartadas silenciosamente. */

const PILARES_REAL: { key: CostPillar; label: string; color: string; icon: typeof Package }[] = [
  { key: 'material', label: 'Material', color: '#38bdf8', icon: Package },
  { key: 'equipamento', label: 'Equipamentos', color: '#f97316', icon: Wrench },
  { key: 'mao_de_obra', label: 'Mão de Obra', color: '#22c55e', icon: Users },
  { key: 'impostos_indiretos', label: 'Impostos / Indiretos', color: '#a78bfa', icon: FileText },
]

function PlanoContasPanelReal({ activeProjectId }: { activeProjectId: string | null }) {
  const { porPilar, naoCategorizado, categoriasNaoMapeadas, total, temDados, loading, error } =
    usePlanoContasReal(activeProjectId)

  return (
    <div className="p-6 space-y-6">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5 flex items-start gap-3">
        <Info size={18} className="text-sky-400 shrink-0 mt-0.5" />
        <p className="text-[#a3a3a3] text-sm leading-relaxed">
          Este Plano de Contas mostra <b className="text-[#f5f5f5]">só o lado Real</b> (despesas lançadas na
          DRE, mapeadas pela categoria digitada em cada lançamento). <b className="text-amber-300">Orçamento
          detalhado por pilar não está cadastrado</b> — só o orçamento total do contrato (BAC) existe hoje.
          Para acompanhar orçado × real por pilar, seria preciso cadastrar essa quebra em uma tela nova.
        </p>
      </div>

      {!activeProjectId && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-200/90 text-xs leading-relaxed">Selecione um projeto ativo.</span>
        </div>
      )}

      {activeProjectId && !loading && !temDados && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-200/90 text-xs leading-relaxed">
            <b className="text-amber-300">Sem despesas reais suficientes para esta obra.</b> Nada aqui é
            estimado ou de exemplo. Lance despesas (DRE → Lançamento) para este projeto, ou ative o{' '}
            <b className="text-amber-300">Modo Demonstração</b> para ver um exemplo ilustrativo.
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-xs">
          {error}
        </div>
      )}

      {temDados && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-[#f5f5f5] text-sm font-semibold">Plano de Contas — Despesas Reais por Pilar</h2>
            <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-2">
              <span className="text-[#a3a3a3] text-xs mr-2">Total de Despesas</span>
              <span className="font-mono text-[#f97316] text-sm font-semibold">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PILARES_REAL.map((pillar) => {
              const Icon = pillar.icon
              const valor = porPilar[pillar.key]
              const pct = total > 0 ? (valor / total) * 100 : 0
              return (
                <div key={pillar.key} className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4" style={{ borderLeftWidth: 4, borderLeftColor: pillar.color }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${pillar.color}20` }}>
                      <Icon size={15} style={{ color: pillar.color }} />
                    </div>
                    <span className="text-[#f5f5f5] text-sm font-semibold">{pillar.label}</span>
                  </div>
                  <p className="font-mono text-lg font-semibold" style={{ color: pillar.color }}>{formatCurrency(valor)}</p>
                  <p className="text-[#6b6b6b] text-xs mt-1">{pct.toFixed(1)}% do total de despesas</p>
                </div>
              )
            })}
          </div>

          {naoCategorizado > 0 && (
            <div className="bg-[#3d3d3d] border border-amber-700/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-400 text-sm font-semibold">
                    Não categorizado — {formatCurrency(naoCategorizado)}
                  </p>
                  <p className="text-[#a3a3a3] text-xs mt-1">
                    Lançamentos cuja categoria não bate com nenhum dos 4 pilares (Material / Equipamento /
                    Mão de Obra / Impostos). Corrija a categoria do lançamento na DRE para incluir no pilar
                    correto.
                  </p>
                  {categoriasNaoMapeadas.length > 0 && (
                    <p className="text-[#6b6b6b] text-[10px] font-mono mt-2">
                      Categorias encontradas: {categoriasNaoMapeadas.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
