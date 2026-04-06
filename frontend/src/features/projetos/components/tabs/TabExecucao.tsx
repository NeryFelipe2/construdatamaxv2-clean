import { Pencil, AlertTriangle, User, ExternalLink } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import type { Project, ProjectPhase, ProjectPhaseStatus } from '@/types'

const TODAY = new Date()

const PHASE_STATUS_LABEL: Record<ProjectPhaseStatus, string> = {
  not_started: 'Não Iniciado',
  in_progress: 'Em Andamento',
  completed:   'Concluído',
  delayed:     'Atrasado',
}

const PHASE_STATUS_COLORS: Record<ProjectPhaseStatus, { text: string; bg: string; bar: string }> = {
  not_started: { text: 'text-[#6b6b6b]', bg: 'bg-[#6b6b6b]/10', bar: '#6b6b6b' },
  in_progress: { text: 'text-[#f97316]', bg: 'bg-[#f97316]/10', bar: '#f97316' },
  completed:   { text: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', bar: '#22c55e' },
  delayed:     { text: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', bar: '#ef4444' },
}

function PhaseCard({ phase, onEdit }: { phase: ProjectPhase; onEdit: () => void }) {
  const colors = PHASE_STATUS_COLORS[phase.status]
  const delayDays = phase.status === 'delayed' ? differenceInDays(TODAY, parseISO(phase.endDate)) : 0

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-semibold text-[#f5f5f5] leading-snug">{phase.name}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'text-[9px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide',
                colors.text, colors.bg
              )}
            >
              {PHASE_STATUS_LABEL[phase.status]}
            </span>
            {phase.responsible && (
              <span className="flex items-center gap-1 text-[9px] text-[#6b6b6b] bg-[#525252] px-1.5 py-0.5 rounded">
                <User size={8} />
                {phase.responsible}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
        >
          <Pencil size={12} />
        </button>
      </div>

      {phase.status === 'delayed' && delayDays > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-[#ef4444] bg-[#ef4444]/10 rounded-lg px-2 py-1">
          <AlertTriangle size={10} />
          <span>{delayDays} {delayDays === 1 ? 'dia' : 'dias'} de atraso</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#6b6b6b]">Progresso</span>
          <span className="text-[10px] font-mono font-semibold" style={{ color: colors.bar }}>
            {phase.progress}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#484848] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${phase.progress}%`, background: colors.bar }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Início</span>
          <span className="text-xs text-[#a3a3a3]">{phase.startDate}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Término</span>
          <span className="text-xs text-[#a3a3a3]">{phase.endDate}</span>
        </div>
      </div>

      {phase.notes && (
        <p className="text-[11px] text-[#6b6b6b] leading-relaxed line-clamp-3 border-t border-[#525252] pt-2">
          {phase.notes}
        </p>
      )}
    </div>
  )
}

export function TabExecucao({ project }: { project: Project }) {
  const setEditingPhase = useProjetosStore((s) => s.setEditingPhase)
  const reports         = useRelatorio360Store((s) => s.reports)
  const navigate        = useNavigate()

  const firstWord = project.name.split(/\s+/)[0].toLowerCase()
  const projectReports = Object.values(reports)
    .filter((r) => r.projectName.toLowerCase().includes(firstWord))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  function openReport(date: string) {
    useRelatorio360Store.getState().goToDate(date)
    navigate('/relatorio360')
  }

  return (
    <div className="p-5 overflow-y-auto h-full flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {project.executionPhases.map((phase) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            onEdit={() =>
              setEditingPhase({ projectId: project.id, group: 'execution', phaseId: phase.id })
            }
          />
        ))}
      </div>

      {/* ── Últimos RDOs vinculados ── */}
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Últimos Relatórios Diários
        </h3>
        {projectReports.length === 0 ? (
          <p className="text-xs text-[#6b6b6b]">Nenhum RDO vinculado a este projeto.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-xs border-collapse min-w-[360px]">
            <thead>
              <tr className="border-b border-[#525252]">
                {['Data', 'Atividades', 'Equipes', ''].map((col) => (
                  <th key={col} className="text-left text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold pb-2 pr-4 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3d3d]">
              {projectReports.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-[#3d3d3d]/50 transition-colors cursor-pointer"
                  onClick={() => openReport(r.date)}
                >
                  <td className="py-2 pr-4 text-[#a3a3a3] font-mono whitespace-nowrap">
                    {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-2 pr-4 text-[#f5f5f5]">{r.activities.length} atividade{r.activities.length !== 1 ? 's' : ''}</td>
                  <td className="py-2 pr-4 text-[#a3a3a3]">{r.crews.length} equipe{r.crews.length !== 1 ? 's' : ''}</td>
                  <td className="py-2">
                    <ExternalLink size={11} className="text-[#f97316]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}
