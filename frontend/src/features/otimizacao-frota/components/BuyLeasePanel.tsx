import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { RefreshCw, TrendingDown, TrendingUp, Minus, Pencil, Trash2, Plus, X } from 'lucide-react'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import type { BuyLeaseAnalysis, BuyLeaseRec } from '@/types'

// ─── Recommendation meta ──────────────────────────────────────────────────────

const REC_META: Record<BuyLeaseRec, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  buy:     { label: 'COMPRAR', color: '#22c55e', bg: '#22c55e15', Icon: TrendingDown  },
  lease:   { label: 'ALUGAR',  color: '#3b82f6', bg: '#3b82f615', Icon: TrendingUp   },
  neutral: { label: 'NEUTRO',  color: '#6b6b6b', bg: '#6b6b6b15', Icon: Minus        },
}

// ─── Cost comparison bar ──────────────────────────────────────────────────────

function CostComparisonBar({ analysis }: { analysis: BuyLeaseAnalysis }) {
  const max = Math.max(analysis.annualRentalCostBRL, analysis.annualOwnershipCostBRL, 1)
  const rentalPct   = (analysis.annualRentalCostBRL   / max) * 100
  const ownershipPct = (analysis.annualOwnershipCostBRL / max) * 100

  // Break-even marker position (% of the longer bar duration context, capped 10-90)
  const breakEvenPct = Math.min(90, Math.max(10, (analysis.breakEvenMonths / 120) * 100))

  return (
    <div className="flex flex-col gap-2 mt-3">
      {/* Rental bar */}
      <div className="flex items-center gap-2">
        <span className="w-28 text-[#6b6b6b] text-xs shrink-0 text-right">Custo Aluguel/ano</span>
        <div className="flex-1 h-5 bg-[#112645] rounded overflow-hidden relative">
          <div
            className="h-full rounded transition-all duration-500"
            style={{ width: `${rentalPct}%`, backgroundColor: '#3b82f6' }}
          />
          {/* break-even marker on rental bar */}
          <div
            className="absolute top-0 h-full w-[2px] bg-[#2abfdc] opacity-70"
            style={{ left: `${breakEvenPct}%` }}
          />
        </div>
        <span className="w-20 text-[#f5f5f5] text-xs shrink-0 font-mono">
          R${(analysis.annualRentalCostBRL / 1000).toFixed(0)}k
        </span>
      </div>

      {/* Ownership bar */}
      <div className="flex items-center gap-2">
        <span className="w-28 text-[#6b6b6b] text-xs shrink-0 text-right">Custo Propriedade/ano</span>
        <div className="flex-1 h-5 bg-[#112645] rounded overflow-hidden relative">
          <div
            className="h-full rounded transition-all duration-500"
            style={{ width: `${ownershipPct}%`, backgroundColor: '#22c55e' }}
          />
          <div
            className="absolute top-0 h-full w-[2px] bg-[#2abfdc] opacity-70"
            style={{ left: `${breakEvenPct}%` }}
          />
        </div>
        <span className="w-20 text-[#f5f5f5] text-xs shrink-0 font-mono">
          R${(analysis.annualOwnershipCostBRL / 1000).toFixed(0)}k
        </span>
      </div>

      {/* Break-even label */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="w-3 h-[2px] bg-[#2abfdc]" />
        <span className="text-[#2abfdc] text-[10px]">
          Break-even: {analysis.breakEvenMonths} meses
          {analysis.breakEvenMonths <= 36
            ? ' — payback rápido'
            : analysis.breakEvenMonths <= 60
            ? ' — payback moderado'
            : ' — payback longo'}
        </span>
      </div>
    </div>
  )
}

// ─── Dialog form state ────────────────────────────────────────────────────────

interface DialogFormState {
  equipmentType:          string
  currentStatus:          'owned' | 'rented' | 'none'
  purchasePriceBRL:       string
  monthlyRentalCostBRL:   string
  annualMaintenanceCostBRL: string
  residualValueBRL:       string
  projectedUsageDays:     string
  relatedProjects:        string
  bimPhases:              string
}

const EMPTY_FORM: DialogFormState = {
  equipmentType:            '',
  currentStatus:            'none',
  purchasePriceBRL:         '',
  monthlyRentalCostBRL:     '',
  annualMaintenanceCostBRL: '',
  residualValueBRL:         '',
  projectedUsageDays:       '',
  relatedProjects:          '',
  bimPhases:                '',
}

function analysisToForm(a: BuyLeaseAnalysis): DialogFormState {
  return {
    equipmentType:            a.equipmentType,
    currentStatus:            a.currentStatus,
    purchasePriceBRL:         String(a.purchasePriceBRL),
    monthlyRentalCostBRL:     String(a.monthlyRentalCostBRL),
    annualMaintenanceCostBRL: String(a.annualMaintenanceCostBRL),
    residualValueBRL:         String(a.residualValueBRL),
    projectedUsageDays:       String(a.projectedUsageDays),
    relatedProjects:          a.relatedProjects.join(', '),
    bimPhases:                a.bimPhases.join(', '),
  }
}

// ─── Buy/Lease dialog ─────────────────────────────────────────────────────────

interface BuyLeaseDialogProps {
  editTarget: BuyLeaseAnalysis | null
  onClose: () => void
}

function BuyLeaseDialog({ editTarget, onClose }: BuyLeaseDialogProps) {
  const { addBuyLeaseAnalysis, updateBuyLeaseAnalysis } = useOtimizacaoFrotaStore(
    useShallow((s) => ({
      addBuyLeaseAnalysis:    s.addBuyLeaseAnalysis,
      updateBuyLeaseAnalysis: s.updateBuyLeaseAnalysis,
    }))
  )

  const [form, setForm] = useState<DialogFormState>(
    editTarget ? analysisToForm(editTarget) : EMPTY_FORM
  )

  const labelClass = 'block text-xs font-medium text-[#6b6b6b] mb-1'
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-[#20406a] bg-[#112645] text-[#f5f5f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#2abfdc]'

  function handleSave() {
    const data: Omit<BuyLeaseAnalysis, 'id'> = {
      equipmentType:            form.equipmentType.trim() || 'Novo Equipamento',
      currentStatus:            form.currentStatus,
      purchasePriceBRL:         Number(form.purchasePriceBRL) || 0,
      monthlyRentalCostBRL:     Number(form.monthlyRentalCostBRL) || 0,
      annualMaintenanceCostBRL: Number(form.annualMaintenanceCostBRL) || 0,
      residualValueBRL:         Number(form.residualValueBRL) || 0,
      projectedUsageDays:       Number(form.projectedUsageDays) || 0,
      relatedProjects:          form.relatedProjects.split(',').map((s) => s.trim()).filter(Boolean),
      bimPhases:                form.bimPhases.split(',').map((s) => s.trim()).filter(Boolean),
      // These will be recomputed in the store action:
      annualRentalCostBRL:    0,
      annualOwnershipCostBRL: 0,
      breakEvenMonths:        0,
      recommendation:         'neutral',
      reasoning:              '',
    }

    if (editTarget) {
      updateBuyLeaseAnalysis(editTarget.id, data)
    } else {
      addBuyLeaseAnalysis(data)
    }
    onClose()
  }

  function set(key: keyof DialogFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d2040] border border-[#20406a] rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[#f5f5f5] text-base font-semibold">
            {editTarget ? 'Editar Análise' : 'Nova Análise'}
          </p>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Equipment Type */}
          <div>
            <label className={labelClass}>Tipo de Equipamento</label>
            <input
              className={inputClass}
              value={form.equipmentType}
              onChange={(e) => set('equipmentType', e.target.value)}
              placeholder="Ex: Escavadeira Hidráulica"
            />
          </div>

          {/* Current Status */}
          <div>
            <label className={labelClass}>Status Atual</label>
            <select
              className={inputClass}
              value={form.currentStatus}
              onChange={(e) => set('currentStatus', e.target.value as 'owned' | 'rented' | 'none')}
            >
              <option value="owned">Frota própria</option>
              <option value="rented">Alugado</option>
              <option value="none">Sem ativo</option>
            </select>
          </div>

          {/* Purchase Price */}
          <div>
            <label className={labelClass}>Preço de Compra (R$)</label>
            <input
              type="number"
              className={inputClass}
              value={form.purchasePriceBRL}
              onChange={(e) => set('purchasePriceBRL', e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>

          {/* Monthly Rental Cost */}
          <div>
            <label className={labelClass}>Custo Mensal de Aluguel (R$)</label>
            <input
              type="number"
              className={inputClass}
              value={form.monthlyRentalCostBRL}
              onChange={(e) => set('monthlyRentalCostBRL', e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>

          {/* Annual Maintenance Cost */}
          <div>
            <label className={labelClass}>Custo Anual de Manutenção (R$)</label>
            <input
              type="number"
              className={inputClass}
              value={form.annualMaintenanceCostBRL}
              onChange={(e) => set('annualMaintenanceCostBRL', e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>

          {/* Residual Value */}
          <div>
            <label className={labelClass}>Valor Residual (R$)</label>
            <input
              type="number"
              className={inputClass}
              value={form.residualValueBRL}
              onChange={(e) => set('residualValueBRL', e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>

          {/* Projected Usage Days */}
          <div>
            <label className={labelClass}>
              Dias de Uso Projetados / ano
              <span className="ml-1 text-[#2abfdc] font-normal">(≥180 = comprar · ≤60 = alugar)</span>
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.projectedUsageDays}
              onChange={(e) => set('projectedUsageDays', e.target.value)}
              placeholder="0"
              min={0}
              max={365}
            />
          </div>

          {/* Related Projects */}
          <div>
            <label className={labelClass}>Projetos Relacionados (separados por vírgula)</label>
            <input
              className={inputClass}
              value={form.relatedProjects}
              onChange={(e) => set('relatedProjects', e.target.value)}
              placeholder="Ex: Obra A, Obra B"
            />
          </div>

          {/* BIM Phases */}
          <div>
            <label className={labelClass}>Fases BIM (separadas por vírgula)</label>
            <input
              className={inputClass}
              value={form.bimPhases}
              onChange={(e) => set('bimPhases', e.target.value)}
              placeholder="Ex: Fundação, Estrutura"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#2abfdc] hover:bg-[#1a9ab8] text-white transition-colors"
          >
            Salvar
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium border border-[#20406a] text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Analysis card ────────────────────────────────────────────────────────────

function BuyLeaseCard({
  a,
  onEdit,
  onDelete,
}: {
  a: BuyLeaseAnalysis
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = REC_META[a.recommendation]
  const { Icon } = meta

  const savingsDelta = Math.abs(a.annualRentalCostBRL - a.annualOwnershipCostBRL)

  return (
    <div
      className="bg-[#14294e] rounded-xl p-4 relative"
      style={{ border: `1px solid ${meta.color}30` }}
    >
      {/* Edit / Delete buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-[#6b6b6b] hover:text-[#2abfdc] hover:bg-[#20406a] transition-colors"
          title="Editar"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-[#6b6b6b] hover:text-[#ef4444] hover:bg-[#ef444415] transition-colors"
          title="Excluir"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-1 pr-16">
        <div>
          <p className="text-[#f5f5f5] text-sm font-semibold">{a.equipmentType}</p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            Status atual:&nbsp;
            <span className="text-[#f5f5f5]">
              {a.currentStatus === 'owned' ? 'Frota própria' : a.currentStatus === 'rented' ? 'Alugado' : 'Sem ativo'}
            </span>
            &nbsp;·&nbsp;
            {a.projectedUsageDays} dias/ano projetados
          </p>
        </div>

        {/* Recommendation badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0"
          style={{ backgroundColor: meta.bg, border: `1px solid ${meta.color}40` }}
        >
          <Icon size={14} style={{ color: meta.color }} />
          <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
        </div>
      </div>

      {/* Cost comparison */}
      <CostComparisonBar analysis={a} />

      {/* Savings delta */}
      <p className="text-xs text-[#6b6b6b] mt-2">
        Diferença anual:&nbsp;
        <span className="font-semibold" style={{ color: meta.color }}>
          R${savingsDelta.toLocaleString('pt-BR')}
        </span>
        &nbsp;a favor de&nbsp;
        <span style={{ color: meta.color }}>
          {a.recommendation === 'buy' ? 'comprar' : a.recommendation === 'lease' ? 'alugar' : 'neutro'}
        </span>
      </p>

      {/* Reasoning */}
      <p className="text-[#6b6b6b] text-xs leading-relaxed mt-2 mb-3 border-t border-[#20406a] pt-2">
        {a.reasoning}
      </p>

      {/* BIM 5D phases + related projects */}
      <div className="flex flex-col gap-1.5">
        {a.bimPhases.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#6b6b6b] text-[10px] shrink-0">BIM 5D:</span>
            {a.bimPhases.map((phase) => (
              <span
                key={phase}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#3b82f6]/15 text-[#3b82f6]"
              >
                {phase}
              </span>
            ))}
          </div>
        )}
        {a.relatedProjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#6b6b6b] text-[10px] shrink-0">Projetos:</span>
            {a.relatedProjects.map((proj) => (
              <span
                key={proj}
                className="px-2 py-0.5 rounded text-[10px] bg-[#20406a] text-[#6b6b6b]"
              >
                {proj}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Summary KPI bar ──────────────────────────────────────────────────────────

function SummaryKPIs({ analyses }: { analyses: BuyLeaseAnalysis[] }) {
  const totalMonthlyRental = analyses
    .filter((a) => a.currentStatus === 'rented')
    .reduce((sum, a) => sum + a.monthlyRentalCostBRL, 0)

  const projectedAnnualSavings = analyses.reduce((sum, a) => {
    if (a.recommendation === 'buy')   return sum + (a.annualRentalCostBRL - a.annualOwnershipCostBRL)
    if (a.recommendation === 'lease') return sum + (a.annualOwnershipCostBRL - a.annualRentalCostBRL)
    return sum
  }, 0)

  const buyCount     = analyses.filter((a) => a.recommendation === 'buy').length
  const leaseCount   = analyses.filter((a) => a.recommendation === 'lease').length
  const neutralCount = analyses.filter((a) => a.recommendation === 'neutral').length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        {
          label: 'Gasto Mensal em Aluguel',
          value: totalMonthlyRental > 0 ? `R$${(totalMonthlyRental / 1000).toFixed(0)}k` : '—',
          color: '#ef4444',
        },
        {
          label: 'Economia Anual Projetada',
          value: projectedAnnualSavings > 0 ? `R$${(projectedAnnualSavings / 1000).toFixed(0)}k` : '—',
          color: '#22c55e',
        },
        {
          label: 'Recomendação Comprar',
          value: String(buyCount),
          color: '#22c55e',
        },
        {
          label: 'Recomendação Alugar',
          value: String(leaseCount + neutralCount),
          color: '#3b82f6',
        },
      ].map((kpi) => (
        <div
          key={kpi.label}
          className="bg-[#14294e] border border-[#20406a] rounded-xl px-4 py-3"
        >
          <p className="text-[#6b6b6b] text-xs">{kpi.label}</p>
          <p className="text-lg font-bold leading-tight mt-0.5" style={{ color: kpi.color }}>
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function BuyLeasePanel() {
  const { buyLeaseAnalyses, runBuyLeaseEngine, deleteBuyLeaseAnalysis } = useOtimizacaoFrotaStore(
    useShallow((s) => ({
      buyLeaseAnalyses:      s.buyLeaseAnalyses,
      runBuyLeaseEngine:     s.runBuyLeaseEngine,
      deleteBuyLeaseAnalysis: s.deleteBuyLeaseAnalysis,
    }))
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BuyLeaseAnalysis | null>(null)

  function openAdd() {
    setEditTarget(null)
    setDialogOpen(true)
  }

  function openEdit(a: BuyLeaseAnalysis) {
    setEditTarget(a)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#f5f5f5] text-sm font-semibold">
            Análise Comprar vs Alugar — BIM 5D
          </p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            Decisão financeira baseada na demanda projetada da carteira de projetos
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2abfdc] hover:bg-[#1a9ab8] text-white text-xs font-semibold transition-colors"
          >
            <Plus size={13} /> Nova Análise
          </button>
          <button
            onClick={runBuyLeaseEngine}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-xs font-medium hover:bg-[#1a3662] transition-colors"
          >
            <RefreshCw size={13} /> Rodar Engine
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {buyLeaseAnalyses.length > 0 && <SummaryKPIs analyses={buyLeaseAnalyses} />}

      {/* Analysis cards */}
      {buyLeaseAnalyses.length === 0 ? (
        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-6 text-center">
          <p className="text-[#6b6b6b] text-sm">
            Clique em "Nova Análise" ou "Rodar Engine" para calcular a análise financeira.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {buyLeaseAnalyses.map((a) => (
            <BuyLeaseCard
              key={a.id}
              a={a}
              onEdit={() => openEdit(a)}
              onDelete={() => deleteBuyLeaseAnalysis(a.id)}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <BuyLeaseDialog editTarget={editTarget} onClose={closeDialog} />
      )}
    </div>
  )
}
