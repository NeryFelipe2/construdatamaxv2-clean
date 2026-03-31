import { Pencil, DollarSign, TrendingUp, BarChart2, CalendarClock } from 'lucide-react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { StatCard } from '@/components/shared/StatCard'
import { useProjetosStore } from '@/store/projetosStore'
import type { Project, ProjectPhase, ProjectPhaseStatus, ProjectStatus } from '@/types'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active:    'Ativo',
  planning:  'Planejamento',
  completed: 'Concluído',
  on_hold:   'Em Espera',
}

const STATUS_COLOR: Record<ProjectStatus, string> = {
  active:    'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20',
  planning:  'text-[#2abfdc] bg-[#2abfdc]/10 border-[#2abfdc]/20',
  completed: 'text-[#a3a3a3] bg-[#a3a3a3]/10 border-[#a3a3a3]/20',
  on_hold:   'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20',
}

const PHASE_STATUS_COLOR: Record<ProjectPhaseStatus, string> = {
  not_started: '#6b6b6b',
  in_progress: '#2abfdc',
  completed:   '#22c55e',
  delayed:     '#ef4444',
}

function PhaseBar({ phase }: { phase: ProjectPhase }) {
  const color = PHASE_STATUS_COLOR[phase.status]
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#a3a3a3] truncate max-w-[140px]">{phase.name}</span>
        <span className="text-[10px] font-mono" style={{ color }}>{phase.progress}%</span>
      </div>
      <div className="h-1 rounded-full bg-[#1a3662] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${phase.progress}%`, background: color }} />
      </div>
    </div>
  )
}

export function TabVisaoGeral({ project }: { project: Project }) {
  const setEditingProject = useProjetosStore((s) => s.setEditingProject)

  const totalBudgeted  = project.budgetLines.reduce((s, l) => s + l.budgeted, 0)
  const totalProjected = project.budgetLines.reduce((s, l) => s + l.projected, 0)
  const totalSpent     = project.budgetLines.reduce((s, l) => s + l.spent, 0)
  const utilPct        = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0

  let daysLeft = 0
  try {
    daysLeft = differenceInCalendarDays(parseISO(project.endDate), new Date())
  } catch { /* ignore */ }

  return (
    <div className="flex flex-col gap-5 p-5 overflow-y-auto h-full">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Orçado"       value={formatCurrency(totalBudgeted)}  icon={DollarSign}   accent />
        <StatCard label="Gasto Projetado"    value={formatCurrency(totalProjected)} icon={TrendingUp}   />
        <StatCard label="Utilização"         value={`${utilPct}%`}                  icon={BarChart2}    accent={utilPct > 75} />
        <StatCard label="Dias Restantes"     value={daysLeft > 0 ? String(daysLeft) : '—'}
                  sub={daysLeft > 0 ? 'dias' : 'encerrado'}                         icon={CalendarClock} />
      </div>

      {/* Project info card */}
      <div className="rounded-xl border border-[#20406a] bg-[#14294e] p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-[#6b6b6b] bg-[#1a3662] px-2 py-0.5 rounded">
                {project.code}
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide',
                  STATUS_COLOR[project.status]
                )}
              >
                {STATUS_LABEL[project.status]}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#f5f5f5] leading-snug mt-1">{project.name}</h2>
          </div>
          <button
            onClick={() => setEditingProject(project.id)}
            className="shrink-0 flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#2abfdc] transition-colors border border-[#20406a] hover:border-[#2abfdc]/30 rounded-lg px-3 py-2"
          >
            <Pencil size={12} />
            Editar Projeto
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <InfoRow label="Dono"    value={project.owner} />
          <InfoRow label="Gerente" value={project.manager} />
          <InfoRow label="Início"  value={project.startDate} />
          <InfoRow label="Término" value={project.endDate} />
        </div>

        {project.description && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[#6b6b6b]">Descrição</span>
            <p className="text-sm text-[#a3a3a3] leading-relaxed">{project.description}</p>
          </div>
        )}
      </div>

      {/* Phase summary */}
      <div className="grid grid-cols-2 gap-4">
        <PhaseGroup title="Planejamento" phases={project.planningPhases} />
        <PhaseGroup title="Execução"     phases={project.executionPhases} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-[#6b6b6b]">{label}</span>
      <span className="text-sm text-[#f5f5f5]">{value}</span>
    </div>
  )
}

function PhaseGroup({ title, phases }: { title: string; phases: ProjectPhase[] }) {
  return (
    <div className="rounded-xl border border-[#20406a] bg-[#14294e] p-4 flex flex-col gap-3">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-[#6b6b6b] border-b border-[#20406a] pb-2">
        {title}
      </span>
      {phases.map((ph) => <PhaseBar key={ph.id} phase={ph} />)}
    </div>
  )
}
