import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, GitBranch, RefreshCw, ScrollText } from 'lucide-react'
import {
  apiProjetoCriarPlanejamentoSemanal,
  apiProjetoDesvios,
  apiProjetoLogs,
  apiProjetoPlanejamentosSemanais,
  apiProjetoRecalcularDesviosMl,
  apiProjetoReplanejamentos,
  apiProjetoValidarPlanejamentoSemanal,
  apiProjetoValidarReplanejamento,
} from '@/lib/api'
import { useProjectContext } from '@/store/projectContext'

function n(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function label(value: unknown): string {
  return String(value ?? '').trim() || '-'
}

function statusClass(severity: string) {
  const s = severity.toLowerCase()
  if (s === 'critical') return 'text-red-300 bg-red-950/50 border-red-800/60'
  if (s === 'high' || s === 'error') return 'text-orange-300 bg-orange-950/50 border-orange-800/60'
  if (s === 'medium' || s === 'warning') return 'text-amber-300 bg-amber-950/50 border-amber-800/60'
  return 'text-emerald-300 bg-emerald-950/40 border-emerald-800/50'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function parsePlanItems(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim())
      const [atividade, quantidade, unidade, equipe, custo] = parts
      return {
        atividade: atividade || 'Atividade semanal',
        quantidade_planejada: n(quantidade),
        unidade: unidade || 'm',
        equipe_planejada: n(equipe),
        custo_previsto: n(custo),
      }
    })
}

export function OperationalCyclePanel({ compact = false, showPlanningActions = false }: { compact?: boolean; showPlanningActions?: boolean }) {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([])
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([])
  const [deviations, setDeviations] = useState<Array<Record<string, unknown>>>([])
  const [replans, setReplans] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [engineer, setEngineer] = useState('')
  const [director, setDirector] = useState('Felipe Nery')
  const [weekStart, setWeekStart] = useState(todayIso)
  const [planLines, setPlanLines] = useState('Assentamento de rede | 100 | m | 5 | 8500')

  async function load() {
    if (!activeProjectId) return
    setLoading(true)
    setError(null)
    try {
      const [logRes, planRes, devRes, replanRes] = await Promise.all([
        apiProjetoLogs(activeProjectId),
        apiProjetoPlanejamentosSemanais(activeProjectId),
        apiProjetoDesvios(activeProjectId),
        apiProjetoReplanejamentos(activeProjectId),
      ])
      setLogs(logRes.items ?? [])
      setPlans(planRes.items ?? [])
      setDeviations(devRes.items ?? [])
      setReplans(replanRes.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar ciclo operacional')
    } finally {
      setLoading(false)
    }
  }

  async function recalcMl() {
    if (!activeProjectId) return
    setLoading(true)
    setError(null)
    try {
      await apiProjetoRecalcularDesviosMl(activeProjectId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao recalcular ML')
      setLoading(false)
    }
  }

  async function createWeeklyPlan() {
    if (!activeProjectId) return
    const itens = parsePlanItems(planLines)
    if (!itens.length) {
      setError('Informe pelo menos uma atividade planejada.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await apiProjetoCriarPlanejamentoSemanal(activeProjectId, {
        semana_inicio: weekStart,
        engenheiro_nome: engineer || 'Engenheiro',
        origem: 'web',
        itens,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar planejamento semanal')
      setLoading(false)
    }
  }

  async function validateWeeklyPlan(planId: unknown, aprovado: boolean) {
    if (!activeProjectId || !planId) return
    setLoading(true)
    setError(null)
    try {
      await apiProjetoValidarPlanejamentoSemanal(activeProjectId, String(planId), {
        decisao: aprovado ? 'aprovado' : 'rejeitado',
        diretor_nome: director || 'Diretor',
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao validar planejamento semanal')
      setLoading(false)
    }
  }

  async function validateReplan(replanId: unknown, aprovado: boolean) {
    if (!activeProjectId || !replanId) return
    setLoading(true)
    setError(null)
    try {
      await apiProjetoValidarReplanejamento(activeProjectId, String(replanId), {
        decisao: aprovado ? 'aprovado' : 'rejeitado',
        aplicar: aprovado,
        diretor_nome: director || 'Diretor',
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao validar replanejamento')
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [activeProjectId])

  const metrics = useMemo(() => {
    const critical = deviations.filter((d) => ['critical', 'high'].includes(label(d.severidade).toLowerCase()))
    const avgDeviation = deviations.reduce((sum, d) => sum + Math.abs(n(d.desvio_percentual)), 0) / Math.max(1, deviations.length)
    const avgPpc = deviations.reduce((sum, d) => sum + n(d.ppc), 0) / Math.max(1, deviations.length)
    const openLogs = logs.filter((log) => label(log.status).toLowerCase() === 'open')
    return { critical: critical.length, avgDeviation, avgPpc, openLogs: openLogs.length }
  }, [deviations, logs])

  if (!activeProjectId) {
    return null
  }

  return (
    <div className="rounded-xl border border-[#525252] bg-[#333333] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <GitBranch size={16} className="text-[#f97316]" />
            Ciclo planejamento - RDO - ML
          </div>
          <p className="text-xs text-[#a3a3a3] mt-1">
            Planejado x realizado, logs operacionais, XGBoost/fallback e replanejamento em rascunho.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="h-8 w-8 rounded-lg bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] flex items-center justify-center"
            title="Atualizar ciclo operacional"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={recalcMl}
            className="h-8 px-3 rounded-lg bg-[#f97316] text-white text-xs font-semibold flex items-center gap-2"
          >
            <Bot size={14} />
            ML
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-300 border border-red-800/60 bg-red-950/40 rounded-lg p-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-[#3d3d3d] border border-[#525252] p-3">
          <div className="text-[10px] text-[#a3a3a3] uppercase">Planejamentos</div>
          <div className="text-xl text-white font-bold">{plans.length}</div>
        </div>
        <div className="rounded-lg bg-[#3d3d3d] border border-[#525252] p-3">
          <div className="text-[10px] text-[#a3a3a3] uppercase">Desvios criticos</div>
          <div className="text-xl text-orange-300 font-bold">{metrics.critical}</div>
        </div>
        <div className="rounded-lg bg-[#3d3d3d] border border-[#525252] p-3">
          <div className="text-[10px] text-[#a3a3a3] uppercase">PPC medio</div>
          <div className="text-xl text-white font-bold">{metrics.avgPpc.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg bg-[#3d3d3d] border border-[#525252] p-3">
          <div className="text-[10px] text-[#a3a3a3] uppercase">Logs abertos</div>
          <div className="text-xl text-red-300 font-bold">{metrics.openLogs}</div>
        </div>
      </div>

      {showPlanningActions && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="rounded-lg bg-[#2c2c2c] border border-[#525252] p-3 space-y-3">
            <div>
              <div className="text-xs font-semibold text-white">Lancar planejamento semanal</div>
              <div className="text-[11px] text-[#a3a3a3] mt-1">
                Uma atividade por linha: atividade | quantidade | unidade | equipe | custo previsto
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                value={weekStart}
                onChange={(event) => setWeekStart(event.target.value)}
                type="date"
                className="h-9 rounded-lg bg-[#3d3d3d] border border-[#525252] px-3 text-xs text-white"
              />
              <input
                value={engineer}
                onChange={(event) => setEngineer(event.target.value)}
                placeholder="Engenheiro responsavel"
                className="h-9 rounded-lg bg-[#3d3d3d] border border-[#525252] px-3 text-xs text-white"
              />
            </div>
            <textarea
              value={planLines}
              onChange={(event) => setPlanLines(event.target.value)}
              rows={4}
              className="w-full rounded-lg bg-[#3d3d3d] border border-[#525252] px-3 py-2 text-xs text-white resize-y"
            />
            <button
              onClick={createWeeklyPlan}
              disabled={loading}
              className="h-9 px-3 rounded-lg bg-[#f97316] text-white text-xs font-semibold disabled:opacity-50"
            >
              Gravar planejamento em rascunho
            </button>
          </div>

          <div className="rounded-lg bg-[#2c2c2c] border border-[#525252] p-3 space-y-3">
            <div>
              <div className="text-xs font-semibold text-white">Validacao do diretor</div>
              <div className="text-[11px] text-[#a3a3a3] mt-1">Plano so vira oficial quando aprovado.</div>
            </div>
            <input
              value={director}
              onChange={(event) => setDirector(event.target.value)}
              placeholder="Diretor validador"
              className="h-9 rounded-lg bg-[#3d3d3d] border border-[#525252] px-3 text-xs text-white"
            />
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {plans.slice(0, 6).map((plan, idx) => {
                const status = label(plan.status).toLowerCase()
                return (
                  <div key={String(plan.id ?? idx)} className="border border-[#484848] rounded-lg p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-medium">{label(plan.semana_inicio)} a {label(plan.semana_fim)}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] ${statusClass(status)}`}>{status}</span>
                    </div>
                    <div className="text-[#a3a3a3] mt-1">{label(plan.engenheiro_nome)}</div>
                    {status === 'rascunho' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => validateWeeklyPlan(plan.id, true)}
                          disabled={loading}
                          className="h-7 px-2 rounded bg-emerald-700 text-white text-[11px] disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => validateWeeklyPlan(plan.id, false)}
                          disabled={loading}
                          className="h-7 px-2 rounded bg-red-800 text-white text-[11px] disabled:opacity-50"
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {plans.length === 0 && <div className="text-xs text-[#6b6b6b]">Nenhum planejamento semanal cadastrado.</div>}
            </div>
          </div>
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="rounded-lg bg-[#2c2c2c] border border-[#525252] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
              <AlertTriangle size={14} className="text-[#f97316]" />
              Desvios recentes
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {deviations.slice(0, 6).map((d, idx) => (
                <div key={String(d.id ?? idx)} className="text-xs border border-[#484848] rounded-lg p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium truncate">{label(d.atividade)}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${statusClass(label(d.severidade))}`}>{label(d.severidade)}</span>
                  </div>
                  <div className="text-[#a3a3a3] mt-1">
                    Desvio {n(d.desvio_percentual).toFixed(1)}% | CPI {n(d.cpi, 1).toFixed(2)} | SPI {n(d.spi, 1).toFixed(2)}
                  </div>
                  <div className="text-[#6b7280] mt-1">{label(d.acao_recomendada)}</div>
                </div>
              ))}
              {deviations.length === 0 && <div className="text-xs text-[#6b6b6b]">Sem desvios registrados.</div>}
            </div>
          </div>

          <div className="rounded-lg bg-[#2c2c2c] border border-[#525252] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
              <ScrollText size={14} className="text-[#f97316]" />
              Logs operacionais
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {logs.slice(0, 6).map((log, idx) => (
                <div key={String(log.id ?? idx)} className="text-xs border border-[#484848] rounded-lg p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium">{label(log.subsystem)}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${statusClass(label(log.severity))}`}>{label(log.severity)}</span>
                  </div>
                  <div className="text-[#a3a3a3] mt-1">{label(log.error_message)}</div>
                </div>
              ))}
              {logs.length === 0 && <div className="text-xs text-[#6b6b6b]">Sem logs operacionais.</div>}
            </div>
          </div>

          <div className="rounded-lg bg-[#2c2c2c] border border-[#525252] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
              <CheckCircle2 size={14} className="text-[#f97316]" />
              Replanejamentos
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {replans.slice(0, 6).map((item, idx) => (
                <div key={String(item.id ?? idx)} className="text-xs border border-[#484848] rounded-lg p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium">{label(item.status)}</span>
                    <span className="text-[#a3a3a3]">{label(item.created_at).slice(0, 10)}</span>
                  </div>
                  <div className="text-[#a3a3a3] mt-1">{label(item.motivo)}</div>
                  {label(item.status).toLowerCase() === 'rascunho' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => validateReplan(item.id, true)}
                        disabled={loading}
                        className="h-7 px-2 rounded bg-emerald-700 text-white text-[11px] disabled:opacity-50"
                      >
                        Aplicar
                      </button>
                      <button
                        onClick={() => validateReplan(item.id, false)}
                        disabled={loading}
                        className="h-7 px-2 rounded bg-red-800 text-white text-[11px] disabled:opacity-50"
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {replans.length === 0 && <div className="text-xs text-[#6b6b6b]">Sem replanejamento gerado.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
