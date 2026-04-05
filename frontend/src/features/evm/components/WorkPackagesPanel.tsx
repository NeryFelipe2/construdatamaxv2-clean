/**
 * WorkPackagesPanel — Work Package Library for the EVM module.
 * Grid of expandable cards showing work packages with cost accounts & measurements.
 */
import { useState } from 'react'
import { Plus, Copy, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import type { WorkPackage } from '@/types'

const PILLAR_COLORS: Record<string, string> = {
  material: '#38bdf8',
  equipamento: '#f97316',
  mao_de_obra: '#22c55e',
  impostos_indiretos: '#a78bfa',
}

const PILLAR_LABELS: Record<string, string> = {
  material: 'Material',
  equipamento: 'Equipamento',
  mao_de_obra: 'Mão de Obra',
  impostos_indiretos: 'Impostos',
}

export function WorkPackagesPanel() {
  const { workPackages, addWorkPackage } = useEvmStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newWp, setNewWp] = useState({ code: '', name: '', description: '', isTemplate: false })

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function handleAdd() {
    if (!newWp.name.trim() || !newWp.code.trim()) return
    addWorkPackage({
      code: newWp.code,
      name: newWp.name,
      description: newWp.description,
      costAccounts: [],
      measurements: [],
      totalBudgetBRL: 0,
      isTemplate: newWp.isTemplate,
    })
    setNewWp({ code: '', name: '', description: '', isTemplate: false })
    setShowNewForm(false)
  }

  function handleClone(wp: WorkPackage) {
    addWorkPackage({
      code: `${wp.code}-CLONE`,
      name: `${wp.name} (cópia)`,
      description: wp.description,
      costAccounts: wp.costAccounts.map((ca) => ({ ...ca, id: crypto.randomUUID() })),
      measurements: wp.measurements.map((m) => ({ ...m, id: crypto.randomUUID() })),
      totalBudgetBRL: wp.totalBudgetBRL,
      isTemplate: false,
    })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[#f5f5f5] text-sm font-semibold">Biblioteca de Work Packages</h2>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
        >
          <Plus size={15} />
          Novo Pacote
        </button>
      </div>

      {/* New WP form */}
      {showNewForm && (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 space-y-3">
          <p className="text-[#f5f5f5] text-sm font-semibold">Novo Work Package</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[#a3a3a3] text-xs block mb-1">Código</label>
              <input
                type="text"
                value={newWp.code}
                onChange={(e) => setNewWp({ ...newWp, code: e.target.value })}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] font-mono outline-none focus:border-[#f97316]"
                placeholder="WP-XXX-01"
              />
            </div>
            <div>
              <label className="text-[#a3a3a3] text-xs block mb-1">Nome</label>
              <input
                type="text"
                value={newWp.name}
                onChange={(e) => setNewWp({ ...newWp, name: e.target.value })}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
                placeholder="Nome do pacote"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newWp.isTemplate}
                  onChange={(e) => setNewWp({ ...newWp, isTemplate: e.target.checked })}
                  className="w-4 h-4 rounded border-[#525252] accent-[#f97316]"
                />
                <span className="text-[#a3a3a3] text-sm">Template</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-[#a3a3a3] text-xs block mb-1">Descrição</label>
            <textarea
              value={newWp.description}
              onChange={(e) => setNewWp({ ...newWp, description: e.target.value })}
              rows={2}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316] resize-none"
              placeholder="Descrição do pacote de trabalho"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowNewForm(false); setNewWp({ code: '', name: '', description: '', isTemplate: false }) }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
            >
              Criar Pacote
            </button>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {workPackages.length === 0 ? (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl flex items-center justify-center h-[200px] text-[#6b6b6b] text-sm">
          Nenhum work package cadastrado. Clique em &quot;Carregar Demo&quot; ou crie um novo.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {workPackages.map((wp) => {
            const isExpanded = expandedId === wp.id
            return (
              <div
                key={wp.id}
                className={cn(
                  'bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden transition-all',
                  isExpanded && 'lg:col-span-2 xl:col-span-3',
                )}
              >
                {/* Card header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-[#f97316] shrink-0" />
                      <span className="font-mono text-xs text-[#a3a3a3]">{wp.code}</span>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-medium px-2 py-0.5 rounded-full',
                        wp.isTemplate
                          ? 'bg-green-900/40 text-green-400'
                          : 'bg-blue-900/40 text-blue-400',
                      )}
                    >
                      {wp.isTemplate ? 'Template' : 'Instância'}
                    </span>
                  </div>

                  <h3 className="text-[#f5f5f5] text-sm font-semibold mb-1">{wp.name}</h3>
                  <p className="text-[#6b6b6b] text-xs line-clamp-2 mb-3">{wp.description}</p>

                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[#f97316] text-sm font-semibold">
                      {formatCurrency(wp.totalBudgetBRL)}
                    </span>
                    <div className="flex items-center gap-2">
                      {wp.isTemplate && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleClone(wp) }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
                        >
                          <Copy size={12} />
                          Clonar
                        </button>
                      )}
                      <button
                        onClick={() => toggleExpand(wp.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {isExpanded ? 'Recolher' : 'Detalhes'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[#525252] bg-[#2c2c2c] p-4 space-y-4">
                    {/* Cost accounts */}
                    <div>
                      <p className="text-[#a3a3a3] text-xs font-medium mb-2">Contas de Custo ({wp.costAccounts.length})</p>
                      {wp.costAccounts.length === 0 ? (
                        <p className="text-[#6b6b6b] text-xs">Nenhuma conta de custo vinculada.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[#525252]/50">
                                <th className="text-left text-[#a3a3a3] font-medium px-3 py-1.5">Pilar</th>
                                <th className="text-left text-[#a3a3a3] font-medium px-3 py-1.5">Descrição</th>
                                <th className="text-right text-[#a3a3a3] font-medium px-3 py-1.5">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {wp.costAccounts.map((ca) => (
                                <tr key={ca.id} className="border-b border-[#525252]/20">
                                  <td className="px-3 py-1.5">
                                    <span
                                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor: `${PILLAR_COLORS[ca.pillar]}20`,
                                        color: PILLAR_COLORS[ca.pillar],
                                      }}
                                    >
                                      {PILLAR_LABELS[ca.pillar]}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-[#f5f5f5]">{ca.description}</td>
                                  <td className="px-3 py-1.5 text-right font-mono text-[#f5f5f5]">
                                    {formatCurrency(ca.totalCostBRL)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Measurements */}
                    <div>
                      <p className="text-[#a3a3a3] text-xs font-medium mb-2">Medições ({wp.measurements.length})</p>
                      {wp.measurements.length === 0 ? (
                        <p className="text-[#6b6b6b] text-xs">Nenhuma medição vinculada.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {wp.measurements.map((m) => (
                            <div key={m.id} className="bg-[#3d3d3d] rounded-lg p-2.5">
                              <p className="text-[#f5f5f5] text-xs font-medium">{m.activityName}</p>
                              <p className="text-[#6b6b6b] text-[10px] font-mono mt-0.5">
                                Score: <span className="text-[#f97316]">{m.compositeScore.toFixed(3)}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-[#6b6b6b] text-[10px]">
                      Criado em {new Date(wp.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
