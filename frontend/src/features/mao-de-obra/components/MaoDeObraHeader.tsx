/**
 * MaoDeObraHeader — top bar no molde EvmHeader (4 faixas: título, KPIs, abas).
 * KPIs seguem o contrato de honestidade: `value: null` = insumo real ausente →
 * mostra "—" cinza com a razão em `note`. Nunca exibe 0 fingindo dado calculado.
 */
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Users } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import type { MaoDeObraTab } from '@/store/maoDeObraStore'
import { cn } from '@/lib/utils'

// Re-export so callers can keep using this import path
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

/**
 * KpiCard — aceita `value: null` = insumo real ausente: mostra "—" cinza
 * (#6b6b6b) com a razão em `note`. Nunca exibe 0 fingindo dado calculado
 * quando a fonte ainda não foi conectada.
 */
function KpiCard({
  label,
  value,
  color,
  note,
}: {
  label: string
  value: string | null
  color?: string
  note?: string
}) {
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[140px]" title={value == null ? note : undefined}>
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      <p className="font-mono text-lg font-semibold" style={{ color: value == null ? '#6b6b6b' : color ?? '#f5f5f5' }}>
        {value ?? '—'}
      </p>
      {value == null && note && (
        <p className="text-[#6b6b6b] text-[9px] mt-0.5 leading-tight">{note}</p>
      )}
    </div>
  )
}

export function MaoDeObraHeader() {
  const { activeTab, setActiveTab, workers, shifts, absences, workPosts, violations, cltSettings } = useMaoDeObraStore(
    useShallow((s) => ({
      activeTab:    s.activeTab,
      setActiveTab: s.setActiveTab,
      workers:      s.workers,
      shifts:       s.shifts,
      absences:     s.absences,
      workPosts:    s.workPosts,
      violations:   s.violations,
      cltSettings:  s.cltSettings,
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

    // Contrato de honestidade: mock vazio → null (travessão + nota), não "0".
    const semFonte    = workers.length === 0
    const cltZerado   = cltSettings.maxDailyHours === 0 && cltSettings.maxWeeklyHours === 0
    const cltViol     = violations.length

    return [
      {
        label: 'Colaboradores Ativos',
        value: semFonte ? null : `${activeWorkers} / ${workers.length}`,
        color: '#3b82f6',
        note:  'nenhum funcionário carregado — fonte real ainda não conectada',
      },
      {
        label: 'Faltas esta Semana',
        value: semFonte ? null : String(faltasSemana),
        color: faltasSemana === 0 ? '#22c55e' : faltasSemana <= 3 ? '#f59e0b' : '#ef4444',
        note:  'sem apontamentos de ausência — fonte real ainda não conectada',
      },
      {
        label: 'HE esta Semana',
        value: semFonte ? null : `${heHours.toFixed(1)}h`,
        color: heHours === 0 ? '#22c55e' : heHours <= 20 ? '#f59e0b' : '#ef4444',
        note:  'sem turnos lançados — fonte real ainda não conectada',
      },
      {
        label: 'Postos Descobertos',
        value: workPosts.length === 0 ? null : String(postosDesc),
        color: postosDesc === 0 ? '#22c55e' : '#ef4444',
        note:  'nenhum posto de trabalho cadastrado',
      },
      {
        label: 'Violações CLT',
        value: cltZerado ? null : String(cltViol),
        color: cltViol === 0 ? '#22c55e' : cltViol <= 3 ? '#f59e0b' : '#ef4444',
        note:  'parâmetros CLT não configurados',
      },
    ]
  }, [workers, shifts, absences, workPosts, violations, cltSettings])

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Title row */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <Users size={20} className="text-[#ffffff]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-semibold text-lg leading-tight">
              Mão de Obra
            </h1>
            <p className="text-[#a3a3a3] text-xs">
              Gestão de equipes, frotas, ausências e folha de pagamento
              <span className="ml-2 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold bg-[#484848] text-[#a3a3a3]">Local</span>
            </p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} color={kpi.color} note={kpi.note} />
        ))}
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2',
                  isActive
                    ? 'text-[#f5f5f5] border-orange-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
