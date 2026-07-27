/**
 * LookAheadPanel — look-ahead de 6 semanas do LPS, 100% dado real.
 *
 * Duas metades (27/07/2026, Fase 2 LPS-real):
 *  1. GRADE INTERATIVA (trechos × 6 semanas): células vêm das atividades do
 *     store (persistidas em `lps_tasks` no Supabase) — clicar planeja/conclui/
 *     remove de verdade (CRUD do lpsStore). Nenhuma linha é gerada aqui.
 *  2. LOOKAHEAD DERIVADO DO PLANEJAMENTO REAL — três fontes, cada bloco
 *     declara a sua e mostra vazio honesto quando não há dado na janela:
 *      a) deriveLookahead(masterEngine) sobre o cronograma mestre REAL
 *         (useMasterScheduleEngine: planejamento_itens + rdos do projeto);
 *      b) agenda_tasks — tarefas da Agenda/Gantt que tocam a janela de 6
 *         semanas;
 *      c) programacao_semana — o previsto da semana mais recente montado com
 *         a gestão (frente → equipe → serviço + meta).
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, X, Minus } from 'lucide-react'
import { useLpsStore, computeWeeklyPPC, weekLabel, weekOffset, isoWeek } from '@/store/lpsStore'
import { useProjectContext } from '@/store/projectContext'
import { useMasterScheduleEngine } from '@/hooks/useMasterScheduleEngine'
import { useProgramacaoSemana } from '@/hooks/useProgramacaoSemana'
import { carregarAgendaTasks } from '@/hooks/useAgendaSupabase'
import { deriveLookahead } from '@/features/planejamento-mestre/utils/masterEngine'
import type { AgendaTask, LookaheadDerivedActivity, LpsActivity } from '@/types'

const TEAM_COLORS: Record<string, string> = {
  'Equipe A': '#3b82f6',
  'Equipe B': '#8b5cf6',
  'Equipe C': '#10b981',
  'Equipe D': '#f59e0b',
}

function teamColor(team?: string): string {
  if (!team) return '#4b5563'
  return TEAM_COLORS[team] ?? '#6366f1'
}

const DERIVED_STATUS_META: Record<LookaheadDerivedActivity['status'], { rotulo: string; cor: string }> = {
  planned:   { rotulo: 'PLANEJADA', cor: '#3b82f6' },
  ready:     { rotulo: 'PRONTA',    cor: '#22c55e' },
  blocked:   { rotulo: 'BLOQUEADA', cor: '#ef4444' },
  completed: { rotulo: 'CONCLUÍDA', cor: '#64748b' },
}

export function LookAheadPanel() {
  const activities     = useLpsStore((s) => s.activities)
  const updateActivity = useLpsStore((s) => s.updateActivity)
  const addActivity    = useLpsStore((s) => s.addActivity)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)

  // Fontes reais do lookahead derivado
  const engine = useMasterScheduleEngine(activeProjectId)
  const programacao = useProgramacaoSemana()
  const [agendaTasks, setAgendaTasks] = useState<AgendaTask[]>([])

  useEffect(() => {
    let cancelado = false
    void carregarAgendaTasks().then((tasks) => {
      if (!cancelado) setAgendaTasks(tasks)
    })
    return () => { cancelado = true }
  }, [])

  const today = new Date()
  const hojeIso = today.toISOString().slice(0, 10)

  // 6 future weeks starting from current week
  const weeks = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => weekOffset(today, i))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Derivação do mestre real (janela de 6 semanas a partir de hoje).
  // MasterActivityLike é estruturalmente compatível com MasterActivity.
  const derivadas = useMemo(
    () => deriveLookahead(engine.activities, hojeIso, 6),
    [engine.activities, hojeIso],
  )

  const derivadasPorSemana = useMemo(() => {
    const map = new Map<string, LookaheadDerivedActivity[]>()
    for (const d of derivadas) {
      const lista = map.get(d.weekIso) ?? []
      lista.push(d)
      map.set(d.weekIso, lista)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [derivadas])

  // agenda_tasks que tocam a janela [hoje, hoje+6 semanas)
  const agendaNaJanela = useMemo(() => {
    const fim = new Date(today)
    fim.setDate(fim.getDate() + 6 * 7)
    const fimIso = fim.toISOString().slice(0, 10)
    return agendaTasks
      .filter((t) => t.startDate <= fimIso && t.endDate >= hojeIso)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaTasks, hojeIso])

  // All unique trecho codes from activities
  const trechos = useMemo(() => {
    const codes = [...new Set(activities.map((a) => ({
      code: a.trechoCode,
      desc: a.description,
      team: a.responsibleTeam,
    })))]
    // Deduplicate by code
    const seen = new Set<string>()
    return codes.filter((c) => {
      if (seen.has(c.code)) return false
      seen.add(c.code)
      return true
    }).sort((a, b) => a.code.localeCompare(b.code))
  }, [activities])

  // Weekly PPC for header row
  const weekly = useMemo(() => computeWeeklyPPC(activities), [activities])

  function getCellActivity(code: string, week: string): LpsActivity | undefined {
    return activities.find((a) => a.trechoCode === code && a.week === week)
  }

  function handleCellClick(code: string, week: string, team?: string) {
    const existing = getCellActivity(code, week)
    if (existing) {
      // Cycle: planned → completed → not planned → planned
      if (!existing.completed) {
        updateActivity(existing.id, { completed: true, readyStatus: 'green' })
      } else {
        // remove
        useLpsStore.getState().removeActivity(existing.id)
      }
    } else {
      // Create new planned activity
      addActivity({
        week,
        trechoCode: code,
        description: trechos.find((t) => t.code === code)?.desc ?? code,
        planned: true,
        completed: false,
        readyStatus: 'green',
        responsibleTeam: team,
      })
    }
  }

  const ppcByWeek = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of weekly) map.set(w.week, w.ppc)
    return map
  }, [weekly])

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Look-ahead — Próximas 6 Semanas</p>
          <p className="text-xs text-[#6b6b6b] mt-0.5">Clique em uma célula para planejar / marcar como concluído / remover</p>
          <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mt-0.5">TABELA lps_tasks (grade) · planejamento_itens+rdos · agenda_tasks · programacao_semana</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#6b6b6b]">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-blue-600 inline-block" /> Planejado
          </span>
          <span className="flex items-center gap-1.5">
            <Check size={12} className="text-green-400" /> Concluído
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-[#3d3d3d] border border-[#525252] inline-block" /> Não planejado
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-[#3d3d3d] overflow-hidden overflow-x-auto">
        <table className="text-xs w-full">
          {/* Header */}
          <thead className="bg-[#3d3d3d]/80">
            <tr>
              <th className="text-left text-[#a3a3a3] px-4 py-3 font-semibold w-32 sticky left-0 bg-[#3d3d3d]/80 border-r border-[#525252]">
                Trecho
              </th>
              {weeks.map((w) => {
                const ppc = ppcByWeek.get(w)
                const isCurrentWeek = w === isoWeek(today)
                return (
                  <th key={w} className={`text-center px-2 py-3 font-semibold min-w-[80px] ${isCurrentWeek ? 'text-orange-400' : 'text-[#a3a3a3]'}`}>
                    <div>{weekLabel(w)}</div>
                    {ppc !== undefined && (
                      <div className={`text-[10px] font-normal mt-0.5 ${ppc >= 80 ? 'text-green-400' : ppc >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                        PPC {ppc}%
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#3d3d3d]">
            {trechos.map((t) => (
              <tr key={t.code} className="bg-[#2c2c2c] hover:bg-[#3d3d3d]/30 transition-colors">
                {/* Trecho label */}
                <td className="px-4 py-2.5 sticky left-0 bg-[#2c2c2c] border-r border-[#3d3d3d] z-10">
                  <div className="text-white font-semibold text-xs">{t.code}</div>
                  <div className="text-[#6b6b6b] text-[10px] truncate max-w-[110px]">{t.desc}</div>
                  {t.team && (
                    <div
                      className="text-[10px] font-medium mt-0.5"
                      style={{ color: teamColor(t.team) }}
                    >
                      {t.team}
                    </div>
                  )}
                </td>

                {/* Week cells */}
                {weeks.map((w) => {
                  const cell = getCellActivity(t.code, w)
                  const isCurrentWeek = w === isoWeek(today)
                  const color = teamColor(t.team)

                  return (
                    <td key={w} className={`px-2 py-1.5 text-center ${isCurrentWeek ? 'bg-orange-900/10' : ''}`}>
                      <button
                        onClick={() => handleCellClick(t.code, w, t.team)}
                        className="w-full h-10 rounded-md flex items-center justify-center transition-all"
                        style={
                          cell?.planned && !cell.completed
                            ? { backgroundColor: color + '33', border: `1px solid ${color}66` }
                            : cell?.completed
                              ? { backgroundColor: '#15803d33', border: '1px solid #16a34a66' }
                              : { backgroundColor: '#1f2937', border: '1px solid #374151' }
                        }
                        title={
                          cell?.completed ? 'Concluído — clique para remover'
                          : cell?.planned  ? 'Planejado — clique para marcar como concluído'
                          : 'Não planejado — clique para planejar'
                        }
                      >
                        {cell?.completed
                          ? <Check size={14} className="text-green-400" />
                          : cell?.planned
                            ? <span className="text-[10px] font-semibold" style={{ color }}>{cell.plannedMeters ? `${cell.plannedMeters}m` : '✓'}</span>
                            : <Minus size={12} className="text-gray-700" />
                        }
                        {cell?.cncCategory && (
                          <X size={10} className="text-red-400 ml-0.5" />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}

            {trechos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-600 text-sm">
                  Nenhum trecho encontrado — 0 atividades em lps_tasks para o projeto. Adicione na aba Semáforo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Lookahead DERIVADO do planejamento real ─────────────────────────── */}

      {/* a) deriveLookahead sobre o mestre real */}
      <BlocoDerivado
        titulo="Derivado do Mestre"
        fonte="deriveLookahead(planejamento_itens + rdos) — motor real"
      >
        {engine.loading ? (
          <p className="text-slate-600 text-xs px-4 py-4">Calculando o cronograma mestre…</p>
        ) : engine.error ? (
          <p className="text-red-400 text-xs px-4 py-4">Erro no motor do mestre: {engine.error}</p>
        ) : derivadas.length === 0 ? (
          <p className="text-slate-600 text-xs px-4 py-4">
            0 atividades do mestre na janela de 6 semanas
            {engine.activities.length === 0
              ? ' — o motor não encontrou planejamento_itens/rdos para o projeto ativo.'
              : ` — o mestre tem ${engine.activities.length} atividades, mas nenhuma toca a janela.`}
          </p>
        ) : (
          <div className="divide-y divide-[#1e293b]">
            {derivadasPorSemana.map(([semana, itens]) => (
              <div key={semana} className="px-4 py-2.5">
                <p className="text-[10px] font-bold text-[#a3a3a3] uppercase tracking-wider font-mono mb-1.5">
                  {weekLabel(semana)} <span className="text-slate-600">({itens.length})</span>
                </p>
                <ul className="flex flex-col gap-1">
                  {itens.map((d) => {
                    const meta = DERIVED_STATUS_META[d.status]
                    return (
                      <li key={d.id} className="flex items-center gap-2 text-xs min-w-0">
                        <span className="w-2 h-2 rounded-[2px] inline-block shrink-0" style={{ backgroundColor: meta.cor }} />
                        <span className="text-slate-200 truncate">{d.name}</span>
                        <span className="text-slate-600 text-[10px] shrink-0">{d.responsible}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider shrink-0 ml-auto" style={{ color: meta.cor }}>
                          {meta.rotulo}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </BlocoDerivado>

      {/* b) agenda_tasks na janela */}
      <BlocoDerivado titulo="Agenda na Janela" fonte="agenda_tasks (tarefas que tocam as próximas 6 semanas)">
        {agendaNaJanela.length === 0 ? (
          <p className="text-slate-600 text-xs px-4 py-4">0 tarefas de agenda_tasks tocando a janela de 6 semanas.</p>
        ) : (
          <ul className="divide-y divide-[#1e293b]">
            {agendaNaJanela.map((t) => (
              <li key={t.id} className="px-4 py-2 flex items-center gap-3 text-xs min-w-0">
                <span className="font-mono [font-variant-numeric:tabular-nums] text-[#a3a3a3] text-[10px] shrink-0">
                  {t.startDate}{t.endDateUnknown ? ' → ?' : t.endDate !== t.startDate ? ` → ${t.endDate}` : ''}
                </span>
                <span className="text-slate-200 truncate">{t.title}</span>
                {(t.teamLeadName || t.assignedTo) && (
                  <span className="text-slate-600 text-[10px] shrink-0 ml-auto">{t.teamLeadName ?? t.assignedTo}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </BlocoDerivado>

      {/* c) programacao_semana (previsto mais recente) */}
      <BlocoDerivado
        titulo="Programação da Semana"
        fonte={`programacao_semana${programacao.semanaIni ? ` (${programacao.semanaIni} → ${programacao.semanaFim})` : ''}`}
      >
        {programacao.loading ? (
          <p className="text-slate-600 text-xs px-4 py-4">Carregando a programação…</p>
        ) : programacao.error ? (
          <p className="text-red-400 text-xs px-4 py-4">Erro: {programacao.error}</p>
        ) : programacao.frentes.length === 0 ? (
          <p className="text-slate-600 text-xs px-4 py-4">0 registros em programacao_semana — nenhuma semana programada gravada.</p>
        ) : (
          <div className="divide-y divide-[#1e293b]">
            {programacao.frentes.map((f) => (
              <div key={f.frente} className="px-4 py-2.5">
                <p className="text-[10px] font-bold text-[#a3a3a3] uppercase tracking-wider font-mono mb-1.5">{f.frente}</p>
                <ul className="flex flex-col gap-1">
                  {f.equipes.map((eq) => (
                    <li key={eq.equipe} className="text-xs flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-slate-200 font-semibold">{eq.equipe}:</span>
                      <span className="text-slate-500">
                        {eq.servicos.map((sv, i) => (
                          <span key={`${sv.servico}-${i}`}>
                            {i > 0 && ' · '}
                            {sv.servico}
                            {sv.metaQtd != null && (
                              <span className="font-mono [font-variant-numeric:tabular-nums] text-[#a3a3a3]"> {sv.metaQtd}{sv.metaUnidade ? ` ${sv.metaUnidade}` : ''}</span>
                            )}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </BlocoDerivado>
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function BlocoDerivado({ titulo, fonte, children }: { titulo: string; fonte: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1e293b] bg-[#0d1420] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#1e293b] flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] font-bold text-white uppercase tracking-wider">{titulo}</p>
        <span className="text-[9px] text-slate-600 font-mono uppercase tracking-wider">FONTE {fonte}</span>
      </div>
      {children}
    </div>
  )
}
