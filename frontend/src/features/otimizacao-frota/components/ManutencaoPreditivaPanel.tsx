import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { RefreshCw, AlertTriangle, Plus, Trash2, X } from 'lucide-react'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useThemeStore } from '@/store/themeStore'
import type { PredictiveHealth, HealthRisk } from '@/types'

// ─── Risk meta ────────────────────────────────────────────────────────────────

const RISK_META: Record<HealthRisk, { label: string; color: string; bg: string }> = {
  critical: { label: 'Crítico', color: '#ef4444', bg: '#ef444415' },
  high:     { label: 'Alto',    color: '#f97316', bg: '#f9731615' },
  medium:   { label: 'Médio',   color: '#eab308', bg: '#eab30815' },
  low:      { label: 'Baixo',   color: '#22c55e', bg: '#22c55e15' },
}

// ─── SVG arc health gauge ─────────────────────────────────────────────────────

function HealthGauge({ score, color }: { score: number; color: string }) {
  const theme = useThemeStore((s) => s.theme)
  const trackColor = theme === 'dark' ? '#525252' : '#e5e8ed'
  const textColor  = theme === 'dark' ? '#f5f5f5' : '#1a1d23'

  const r = 24
  const cx = 32
  const cy = 32
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth="6" />
      {/* Progress */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      {/* Score text */}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fill={textColor} fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">
        {score}
      </text>
    </svg>
  )
}

// ─── Health card ──────────────────────────────────────────────────────────────

function HealthCard({ h, onDelete }: { h: PredictiveHealth; onDelete: () => void }) {
  const meta = RISK_META[h.riskLevel]

  return (
    <div
      className="bg-[#3d3d3d] rounded-xl p-4 flex gap-4 relative"
      style={{ border: `1px solid ${meta.color}30` }}
    >
      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-[#6b6b6b] hover:text-[#ef4444] hover:bg-[#ef444415] transition-colors"
        title="Excluir equipamento"
      >
        <Trash2 size={12} />
      </button>

      <HealthGauge score={h.healthScore} color={meta.color} />

      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-mono text-xs font-bold text-[#f97316]">{h.equipmentCode}</span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#525252] text-[#6b6b6b]"
          >
            {h.predictedFailureWindow}
          </span>
        </div>
        <p className="text-[#f5f5f5] text-sm font-medium mb-1.5 truncate">{h.equipmentName}</p>

        {/* Main factors */}
        <ul className="flex flex-col gap-0.5 mb-2">
          {h.mainFactors.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[#6b6b6b] text-xs">
              <span className="mt-0.5 shrink-0" style={{ color: meta.color }}>•</span>
              {f}
            </li>
          ))}
        </ul>

        {/* Recommended action */}
        <p className="text-xs font-medium" style={{ color: meta.color }}>{h.recommendedAction}</p>

        {/* Cost/downtime */}
        <div className="flex gap-3 mt-1.5 text-xs text-[#6b6b6b]">
          <span>Parada estimada: <span className="text-[#f5f5f5]">{h.estimatedDowntimeDays}d</span></span>
          <span>Custo estimado: <span className="text-[#f5f5f5]">R${h.estimatedRepairCostBRL.toLocaleString('pt-BR')}</span></span>
        </div>
      </div>
    </div>
  )
}

// ─── Maintenance input dialog ─────────────────────────────────────────────────

interface MaintenanceFormState {
  name:          string
  code:          string
  lastMaint:     string
  nextMaint:     string
  year:          string
  criticalAlerts: string
  warningAlerts:  string
  repairCost:    string
}

const EMPTY_MAINTENANCE_FORM: MaintenanceFormState = {
  name:           '',
  code:           '',
  lastMaint:      '',
  nextMaint:      '',
  year:           String(new Date().getFullYear() - 5),
  criticalAlerts: '0',
  warningAlerts:  '0',
  repairCost:     '0',
}

function MaintenanceInputDialog({ onClose }: { onClose: () => void }) {
  const addHealthScore = useOtimizacaoFrotaStore((s) => s.addHealthScore)
  const [form, setForm] = useState<MaintenanceFormState>(EMPTY_MAINTENANCE_FORM)

  const labelClass = 'block text-xs font-medium text-[#6b6b6b] mb-1'
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-[#525252] bg-[#333333] text-[#f5f5f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#f97316]'

  function handleSave() {
    addHealthScore({
      name:           form.name.trim() || 'Novo Equipamento',
      code:           form.code.trim() || 'EQ-000',
      lastMaint:      form.lastMaint || new Date().toISOString().slice(0, 10),
      nextMaint:      form.nextMaint || undefined,
      year:           Number(form.year) || new Date().getFullYear() - 5,
      criticalAlerts: Number(form.criticalAlerts) || 0,
      warningAlerts:  Number(form.warningAlerts) || 0,
      repairCost:     Number(form.repairCost) || 0,
    })
    onClose()
  }

  function set(key: keyof MaintenanceFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[#f5f5f5] text-base font-semibold">Adicionar Equipamento</p>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Equipment Name */}
          <div>
            <label className={labelClass}>Nome do Equipamento</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ex: Escavadeira CAT 320"
            />
          </div>

          {/* Equipment Code */}
          <div>
            <label className={labelClass}>Código do Equipamento</label>
            <input
              className={inputClass}
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              placeholder="Ex: EQ-042"
            />
          </div>

          {/* Last Maintenance Date */}
          <div>
            <label className={labelClass}>Data da Última Manutenção</label>
            <input
              type="date"
              className={inputClass}
              value={form.lastMaint}
              onChange={(e) => set('lastMaint', e.target.value)}
            />
          </div>

          {/* Next Maintenance Date */}
          <div>
            <label className={labelClass}>Data da Próxima Manutenção (opcional)</label>
            <input
              type="date"
              className={inputClass}
              value={form.nextMaint}
              onChange={(e) => set('nextMaint', e.target.value)}
            />
          </div>

          {/* Year Manufactured */}
          <div>
            <label className={labelClass}>Ano de Fabricação</label>
            <input
              type="number"
              className={inputClass}
              value={form.year}
              onChange={(e) => set('year', e.target.value)}
              placeholder={String(new Date().getFullYear() - 5)}
              min={1970}
              max={new Date().getFullYear()}
            />
          </div>

          {/* Critical Alerts */}
          <div>
            <label className={labelClass}>Alertas Críticos</label>
            <input
              type="number"
              className={inputClass}
              value={form.criticalAlerts}
              onChange={(e) => set('criticalAlerts', e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>

          {/* Warning Alerts */}
          <div>
            <label className={labelClass}>Alertas de Aviso</label>
            <input
              type="number"
              className={inputClass}
              value={form.warningAlerts}
              onChange={(e) => set('warningAlerts', e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>

          {/* Estimated Repair Cost */}
          <div>
            <label className={labelClass}>Custo de Reparo Estimado (R$)</label>
            <input
              type="number"
              className={inputClass}
              value={form.repairCost}
              onChange={(e) => set('repairCost', e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#f97316] hover:bg-[#ea580c] text-white transition-colors"
          >
            Salvar
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ManutencaoPreditivaPanel() {
  const { healthScores, runHealthEngine, deleteHealthScore } = useOtimizacaoFrotaStore(
    useShallow((s) => ({
      healthScores:    s.healthScores,
      runHealthEngine: s.runHealthEngine,
      deleteHealthScore: s.deleteHealthScore,
    }))
  )

  const [dialogOpen, setDialogOpen] = useState(false)

  const critical = healthScores.filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high')
  const others   = healthScores.filter((h) => h.riskLevel === 'medium' || h.riskLevel === 'low')
  const sorted   = [...critical.sort((a, b) => a.healthScore - b.healthScore), ...others.sort((a, b) => a.healthScore - b.healthScore)]

  return (
    <div className="flex flex-col gap-4">
      {/* Engine button */}
      <div className="flex items-center justify-between">
        <p className="text-[#f5f5f5] text-sm font-semibold">
          Saúde da Frota ({healthScores.length} equipamentos)
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-semibold transition-colors"
          >
            <Plus size={13} /> Adicionar Equipamento
          </button>
          <button
            onClick={runHealthEngine}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-xs font-medium hover:bg-[#484848] transition-colors"
          >
            <RefreshCw size={13} /> Rodar Engine
          </button>
        </div>
      </div>

      {/* Priority queue alert */}
      {critical.length > 0 && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl p-3 flex gap-3">
          <AlertTriangle size={16} className="text-[#ef4444] shrink-0 mt-0.5" />
          <div>
            <p className="text-[#ef4444] text-sm font-semibold mb-1">
              {critical.length} equipamento{critical.length !== 1 ? 's' : ''} com risco crítico ou alto
            </p>
            <p className="text-[#6b6b6b] text-xs">
              {critical.map((h) => h.equipmentCode).join(', ')} — intervenção imediata recomendada
            </p>
          </div>
        </div>
      )}

      {/* Health cards grid */}
      {sorted.length === 0 ? (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-6 text-center">
          <p className="text-[#6b6b6b] text-sm">Clique em "Rodar Engine" para calcular os scores.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sorted.map((h) => (
            <HealthCard
              key={h.equipmentId}
              h={h}
              onDelete={() => deleteHealthScore(h.equipmentId)}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <MaintenanceInputDialog onClose={() => setDialogOpen(false)} />
      )}
    </div>
  )
}
