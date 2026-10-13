/**
 * PpcDashboard — PPC/CNC REAIS + FECHAR SEMANA (Frente B1, 27/07).
 *
 * Fontes (declaradas em cada bloco, padrão Palantir do repo):
 *   vw_ppc_semana_equipe — PPC por equipe/semana; a view JÁ filtra semanas sem
 *     evidência de produção (mata o falso-alto da carga histórica de 14/07 —
 *     1.980 lps_tasks W15-W27 nunca aparecem como PPC).
 *   vw_cnc_pareto — pareto de causas de não cumprimento (vazio → estado
 *     honesto: as causas nascem no fechamento de semana).
 *   lps_tasks — compromissos da semana corrente (criados no wizard
 *     COMPROMETER SEMANA do Semáforo).
 *
 * FECHAR SEMANA: cada compromisso não-concluído EXIGE CNC da taxonomia oficial
 * + motivo (validação bloqueante); PPC < 80% insere linha pendente em
 * `replanejamentos`; o passo é registrado em `guia_progresso` (best-effort,
 * tabela da frente B2). Toda a lógica de escrita vive em useLpsSemana.ts.
 *
 * REGRA: nenhum número inventado — sem dado → aviso âmbar com a fonte.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLpsStore, weekLabel } from '@/store/lpsStore'
import {
  CNC_CATEGORIAS_OFICIAIS,
  carregarCncPareto,
  carregarCompromissosSemana,
  carregarPpcSemanaEquipe,
  fecharSemana,
  rotuloCnc,
  semanaIsoAtual,
  type CncCategoriaOficial,
  type CncParetoRow,
  type CompromissoSemana,
  type PpcSemanaEquipe,
  type ResultadoFechamento,
} from '@/hooks/useLpsSemana'

// ─── Constantes visuais (linguagem oficial dark/mono/caps) ──────────────────

const C = {
  bg: '#0a0f1a',
  panel: '#0d1420',
  border: '#1e293b',
  text: '#e2e8f0',
  muted: '#64748b',
  faint: '#475569',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#38bdf8',
} as const

const MONO = 'font-mono [font-variant-numeric:tabular-nums]'
const META_PPC = 80

function corPpc(ppc: number): string {
  return ppc >= META_PPC ? C.green : ppc >= 60 ? C.amber : C.red
}

// ─── Blocos básicos ─────────────────────────────────────────────────────────

function StatusSquare({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 shrink-0" style={{ background: color }} />
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b] leading-none">
      {children}
    </div>
  )
}

function Fonte({ children }: { children: React.ReactNode }) {
  return <div className={`text-[9px] text-[#475569] ${MONO} mt-auto pt-1.5`}>{children}</div>
}

/** Aviso âmbar honesto — usado sempre que falta dado real. */
function AvisoSemDado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-2.5 py-2">
      <StatusSquare color={C.amber} />
      <span className="text-[10px] leading-snug text-[#f59e0b]">{children}</span>
    </div>
  )
}

// ─── Fechamento de semana (inline, validação bloqueante) ────────────────────

interface DecisaoUi {
  concluida: boolean
  cnc: CncCategoriaOficial | ''
  motivo: string
}

function FecharSemanaSection({
  projectId,
  semana,
  compromissos,
  onFechado,
  onCancelar,
}: {
  projectId: string
  semana: string
  compromissos: CompromissoSemana[]
  onFechado: (r: ResultadoFechamento) => void
  onCancelar: () => void
}) {
  const [decisoes, setDecisoes] = useState<Record<string, DecisaoUi>>(() =>
    Object.fromEntries(
      compromissos.map((c) => [
        c.id,
        {
          concluida: c.concluida === true,
          cnc: (CNC_CATEGORIAS_OFICIAIS.some((o) => o.value === c.cnc_categoria)
            ? (c.cnc_categoria as CncCategoriaOficial)
            : '') as CncCategoriaOficial | '',
          motivo: c.motivo_nao_conclusao ?? '',
        },
      ]),
    ),
  )
  const [gravando, setGravando] = useState(false)
  const [erros, setErros] = useState<string[]>([])

  // Defesa: se `compromissos` for recarregado com linha nova enquanto o painel
  // está aberto, ela ainda não existe em `decisoes` — cai num default seguro.
  const getD = (c: CompromissoSemana): DecisaoUi =>
    decisoes[c.id] ?? { concluida: c.concluida === true, cnc: '', motivo: c.motivo_nao_conclusao ?? '' }

  function patch(id: string, p: Partial<DecisaoUi>) {
    setDecisoes((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { concluida: false, cnc: '', motivo: '' }), ...p },
    }))
  }

  // Validação BLOQUEANTE: não-concluída exige CNC oficial + motivo.
  const pendencias = compromissos.filter((c) => {
    const d = getD(c)
    return !d.concluida && (!d.cnc || !d.motivo.trim())
  })
  const concluidas = compromissos.filter((c) => getD(c).concluida).length
  const ppcPrevisto = compromissos.length > 0 ? Math.round((concluidas / compromissos.length) * 100) : 0
  const podeFechar = !gravando && pendencias.length === 0

  async function confirmar() {
    setGravando(true)
    setErros([])
    const resultado = await fecharSemana(
      projectId,
      semana,
      compromissos.map((c) => {
        const d = getD(c)
        return {
          id: c.id,
          taskName: c.task_name,
          responsavel: c.responsavel,
          concluida: d.concluida,
          cncCategoria: d.concluida ? undefined : (d.cnc as CncCategoriaOficial),
          motivo: d.concluida ? undefined : d.motivo,
        }
      }),
    )
    setGravando(false)
    if (resultado.ok) onFechado(resultado)
    else setErros(resultado.erros)
  }

  return (
    <div className="border border-[#38bdf8]/40 bg-[#0d1420] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e2e8f0]">
            Fechar semana <span className={`text-[#38bdf8] ${MONO}`}>{semana}</span>
          </span>
          <span className={`text-[9px] text-[#475569] ${MONO}`}>
            NÃO-CONCLUÍDA EXIGE CNC + MOTIVO · PPC &lt; {META_PPC}% GERA REPLANEJAMENTO PENDENTE (replanejamentos)
          </span>
        </div>
        <div className={`text-sm ${MONO}`} style={{ color: corPpc(ppcPrevisto) }}>
          PPC RESULTANTE: {ppcPrevisto}% ({concluidas}/{compromissos.length})
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e293b]">
              <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Compromisso</th>
              <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Responsável</th>
              <th className="text-right px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Meta (m)</th>
              <th className="text-center px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Concluída?</th>
              <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">CNC (obrigatória se não)</th>
              <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Motivo (obrigatório se não)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]">
            {compromissos.map((c) => {
              const d = getD(c)
              const invalido = !d.concluida && (!d.cnc || !d.motivo.trim())
              return (
                <tr key={c.id}>
                  <td className="px-2 py-2 text-[#e2e8f0] max-w-[240px] truncate">{c.task_name}</td>
                  <td className="px-2 py-2 text-[#64748b] whitespace-nowrap">{c.responsavel ?? '—'}</td>
                  <td className={`px-2 py-2 text-right text-[#e2e8f0] ${MONO}`}>
                    {c.metros_planejados != null ? c.metros_planejados : '—'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => patch(c.id, { concluida: !d.concluida })}
                      className={`px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] border transition-colors ${
                        d.concluida
                          ? 'border-[#22c55e]/50 bg-[#22c55e]/10 text-[#22c55e]'
                          : 'border-[#ef4444]/50 bg-[#ef4444]/10 text-[#ef4444]'
                      }`}
                    >
                      {d.concluida ? 'SIM' : 'NÃO'}
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    {d.concluida ? (
                      <span className="text-[#475569]">—</span>
                    ) : (
                      <select
                        value={d.cnc}
                        onChange={(e) => patch(c.id, { cnc: e.target.value as CncCategoriaOficial | '' })}
                        className={`bg-[#0a0f1a] border px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#38bdf8] ${
                          !d.cnc ? 'border-[#ef4444]' : 'border-[#1e293b]'
                        }`}
                      >
                        <option value="">— selecionar —</option>
                        {CNC_CATEGORIAS_OFICIAIS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {d.concluida ? (
                      <span className="text-[#475569]">—</span>
                    ) : (
                      <input
                        value={d.motivo}
                        onChange={(e) => patch(c.id, { motivo: e.target.value })}
                        placeholder="descreva a causa…"
                        className={`w-56 bg-[#0a0f1a] border px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#38bdf8] ${
                          invalido && !d.motivo.trim() ? 'border-[#ef4444]' : 'border-[#1e293b]'
                        }`}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {erros.length > 0 && (
        <div className="flex flex-col gap-1 border border-[#ef4444]/40 bg-[#ef4444]/5 px-2.5 py-2">
          {erros.map((e, i) => (
            <span key={i} className="text-[10px] leading-snug text-[#ef4444]">{e}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={confirmar}
          disabled={!podeFechar}
          className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] border transition-colors ${
            podeFechar
              ? 'border-[#22c55e]/50 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20'
              : 'border-[#1e293b] bg-[#0a0f1a] text-[#475569] cursor-not-allowed'
          }`}
        >
          {gravando ? 'Fechando…' : `Confirmar fechamento (${compromissos.length})`}
        </button>
        <button
          onClick={onCancelar}
          className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] border border-[#1e293b] text-[#64748b] hover:text-[#e2e8f0] transition-colors"
        >
          Cancelar
        </button>
        {pendencias.length > 0 && (
          <span className="text-[10px] text-[#ef4444]">
            {pendencias.length} não-concluída(s) sem CNC/motivo — preencha para fechar.
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard principal ────────────────────────────────────────────────────

export function PpcDashboard() {
  const projectId = useLpsStore((s) => s.currentProjectId)
  const setActiveTab = useLpsStore((s) => s.setActiveTab)
  const loadFromProject = useLpsStore((s) => s.loadFromProject)

  const semana = semanaIsoAtual()
  const [ppcRows, setPpcRows] = useState<PpcSemanaEquipe[] | null | 'carregando'>('carregando')
  const [pareto, setPareto] = useState<CncParetoRow[] | null | 'carregando'>('carregando')
  const [compromissos, setCompromissos] = useState<CompromissoSemana[] | null | 'carregando'>('carregando')
  const [fechando, setFechando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoFechamento | null>(null)

  const recarregar = useCallback(async () => {
    if (!projectId) {
      setPpcRows(null)
      setPareto(null)
      setCompromissos(null)
      return
    }
    const [p, c, t] = await Promise.all([
      carregarPpcSemanaEquipe(projectId),
      carregarCncPareto(projectId),
      carregarCompromissosSemana(projectId, semana),
    ])
    setPpcRows(p)
    setPareto(c)
    setCompromissos(t)
  }, [projectId, semana])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // Agregado por semana (soma das equipes) — só semanas que a view devolve.
  const semanas = useMemo(() => {
    if (ppcRows === null || ppcRows === 'carregando') return []
    const map = new Map<string, { planejadas: number; concluidas: number }>()
    for (const r of ppcRows) {
      const e = map.get(r.semana_iso) ?? { planejadas: 0, concluidas: 0 }
      e.planejadas += r.planejadas
      e.concluidas += r.concluidas
      map.set(r.semana_iso, e)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana_iso, { planejadas, concluidas }]) => ({
        semana_iso,
        planejadas,
        concluidas,
        ppc: planejadas > 0 ? Math.round((concluidas / planejadas) * 100) : 0,
      }))
  }, [ppcRows])

  const chartWeeks = semanas.slice(-12)
  const ultima = semanas[semanas.length - 1]
  const ultimas4 = semanas.slice(-4)
  const mediaPpc4 =
    ultimas4.length > 0
      ? Math.round(ultimas4.reduce((s, w) => s + w.ppc, 0) / ultimas4.length)
      : null

  const nCompromissos = compromissos !== null && compromissos !== 'carregando' ? compromissos.length : null
  const nConcluidas =
    compromissos !== null && compromissos !== 'carregando'
      ? compromissos.filter((c) => c.concluida === true).length
      : null

  // Dimensões do gráfico SVG (sem lib)
  const CHART_W = 620
  const CHART_H = 150
  const LEFT = 36
  const BOT = 26
  const slot = (CHART_W - LEFT - 10) / Math.max(chartWeeks.length, 1)
  const BAR_W = Math.max(10, Math.min(38, slot - 8))
  const metaY = CHART_H - (META_PPC / 100) * CHART_H

  return (
    <div className="p-6 flex flex-col gap-4" style={{ background: C.bg }}>
      {/* Cabeçalho + ação FECHAR SEMANA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#e2e8f0]">
            PPC — Planejado × Concluído
          </span>
          <span className={`text-[9px] text-[#475569] ${MONO}`}>
            FONTE: vw_ppc_semana_equipe (já exclui semanas sem evidência de produção — carga histórica de 14/07 não conta)
          </span>
        </div>
        <button
          onClick={() => {
            setResultado(null)
            setFechando((v) => !v)
          }}
          disabled={!projectId || nCompromissos === null || nCompromissos === 0}
          title={
            !projectId
              ? 'Selecione um projeto'
              : nCompromissos === 0
                ? `Sem compromissos na ${semana} — use COMPROMETER SEMANA no Semáforo`
                : `Fechar a semana ${semana}`
          }
          className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] border transition-colors ${
            projectId && nCompromissos
              ? 'border-[#38bdf8]/50 bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20'
              : 'border-[#1e293b] bg-[#0a0f1a] text-[#475569] cursor-not-allowed'
          }`}
        >
          Fechar semana {semana}
        </button>
      </div>

      {/* Resultado do fechamento */}
      {resultado && (
        <div
          className="flex items-start gap-2 border px-2.5 py-2"
          style={{
            borderColor: `${corPpc(resultado.ppc)}66`,
            background: `${corPpc(resultado.ppc)}0d`,
          }}
        >
          <StatusSquare color={corPpc(resultado.ppc)} />
          <span className="text-[10px] leading-snug" style={{ color: corPpc(resultado.ppc) }}>
            Semana {semana} fechada: PPC {resultado.ppc}% ({resultado.concluidas}/{resultado.total}).{' '}
            {resultado.replanejamentoCriado
              ? 'PPC abaixo de 80% — replanejamento PENDENTE criado em `replanejamentos` (aguardando validação).'
              : 'Meta de 80% atingida — nenhum replanejamento necessário.'}
          </span>
        </div>
      )}

      {/* Painel de fechamento */}
      {fechando && projectId && compromissos !== null && compromissos !== 'carregando' && compromissos.length > 0 && (
        <FecharSemanaSection
          projectId={projectId}
          semana={semana}
          compromissos={compromissos}
          onCancelar={() => setFechando(false)}
          onFechado={(r) => {
            setFechando(false)
            setResultado(r)
            void recarregar()
            if (projectId) void loadFromProject(projectId)
          }}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-[#1e293b] bg-[#0d1420] p-3 flex flex-col gap-1.5 min-h-[86px]">
          <Label>Compromissos {semana}</Label>
          {nCompromissos === null ? (
            <span className="text-[10px] text-[#f59e0b]">lps_tasks indisponível</span>
          ) : (
            <span className={`text-2xl leading-none text-[#e2e8f0] ${MONO}`}>
              {nConcluidas}<span className="text-[#64748b]">/{nCompromissos}</span>
            </span>
          )}
          <Fonte>lps_tasks · comprometida=true</Fonte>
        </div>

        <div className="border border-[#1e293b] bg-[#0d1420] p-3 flex flex-col gap-1.5 min-h-[86px]">
          <Label>PPC última semana c/ dado</Label>
          {ultima ? (
            <span className={`text-2xl leading-none ${MONO}`} style={{ color: corPpc(ultima.ppc) }}>
              {ultima.ppc}%
              <span className={`text-[10px] text-[#64748b] ml-1.5 ${MONO}`}>{ultima.semana_iso}</span>
            </span>
          ) : (
            <span className="text-[10px] text-[#f59e0b]">0 semanas com evidência</span>
          )}
          <Fonte>vw_ppc_semana_equipe</Fonte>
        </div>

        <div className="border border-[#1e293b] bg-[#0d1420] p-3 flex flex-col gap-1.5 min-h-[86px]">
          <Label>PPC médio (4 sem.)</Label>
          {mediaPpc4 !== null ? (
            <span className={`text-2xl leading-none ${MONO}`} style={{ color: corPpc(mediaPpc4) }}>
              {mediaPpc4}%
            </span>
          ) : (
            <span className="text-[10px] text-[#f59e0b]">sem semanas suficientes</span>
          )}
          <Fonte>vw_ppc_semana_equipe · média simples</Fonte>
        </div>

        <div className="border border-[#1e293b] bg-[#0d1420] p-3 flex flex-col gap-1.5 min-h-[86px]">
          <Label>Meta PPC</Label>
          <span className={`text-2xl leading-none text-[#38bdf8] ${MONO}`}>{META_PPC}%</span>
          <Fonte>meta fixa do Last Planner · PPC &lt; 80% no fechamento gera replanejamento</Fonte>
        </div>
      </div>

      {/* Chamada pra ação: semana corrente sem compromissos */}
      {nCompromissos === 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap border border-[#38bdf8]/40 bg-[#38bdf8]/5 px-3 py-2.5">
          <span className="text-[10px] leading-snug text-[#38bdf8]">
            0 compromissos na semana {semana} (lps_tasks). A carga histórica não vira PPC — comece comprometendo as
            equipes da semana no wizard do Semáforo.
          </span>
          <button
            onClick={() => setActiveTab('semaforo')}
            className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] border border-[#38bdf8]/50 bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20 transition-colors"
          >
            Comprometer semana →
          </button>
        </div>
      )}

      {/* Gráfico PPC semanal + Pareto CNC */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 border border-[#1e293b] bg-[#0d1420] p-3 flex flex-col gap-2">
          <Label>PPC semanal — {chartWeeks.length} semana(s) com evidência</Label>
          {ppcRows === 'carregando' ? (
            <p className={`text-[10px] text-[#64748b] py-8 text-center ${MONO}`}>CARREGANDO…</p>
          ) : ppcRows === null ? (
            <AvisoSemDado>vw_ppc_semana_equipe indisponível (Supabase off ou erro de leitura) — nenhum PPC exibido.</AvisoSemDado>
          ) : chartWeeks.length === 0 ? (
            <AvisoSemDado>0 registros em vw_ppc_semana_equipe para este projeto — PPC nasce após comprometer e fechar semanas.</AvisoSemDado>
          ) : (
            <div className="overflow-x-auto">
              <svg width={CHART_W} height={CHART_H + BOT + 8}>
                {[0, 25, 50, 75, 100].map((v) => {
                  const y = CHART_H - (v / 100) * CHART_H
                  return (
                    <g key={v}>
                      <line x1={LEFT} y1={y} x2={CHART_W} y2={y} stroke={C.border} strokeWidth={1} />
                      <text x={LEFT - 4} y={y + 3} textAnchor="end" fill={C.faint} fontSize={9} fontFamily="monospace">
                        {v}
                      </text>
                    </g>
                  )
                })}
                <line x1={LEFT} y1={metaY} x2={CHART_W} y2={metaY} stroke={C.cyan} strokeWidth={1} strokeDasharray="4 3" />
                <text x={CHART_W - 2} y={metaY - 3} textAnchor="end" fill={C.cyan} fontSize={9} fontFamily="monospace">
                  META {META_PPC}%
                </text>
                {chartWeeks.map((w, i) => {
                  const h = (w.ppc / 100) * CHART_H
                  const x = LEFT + i * slot + slot / 2 - BAR_W / 2
                  const y = CHART_H - h
                  const col = corPpc(w.ppc)
                  return (
                    <g key={w.semana_iso}>
                      <rect x={x} y={y} width={BAR_W} height={Math.max(h, 1)} fill={col} opacity={0.85} />
                      <text x={x + BAR_W / 2} y={y - 3} textAnchor="middle" fill={col} fontSize={9} fontFamily="monospace">
                        {w.ppc}
                      </text>
                      <text x={x + BAR_W / 2} y={CHART_H + 12} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily="monospace">
                        {weekLabel(w.semana_iso)}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          )}
          <div className="flex items-center gap-3 text-[9px] text-[#475569]">
            <span className="flex items-center gap-1"><StatusSquare color={C.green} /> ≥{META_PPC}%</span>
            <span className="flex items-center gap-1"><StatusSquare color={C.amber} /> 60–79%</span>
            <span className="flex items-center gap-1"><StatusSquare color={C.red} /> &lt;60%</span>
          </div>
          <Fonte>vw_ppc_semana_equipe · agregado por semana (soma das equipes)</Fonte>
        </div>

        <div className="lg:col-span-2 border border-[#1e293b] bg-[#0d1420] p-3 flex flex-col gap-2">
          <Label>Pareto CNC — causas de não cumprimento</Label>
          {pareto === 'carregando' ? (
            <p className={`text-[10px] text-[#64748b] py-8 text-center ${MONO}`}>CARREGANDO…</p>
          ) : pareto === null ? (
            <AvisoSemDado>vw_cnc_pareto indisponível (Supabase off ou erro de leitura).</AvisoSemDado>
          ) : pareto.length === 0 ? (
            <AvisoSemDado>
              Nenhuma causa registrada ainda — 0 registros em vw_cnc_pareto. As causas nascem no FECHAR SEMANA
              (toda tarefa não-concluída exige CNC + motivo).
            </AvisoSemDado>
          ) : (
            <div className="flex flex-col gap-2">
              {(() => {
                const total = pareto.reduce((s, r) => s + r.n, 0)
                return pareto.map((r) => {
                  const pct = total > 0 ? Math.round((r.n / total) * 100) : 0
                  return (
                    <div key={r.cnc_categoria}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#e2e8f0]">{rotuloCnc(r.cnc_categoria)}</span>
                        <span className={`text-[10px] text-[#e2e8f0] ${MONO}`}>{r.n}× ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-[#0a0f1a] border border-[#1e293b]">
                        <div className="h-full" style={{ width: `${pct}%`, background: C.red, opacity: 0.85 }} />
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
          <Fonte>vw_cnc_pareto</Fonte>
        </div>
      </div>

      {/* PPC por equipe/semana */}
      <div className="border border-[#1e293b] bg-[#0d1420] p-3 flex flex-col gap-2">
        <Label>PPC por equipe × semana</Label>
        {ppcRows === 'carregando' ? (
          <p className={`text-[10px] text-[#64748b] py-6 text-center ${MONO}`}>CARREGANDO…</p>
        ) : ppcRows === null ? (
          <AvisoSemDado>vw_ppc_semana_equipe indisponível.</AvisoSemDado>
        ) : ppcRows.length === 0 ? (
          <AvisoSemDado>0 registros em vw_ppc_semana_equipe para este projeto.</AvisoSemDado>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e293b]">
                  <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Semana</th>
                  <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Responsável</th>
                  <th className="text-right px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Planejadas</th>
                  <th className="text-right px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Concluídas</th>
                  <th className="text-right px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">PPC</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {[...ppcRows]
                  .sort((a, b) => b.semana_iso.localeCompare(a.semana_iso) || (a.responsavel ?? '').localeCompare(b.responsavel ?? ''))
                  .slice(0, 24)
                  .map((r, i) => (
                    <tr key={`${r.semana_iso}-${r.responsavel ?? 'null'}-${i}`}>
                      <td className={`px-2 py-1.5 text-[#e2e8f0] ${MONO}`}>{r.semana_iso}</td>
                      <td className="px-2 py-1.5">
                        {r.responsavel ? (
                          <span className="text-[10px] uppercase tracking-wider text-[#e2e8f0]">{r.responsavel}</span>
                        ) : (
                          <span className="text-[10px] text-[#475569]">sem responsável (carga histórica)</span>
                        )}
                      </td>
                      <td className={`px-2 py-1.5 text-right text-[#64748b] ${MONO}`}>{r.planejadas}</td>
                      <td className={`px-2 py-1.5 text-right text-[#64748b] ${MONO}`}>{r.concluidas}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold ${MONO}`} style={{ color: corPpc(r.ppc) }}>
                        {r.ppc}%
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <StatusSquare color={corPpc(r.ppc)} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <Fonte>vw_ppc_semana_equipe · últimas 24 linhas</Fonte>
      </div>
    </div>
  )
}
