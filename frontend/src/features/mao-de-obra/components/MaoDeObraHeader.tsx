import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Users, Clock, ShieldCheck, AlertTriangle, MapPin } from 'lucide-react'
import { useMaoDeObraStore, type MaoDeObraTab } from '@/store/maoDeObraStore'
import { cn } from '@/lib/utils'

// Re-export so index.tsx can keep using this import path
export type { MaoDeObraTab } from '@/store/maoDeObraStore'

const TABS: Array<{ id: MaoDeObraTab; label: string }> = [
  { id: 'dashboard',     label: 'Dashboard'             },
  { id: 'funcionarios',  label: 'Funcionários'           },
  { id: 'escala',        label: 'Escala'                 },
  { id: 'postos',        label: 'Postos'                 },
  { id: 'cmo',           label: 'Custo Mensal'           },
  { id: 'faltas',        label: 'Faltas / Subs'          },
  { id: 'folha',         label: 'Folha de Pagamento'     },
  { id: 'rh-financeiro', label: 'RH Financeiro'          },
  { id: 'frotas',        label: 'Gestão de Frotas'       },
  { id: 'ausencias',     label: 'Calendário de Ausências'},
  { id: 'apontamentos',  label: 'Apontamentos'           },
  { id: 'escalamento',   label: 'Escalamento'            },
  { id: 'seguranca',     label: 'Segurança'              },
]

interface Props {
  activeTab: MaoDeObraTab
  onTabChange: (tab: MaoDeObraTab) => void
}

export function MaoDeObraHeader({ activeTab, onTabChange }: Props) {
  const { workers, shifts, absences, workPosts, violations } = useMaoDeObraStore(
    useShallow((s) => ({
      workers:    s.workers,
      shifts:     s.shifts,
      absences:   s.absences,
      workPosts:  s.workPosts,
      violations: s.violations,
    }))
  )

  const kpis = useMemo(() => {
    const today     = new Date().toISOString().slice(0, 10)
    const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10) })()

    const activeWorkers = workers.filter((w) => w.status === 'active').length

    // Absences this week (exclude vacations from "faltas" count)
    const faltasSemana = absences.filter(
      (a) => a.date >= weekStart && a.date <= today && a.type !== 'vacation',
    ).length

    // Overtime shifts this week — sum hours approximation
    const heShifts = shifts.filter((s) => s.type === 'overtime' && s.date >= weekStart && s.date <= today)
    const heHours  = heShifts.reduce((sum, s) => {
      const [sh, sm] = s.startTime.split(':').map(Number)
      const [eh, em] = s.endTime.split(':').map(Number)
      let h = (eh * 60 + em - sh * 60 - sm) / 60
      if (h < 0) h += 24
      return sum + Math.max(0, h - s.breakMinutes / 60)
    }, 0)

    // Posts uncovered today
    const todayActive = shifts.filter(
      (s) => s.date === today && s.status !== 'cancelled' && s.status !== 'absent',
    )
    const postosDesc = workPosts.filter((p) => {
      const covered = todayActive.filter((s) => s.workFront === p.workFront).length
      return covered < p.minWorkers
    }).length

    const cltViol = violations.length

    return [
      {
        label: 'Colaboradores Ativos',
        value: `${activeWorkers} / ${workers.length}`,
        icon:  Users,
        color: '#3b82f6',
      },
      {
        label: 'Faltas esta Semana',
        value: String(faltasSemana),
        icon:  AlertTriangle,
        color: faltasSemana === 0 ? '#22c55e' : faltasSemana <= 3 ? '#f59e0b' : '#ef4444',
      },
      {
        label: 'HE esta Semana',
        value: `${heHours.toFixed(1)}h`,
        icon:  Clock,
        color: heHours === 0 ? '#22c55e' : heHours <= 20 ? '#f59e0b' : '#ef4444',
      },
      {
        label: 'Postos Descobertos',
        value: String(postosDesc),
        icon:  MapPin,
        color: postosDesc === 0 ? '#22c55e' : '#ef4444',
      },
      {
        label: 'Violações CLT',
        value: String(cltViol),
        icon:  ShieldCheck,
        color: cltViol === 0 ? '#22c55e' : cltViol <= 3 ? '#f59e0b' : '#ef4444',
      },
    ] as const
  }, [workers, shifts, absences, workPosts, violations])

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-0">
      {/* Title row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#2abfdc]/15">
          <Users size={18} className="text-[#2abfdc]" />
        </div>
        <div>
          <h1 className="text-[#f5f5f5] text-lg font-semibold leading-none">Mão de Obra</h1>
          <p className="text-[#6b6b6b] text-xs mt-0.5">Gestão de equipes, frotas, ausências e folha de pagamento</p>
        </div>
      </div>

      {/* KPI cards — 2 cols on mobile, 5 on xl */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#14294e] border border-[#20406a] rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ backgroundColor: `${kpi.color}18` }}
            >
              <kpi.icon size={16} style={{ color: kpi.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[#6b6b6b] text-xs truncate">{kpi.label}</p>
              <p className="text-[#f5f5f5] text-lg font-bold leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar — scrollable */}
      <div className="flex gap-1 border-b border-[#20406a] -mb-px overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
              activeTab === tab.id
                ? 'border-[#2abfdc] text-[#2abfdc]'
                : 'border-transparent text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
