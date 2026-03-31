import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useGestao360Store } from '@/store/gestao360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { useThemeStore } from '@/store/themeStore'
import type { BudgetLineType } from '@/types'

// ─── Budget line labels + colors ─────────────────────────────────────────────

const LINE_META: Record<BudgetLineType, { label: string; color: string }> = {
  labor:       { label: 'Mão de Obra',  color: '#3b82f6' },
  equipment:   { label: 'Equipamentos', color: '#2abfdc' },
  materials:   { label: 'Materiais',    color: '#22c55e' },
  subcontract: { label: 'Subcontratos', color: '#a855f7' },
  overhead:    { label: 'Overhead',     color: '#eab308' },
  other:       { label: 'Outros',       color: '#6b6b6b' },
}

// ─── Phase status meta ────────────────────────────────────────────────────────

const PHASE_STATUS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Não iniciada', color: '#6b6b6b' },
  in_progress: { label: 'Em andamento', color: '#3b82f6' },
  completed:   { label: 'Concluída',    color: '#22c55e' },
  delayed:     { label: 'Atrasada',     color: '#ef4444' },
}

// ─── SVG arc gauge ─────────────────────────────────────────────────────────────

function IndexGauge({ value, label }: { value: number; label: string }) {
  const isDark = useThemeStore((s) => s.theme === 'dark')
  const color  = value >= 0.9 ? '#22c55e' : value >= 0.7 ? '#eab308' : '#ef4444'
  const track  = isDark ? '#20406a' : '#e5e8ed'
  const textC  = isDark ? '#f5f5f5' : '#1a1d23'
  const clamped = Math.min(1.5, Math.max(0, value))
  const r = 28; const cx = 36; const cy = 36
  const circ = 2 * Math.PI * r
  const filled = (Math.min(clamped, 1) / 1) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth="7" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fill={textC} fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">
          {value.toFixed(2)}
        </text>
      </svg>
      <span className="text-[#6b6b6b] text-[11px] font-medium">{label}</span>
      <span className="text-xs font-bold" style={{ color }}>
        {value >= 0.9 ? 'Bom' : value >= 0.7 ? 'Atenção' : 'Crítico'}
      </span>
    </div>
  )
}

// ─── Horizontal bar for one budget line ──────────────────────────────────────

function BudgetBar({ type, budgeted, spent, projected }: { type: BudgetLineType; budgeted: number; spent: number; projected: number }) {
  const meta = LINE_META[type] ?? LINE_META.other
  const max  = Math.max(budgeted, projected, 1)

  const budgetedW  = (budgeted  / max) * 100
  const spentW     = (spent     / max) * 100
  const projectedW = (projected / max) * 100

  const isOver = projected > budgeted

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-[#6b6b6b] text-xs shrink-0 text-right truncate">{meta.label}</span>
      <div className="flex-1 flex flex-col gap-1">
        {/* Orçado */}
        <div className="flex items-center gap-2">
          <div className="w-10 text-[#6b6b6b] text-[10px] shrink-0">Orç.</div>
          <div className="flex-1 h-3 bg-[#14294e] rounded overflow-hidden">
            <div className="h-full rounded" style={{ width: `${budgetedW}%`, backgroundColor: meta.color, opacity: 0.4 }} />
          </div>
          <span className="w-16 text-[#6b6b6b] text-[10px] font-mono text-right">
            R${(budgeted / 1000).toFixed(0)}k
          </span>
        </div>
        {/* Realizado */}
        <div className="flex items-center gap-2">
          <div className="w-10 text-[#6b6b6b] text-[10px] shrink-0">Real.</div>
          <div className="flex-1 h-3 bg-[#14294e] rounded overflow-hidden">
            <div className="h-full rounded" style={{ width: `${spentW}%`, backgroundColor: meta.color }} />
          </div>
          <span className="w-16 text-[#f5f5f5] text-[10px] font-mono text-right font-semibold">
            R${(spent / 1000).toFixed(0)}k
          </span>
        </div>
        {/* Projetado (EAC) */}
        <div className="flex items-center gap-2">
          <div className="w-10 text-[#6b6b6b] text-[10px] shrink-0">EAC</div>
          <div className="flex-1 h-3 bg-[#14294e] rounded overflow-hidden">
            <div
              className="h-full rounded"
              style={{ width: `${projectedW}%`, backgroundColor: isOver ? '#ef4444' : '#22c55e', opacity: 0.7 }}
            />
          </div>
          <span
            className="w-16 text-[10px] font-mono text-right font-semibold"
            style={{ color: isOver ? '#ef4444' : '#22c55e' }}
          >
            R${(projected / 1000).toFixed(0)}k
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function JobCostingPanel() {
  const selectedProjectId = useGestao360Store((s) => s.selectedProjectId)
  const projects          = useProjetosStore((s) => s.projects)

  const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null

  if (!project) {
    return (
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-8 text-center">
        <p className="text-[#6b6b6b] text-sm">Selecione um projeto para ver o custo em tempo real.</p>
      </div>
    )
  }

  const lines      = project.budgetLines
  const budgeted   = lines.reduce((s, l) => s + l.budgeted, 0)
  const spent      = lines.reduce((s, l) => s + l.spent, 0)
  const eac        = lines.reduce((s, l) => s + l.projected, 0)
  const variance   = eac - budgeted
  const variancePct = budgeted > 0 ? (variance / budgeted) * 100 : 0

  // SPI/CPI
  const execPhases = project.executionPhases
  const avgProgress = execPhases.length
    ? execPhases.reduce((s, p) => s + p.progress, 0) / execPhases.length
    : 0
  const today  = new Date()
  const start  = new Date(project.startDate + 'T00:00:00')
  const end    = new Date(project.endDate   + 'T00:00:00')
  const totalMs   = Math.max(1, end.getTime() - start.getTime())
  const elapsedMs = Math.min(totalMs, Math.max(0, today.getTime() - start.getTime()))
  const plannedPct = (elapsedMs / totalMs) * 100

  const spi = plannedPct > 0 ? avgProgress / plannedPct : 1
  const cpi = spent > 0 ? (budgeted * (avgProgress / 100)) / spent : 1

  const allPhases = [...project.planningPhases, ...project.executionPhases]

  return (
    <div className="flex flex-col gap-5">
      {/* EAC summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Orçado (BAC)',       value: `R$${(budgeted / 1_000_000).toFixed(2)}M`, color: '#6b6b6b' },
          { label: 'Realizado (AC)',      value: `R$${(spent / 1_000_000).toFixed(2)}M`,    color: '#3b82f6' },
          { label: 'EAC Projetado',       value: `R$${(eac    / 1_000_000).toFixed(2)}M`,  color: eac <= budgeted ? '#22c55e' : '#ef4444' },
          {
            label: 'Variação de Custo',
            value: `${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)}%`,
            color: Math.abs(variancePct) <= 5 ? '#22c55e' : Math.abs(variancePct) <= 15 ? '#eab308' : '#ef4444',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#14294e] border border-[#20406a] rounded-xl px-4 py-3">
            <p className="text-[#6b6b6b] text-xs">{kpi.label}</p>
            <p className="text-xl font-bold leading-tight mt-0.5" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Budget waterfall */}
        <div className="lg:col-span-2 bg-[#14294e] border border-[#20406a] rounded-xl p-4">
          <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Custo por Categoria</p>
          <div className="flex flex-col gap-3">
            {lines.map((l) => (
              <BudgetBar
                key={l.id}
                type={l.type}
                budgeted={l.budgeted}
                spent={l.spent}
                projected={l.projected}
              />
            ))}
          </div>
          <div className="flex gap-4 mt-3 pt-3 border-t border-[#20406a]">
            {[
              { label: 'Orçado', color: '#6b6b6b', opacity: 0.4 },
              { label: 'Realizado', color: '#2abfdc', opacity: 1 },
              { label: 'EAC', color: '#22c55e', opacity: 0.7 },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded" style={{ backgroundColor: l.color, opacity: l.opacity }} />
                <span className="text-[#6b6b6b] text-[10px]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CPI/SPI gauges */}
        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 flex flex-col">
          <p className="text-[#f5f5f5] text-sm font-semibold mb-4">Índices de Desempenho</p>
          <div className="flex gap-4 justify-center flex-1 items-center">
            <IndexGauge value={cpi} label="CPI (Custo)" />
            <IndexGauge value={spi} label="SPI (Prazo)" />
          </div>
          <p className="text-[#6b6b6b] text-[10px] text-center mt-3">
            CPI = EV/AC · SPI = EV/PV · Referência: ≥0.9 bom
          </p>
        </div>
      </div>

      {/* Phase progress table */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#f5f5f5] text-sm font-semibold">Progresso das Fases</p>
          <Link
            to="/projetos"
            className="flex items-center gap-1 text-[#2abfdc] text-xs font-medium hover:underline"
          >
            <ExternalLink size={11} /> Ver em Projetos
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {allPhases.map((phase) => {
            const meta = PHASE_STATUS[phase.status] ?? PHASE_STATUS.not_started
            const endD   = new Date(phase.endDate   + 'T00:00:00')
            const isLate = phase.status !== 'completed' && endD < today
            const daysLeft = Math.round((endD.getTime() - today.getTime()) / 86_400_000)

            return (
              <div key={phase.id} className="flex items-center gap-3">
                <span className="w-32 text-[#f5f5f5] text-xs truncate shrink-0">{phase.name}</span>
                <div className="flex-1 h-2 bg-[#14294e] rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{ width: `${phase.progress}%`, backgroundColor: meta.color }}
                  />
                </div>
                <span className="w-8 text-[#6b6b6b] text-[10px] text-right">{phase.progress}%</span>
                <span
                  className="w-20 px-2 py-0.5 rounded text-[10px] font-bold text-center shrink-0"
                  style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
                >
                  {meta.label}
                </span>
                <span className="w-20 text-[10px] text-right shrink-0" style={{ color: isLate ? '#ef4444' : '#6b6b6b' }}>
                  {phase.status === 'completed'
                    ? endD.toLocaleDateString('pt-BR')
                    : isLate
                    ? `${Math.abs(daysLeft)}d atraso`
                    : daysLeft >= 0
                    ? `${daysLeft}d restam`
                    : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
