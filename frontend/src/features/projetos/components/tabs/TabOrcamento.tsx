import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import type { Project, BudgetLineType } from '@/types'

const TYPE_LABEL: Record<BudgetLineType, string> = {
  labor:       'Mão de Obra',
  equipment:   'Equipamentos',
  materials:   'Materiais',
  subcontract: 'Subcontratado',
  overhead:    'Custos Fixos',
  other:       'Outros',
}

function UtilBar({ pct }: { pct: number }) {
  const color = pct > 90 ? '#ef4444' : pct > 75 ? '#2abfdc' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#1a3662] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function SummaryCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl border border-[#20406a] bg-[#14294e]">
      <span className="text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">{label}</span>
      <span className={cn('text-base font-bold font-mono', highlight ? 'text-[#2abfdc]' : 'text-[#f5f5f5]')}>
        {value}
      </span>
    </div>
  )
}

export function TabOrcamento({ project }: { project: Project }) {
  const setEditingBudgetLine = useProjetosStore((s) => s.setEditingBudgetLine)
  const deleteBudgetLine     = useProjetosStore((s) => s.deleteBudgetLine)
  const currentItems         = useQuantitativosStore((s) => s.currentItems)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const totalBudgeted  = project.budgetLines.reduce((s, l) => s + l.budgeted,  0)
  const totalProjected = project.budgetLines.reduce((s, l) => s + l.projected, 0)
  const totalSpent     = project.budgetLines.reduce((s, l) => s + l.spent,     0)
  const utilPct        = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0

  const projectFirstWord   = project.code.toLowerCase()
  const linkedQuantitativos = currentItems.filter((item) =>
    item.description.toLowerCase().includes(projectFirstWord) ||
    item.category.toLowerCase().includes(projectFirstWord) ||
    item.notes?.toLowerCase().includes(projectFirstWord)
  )

  function handleDelete(lineId: string) {
    if (confirmDeleteId !== lineId) { setConfirmDeleteId(lineId); return }
    deleteBudgetLine(project.id, lineId)
    setConfirmDeleteId(null)
  }

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto h-full">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCell label="Total Orçado"    value={formatCurrency(totalBudgeted)}  highlight />
        <SummaryCell label="Total Projetado" value={formatCurrency(totalProjected)} />
        <SummaryCell label="Total Gasto"     value={formatCurrency(totalSpent)} />
        <SummaryCell label="Utilização"      value={`${utilPct.toFixed(1)}%`} highlight={utilPct > 75} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#20406a] overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#20406a] bg-[#0d2040]">
              <th className="text-left px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">Tipo</th>
              <th className="text-left px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">Descrição</th>
              <th className="text-right px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">Orçado</th>
              <th className="text-right px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">Projetado</th>
              <th className="text-right px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">Gasto</th>
              <th className="text-right px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">Saldo</th>
              <th className="px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]" style={{ minWidth: 120 }}>Utilização</th>
              <th className="px-2 py-2.5" style={{ width: 64 }} />
            </tr>
          </thead>
          <tbody>
            {project.budgetLines.map((line, i) => {
              const saldo   = line.budgeted - line.spent
              const linePct = line.budgeted > 0 ? (line.spent / line.budgeted) * 100 : 0
              const isLast  = i === project.budgetLines.length - 1

              return (
                <tr
                  key={line.id}
                  className={cn(
                    'transition-colors',
                    !isLast && 'border-b border-[#14294e]',
                    hoveredId === line.id ? 'bg-[#1a3662]' : 'bg-[#112645]'
                  )}
                  onMouseEnter={() => setHoveredId(line.id)}
                  onMouseLeave={() => { setHoveredId(null); if (confirmDeleteId === line.id) setConfirmDeleteId(null) }}
                >
                  <td className="px-4 py-3 text-[#a3a3a3] whitespace-nowrap">{TYPE_LABEL[line.type]}</td>
                  <td className="px-4 py-3 text-[#f5f5f5]">{line.description}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#a3a3a3]">{formatCurrency(line.budgeted)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#a3a3a3]">{formatCurrency(line.projected)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#f5f5f5]">{formatCurrency(line.spent)}</td>
                  <td className={cn('px-4 py-3 text-right font-mono', saldo < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]')}>
                    {formatCurrency(saldo)}
                  </td>
                  <td className="px-4 py-3" style={{ minWidth: 120 }}>
                    <UtilBar pct={linePct} />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {confirmDeleteId === line.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(line.id)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] font-semibold hover:bg-[#ef4444]/30"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a3662] text-[#a3a3a3] hover:bg-[#20406a]"
                          >
                            Não
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingBudgetLine({ projectId: project.id, lineId: line.id })}
                            className="w-6 h-6 flex items-center justify-center rounded text-[#6b6b6b] hover:text-[#2abfdc] hover:bg-[#2abfdc]/10 transition-colors"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => handleDelete(line.id)}
                            className="w-6 h-6 flex items-center justify-center rounded text-[#6b6b6b] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {project.budgetLines.length === 0 && (
          <div className="py-10 text-center text-xs text-[#3f3f3f]">
            Nenhuma linha orçamentária cadastrada
          </div>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={() => setEditingBudgetLine({ projectId: project.id, lineId: 'new' })}
        className="self-start flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#2abfdc] transition-colors border border-dashed border-[#20406a] hover:border-[#2abfdc]/30 rounded-lg px-3 py-2"
      >
        <Plus size={12} />
        Adicionar Linha
      </button>

      {/* ── Quantitativos Vinculados ── */}
      <div className="border-t border-[#20406a] pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] mb-3">
          Quantitativos Vinculados
        </h3>
        {linkedQuantitativos.length === 0 ? (
          <p className="text-xs text-[#3f3f3f]">Sem quantitativos vinculados a este projeto.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#20406a]">
                {['Descrição', 'Unid', 'Qtd', 'Custo Unit.', 'Total'].map((col) => (
                  <th key={col} className="text-left text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold pb-2 pr-4 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#14294e]">
              {linkedQuantitativos.map((item) => (
                <tr key={item.id} className="hover:bg-[#14294e]/50 transition-colors">
                  <td className="py-2 pr-4 text-[#f5f5f5]">{item.description}</td>
                  <td className="py-2 pr-4 text-[#6b6b6b]">{item.unit}</td>
                  <td className="py-2 pr-4 text-[#a3a3a3] font-mono">{item.quantity.toLocaleString('pt-BR')}</td>
                  <td className="py-2 pr-4 text-[#a3a3a3] font-mono">{formatCurrency(item.unitCost)}</td>
                  <td className="py-2 text-[#2abfdc] font-semibold font-mono">{formatCurrency(item.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
