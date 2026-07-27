/**
 * SemaforoPanel — Ready/Not-Ready semaphore table with inline CNC editing.
 * Columns: Semana | Trecho | Descrição | Equipe | Semáforo | Status | CNC
 *
 * Frente B1 (27/07): ganhou o modo COMPROMETER SEMANA — wizard inline que
 * lista as wcr_equipes ativas (não a_contratar) e grava os compromissos da
 * semana ISO corrente em lps_tasks (comprometida=true, ready_status='pronta').
 * A meta sugerida vem de vw_produtividade_real (ritmo real × dias úteis
 * restantes) — sugestão editável, nunca gravada sem confirmação explícita.
 */
import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, Check, X, CalendarCheck } from 'lucide-react'
import { useLpsStore, computeWeeklyPPC, weekLabel, isoWeek } from '@/store/lpsStore'
import { useEquipes } from '@/hooks/useEquipes'
import {
  carregarCompromissosSemana,
  carregarProdutividadeReal,
  comprometerSemana,
  diasUteisRestantes,
  semanaIsoAtual,
  sugerirMetaMetros,
  type SugestaoMeta,
} from '@/hooks/useLpsSemana'
import { supabase } from '@/lib/supabase'
import type { LpsActivity, LpsCncCategory, LpsReadyStatus } from '@/types'
import { ConfirmDialog } from './ConfirmDialog'

const CNC_OPTIONS: { value: LpsCncCategory; label: string }[] = [
  { value: 'weather',   label: 'Clima' },
  { value: 'equipment', label: 'Equipamento' },
  { value: 'labor',     label: 'Mão de Obra' },
  { value: 'material',  label: 'Material' },
  { value: 'design',    label: 'Projeto' },
  { value: 'other',     label: 'Outro' },
]

const STATUS_COLORS: Record<LpsReadyStatus, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
}

const STATUS_LABELS: Record<LpsReadyStatus, string> = {
  green:  'Pronto',
  yellow: 'Em risco',
  red:    'Não cumprido',
}

// ─── Inline CNC editor ────────────────────────────────────────────────────────

function CncEditor({ activity, onClose }: { activity: LpsActivity; onClose: () => void }) {
  const updateActivity = useLpsStore((s) => s.updateActivity)
  const [cat,  setCat]       = useState<LpsCncCategory>(activity.cncCategory ?? 'other')
  const [desc, setDesc]      = useState(activity.cncDescription ?? '')
  const [confirming, setConfirming] = useState(false)

  function handleSave() {
    setConfirming(true)
  }
  function confirmSave() {
    updateActivity(activity.id, { cncCategory: cat, cncDescription: desc, readyStatus: 'red' })
    onClose()
  }
  function handleClear() {
    updateActivity(activity.id, { cncCategory: undefined, cncDescription: undefined, readyStatus: 'green' })
    onClose()
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-[#3d3d3d] rounded-lg border border-[#525252] min-w-[280px]">
      <p className="text-xs font-semibold text-[#f5f5f5]">Causa de Não Cumprimento (CNC)</p>
      <select
        value={cat}
        onChange={(e) => setCat(e.target.value as LpsCncCategory)}
        className="bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
      >
        {CNC_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descreva a causa..."
        rows={2}
        className="bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 resize-none"
      />
      {confirming ? (
        <ConfirmDialog
          message={`Salvar CNC: ${CNC_OPTIONS.find((o) => o.value === cat)?.label ?? cat}?`}
          confirmLabel="Salvar"
          onConfirm={confirmSave}
          onCancel={() => setConfirming(false)}
          danger={false}
        />
      ) : (
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
            <Check size={11} /> Salvar
          </button>
          <button onClick={handleClear} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors">
            <X size={11} /> Limpar CNC
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Add activity form ────────────────────────────────────────────────────────

function AddActivityRow({ onClose }: { onClose: () => void }) {
  const addActivity = useLpsStore((s) => s.addActivity)
  const [week, setWeek]  = useState(isoWeek(new Date()))
  const [code, setCode]  = useState('')
  const [desc, setDesc]  = useState('')
  const [team, setTeam]  = useState('')
  const [meters, setMeters] = useState('0')

  function handleAdd() {
    if (!code.trim()) return
    addActivity({
      week,
      trechoCode: code,
      description: desc,
      planned: true,
      completed: false,
      readyStatus: 'green',
      responsibleTeam: team,
      plannedMeters: parseFloat(meters) || 0,
    })
    onClose()
  }

  return (
    <tr className="bg-orange-900/10 border-b border-[#3d3d3d]">
      <td className="px-3 py-2">
        <input value={week} onChange={(e) => setWeek(e.target.value)}
          className="w-24 bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500" />
      </td>
      <td className="px-3 py-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="T01"
          className="w-16 bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500" />
      </td>
      <td className="px-3 py-2">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição..."
          className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500" />
      </td>
      <td className="px-3 py-2">
        <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Equipe..."
          className="w-24 bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500" />
      </td>
      <td className="px-3 py-2 text-center">
        <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
      </td>
      <td className="px-3 py-2">
        <input value={meters} onChange={(e) => setMeters(e.target.value)} type="number"
          className="w-16 bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500 text-right" />
        <span className="text-xs text-[#6b6b6b] ml-1">m</span>
      </td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button onClick={handleAdd} className="px-2 py-1 rounded text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
            <Check size={11} />
          </button>
          <button onClick={onClose} className="px-2 py-1 rounded text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors">
            <X size={11} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── COMPROMETER SEMANA (wizard inline, Frente B1 27/07) ─────────────────────

/** Líder "de verdade" pra pré-preencher responsável — placeholders viram vazio. */
function liderValido(lider: string): string {
  const v = (lider ?? '').trim()
  if (!v || v === '—' || v === '-' || /^a definir/i.test(v)) return ''
  return v
}

function normNome(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

interface LinhaWizard {
  equipeId: string
  equipeNome: string
  incluir: boolean
  taskName: string
  responsavel: string
  meta: string
  sugestao: SugestaoMeta | null
  /** Já existe compromisso desta semana com o mesmo responsável (evita duplicar). */
  jaComprometida: boolean
}

const MONO = 'font-mono [font-variant-numeric:tabular-nums]'
const INPUT_DARK =
  'bg-[#0a0f1a] border border-[#1e293b] px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#38bdf8]'

function ComprometerSemanaWizard({
  projectId,
  onClose,
  onGravado,
}: {
  projectId: string
  onClose: () => void
  onGravado: () => void
}) {
  const { equipes, loading: equipesLoading } = useEquipes()
  const semana = semanaIsoAtual()
  const diasUteis = diasUteisRestantes()

  const [linhas, setLinhas] = useState<LinhaWizard[] | null>(null)
  const [fonteRitmoOk, setFonteRitmoOk] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Monta as linhas quando as equipes chegam: sugestão de meta da
  // vw_produtividade_real + dedup contra compromissos já gravados na semana.
  useEffect(() => {
    if (equipesLoading || linhas !== null) return
    let cancelado = false
    ;(async () => {
      const [ritmos, existentes] = await Promise.all([
        carregarProdutividadeReal(),
        carregarCompromissosSemana(projectId, semana),
      ])
      if (cancelado) return
      setFonteRitmoOk(ritmos !== null)
      const responsaveisExistentes = new Set((existentes ?? []).map((c) => normNome(c.responsavel)))
      const elegiveis = equipes.filter((e) => !e.aContratar)
      setLinhas(
        elegiveis.map((e) => {
          const responsavel = liderValido(e.lider)
          const sugestao = ritmos ? sugerirMetaMetros(ritmos, e.id, diasUteis) : null
          const jaComprometida = responsavel !== '' && responsaveisExistentes.has(normNome(responsavel))
          return {
            equipeId: e.id,
            equipeNome: e.equipe,
            incluir: !jaComprometida,
            taskName: `Produção semanal — ${e.equipe}`,
            responsavel,
            meta: sugestao ? String(sugestao.total) : '',
            sugestao,
            jaComprometida,
          }
        }),
      )
    })()
    return () => {
      cancelado = true
    }
  }, [equipesLoading, equipes, linhas, projectId, semana, diasUteis])

  function patchLinha(equipeId: string, patch: Partial<LinhaWizard>) {
    setLinhas((prev) => (prev ? prev.map((l) => (l.equipeId === equipeId ? { ...l, ...patch } : l)) : prev))
  }

  const incluidas = (linhas ?? []).filter((l) => l.incluir)
  // Validação BLOQUEANTE: sem responsável ou sem meta (> 0) não grava.
  const problemas = incluidas.filter((l) => !l.responsavel.trim() || !(parseFloat(l.meta) > 0))
  const podeGravar = !gravando && incluidas.length > 0 && problemas.length === 0 && supabase !== null

  async function gravar() {
    setGravando(true)
    setErro(null)
    const res = await comprometerSemana(
      projectId,
      semana,
      incluidas.map((l) => ({
        taskName: l.taskName,
        responsavel: l.responsavel,
        metrosPlanejados: parseFloat(l.meta),
      })),
    )
    setGravando(false)
    if (res.ok) {
      onGravado()
    } else {
      setConfirmando(false)
      setErro(res.erro ?? 'Erro desconhecido ao gravar compromissos.')
    }
  }

  return (
    <div className="border border-[#1e293b] bg-[#0d1420] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e2e8f0]">
            Comprometer semana <span className={`text-[#38bdf8] ${MONO}`}>{semana}</span>
          </span>
          <span className={`text-[9px] text-[#475569] ${MONO}`}>
            FONTE: wcr_equipes (ativas, sem a_contratar) · sugestão de meta: vw_produtividade_real × {diasUteis} dia(s) útil(eis) restante(s) seg–sáb
          </span>
        </div>
        <button onClick={onClose} className="text-[#64748b] hover:text-[#e2e8f0] transition-colors" title="Fechar wizard">
          <X size={14} />
        </button>
      </div>

      {supabase === null && (
        <div className="flex items-start gap-2 border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-2.5 py-2">
          <span className="inline-block w-2 h-2 shrink-0 mt-0.5" style={{ background: '#f59e0b' }} />
          <span className="text-[10px] leading-snug text-[#f59e0b]">
            Supabase não configurado — impossível gravar compromissos em lps_tasks.
          </span>
        </div>
      )}

      {linhas === null ? (
        <p className={`text-[10px] text-[#64748b] ${MONO}`}>CARREGANDO EQUIPES E RITMOS REAIS…</p>
      ) : linhas.length === 0 ? (
        <p className="text-[10px] text-[#64748b]">
          0 equipes elegíveis em wcr_equipes (ativas e não a_contratar) — cadastre equipes no Kanban de Equipes.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e293b]">
                <th className="w-8" />
                <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Equipe</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Tarefa</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Responsável (líder)</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Meta (m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]">
              {linhas.map((l) => {
                const metaInvalida = l.incluir && !(parseFloat(l.meta) > 0)
                const respInvalido = l.incluir && !l.responsavel.trim()
                return (
                  <tr key={l.equipeId} className={l.incluir ? '' : 'opacity-40'}>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={l.incluir}
                        onChange={(e) => patchLinha(l.equipeId, { incluir: e.target.checked })}
                        className="accent-[#38bdf8]"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#e2e8f0] whitespace-nowrap">
                        {l.equipeNome}
                      </span>
                      {l.jaComprometida && (
                        <span className={`block text-[9px] text-[#f59e0b] ${MONO}`}>JÁ COMPROMETIDA NESTA SEMANA</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={l.taskName}
                        onChange={(e) => patchLinha(l.equipeId, { taskName: e.target.value })}
                        className={`w-56 ${INPUT_DARK}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={l.responsavel}
                        onChange={(e) => patchLinha(l.equipeId, { responsavel: e.target.value })}
                        placeholder="obrigatório"
                        className={`w-40 ${INPUT_DARK} ${respInvalido ? 'border-[#ef4444]' : ''}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={l.meta}
                        onChange={(e) => patchLinha(l.equipeId, { meta: e.target.value })}
                        type="number"
                        min={0}
                        placeholder="obrigatória"
                        className={`w-24 text-right ${MONO} ${INPUT_DARK} ${metaInvalida ? 'border-[#ef4444]' : ''}`}
                      />
                      {l.sugestao ? (
                        <span className={`block text-[9px] text-[#475569] ${MONO}`}>
                          SUGESTÃO: {l.sugestao.metrosDia} m/dia × {l.sugestao.diasUteis}d = {l.sugestao.total} m
                          {l.sugestao.equipeIdUsado !== l.equipeId ? ` (ritmo de ${l.sugestao.equipeIdUsado})` : ''}
                        </span>
                      ) : (
                        <span className={`block text-[9px] text-[#475569] ${MONO}`}>
                          {fonteRitmoOk ? 'SEM RITMO DE METROS NA vw_produtividade_real' : 'vw_produtividade_real INDISPONÍVEL'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {erro && (
        <div className="flex items-start gap-2 border border-[#ef4444]/40 bg-[#ef4444]/5 px-2.5 py-2">
          <span className="inline-block w-2 h-2 shrink-0 mt-0.5" style={{ background: '#ef4444' }} />
          <span className="text-[10px] leading-snug text-[#ef4444]">{erro}</span>
        </div>
      )}

      {linhas !== null && linhas.length > 0 && (
        confirmando ? (
          <ConfirmDialog
            message={`Gravar ${incluidas.length} compromisso(s) da semana ${semana} em lps_tasks?`}
            confirmLabel={gravando ? 'Gravando…' : 'Comprometer'}
            onConfirm={gravar}
            onCancel={() => setConfirmando(false)}
            danger={false}
          />
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setConfirmando(true)}
              disabled={!podeGravar}
              className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] border transition-colors ${
                podeGravar
                  ? 'border-[#22c55e]/50 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20'
                  : 'border-[#1e293b] bg-[#0a0f1a] text-[#475569] cursor-not-allowed'
              }`}
            >
              Comprometer {incluidas.length} equipe(s)
            </button>
            {problemas.length > 0 && (
              <span className="text-[10px] text-[#ef4444]">
                {problemas.length} linha(s) sem responsável ou sem meta — preencha ou desmarque para gravar.
              </span>
            )}
            {incluidas.length === 0 && (
              <span className="text-[10px] text-[#64748b]">Nenhuma equipe selecionada.</span>
            )}
          </div>
        )
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SemaforoPanel() {
  const activities     = useLpsStore((s) => s.activities)
  const updateActivity = useLpsStore((s) => s.updateActivity)
  const removeActivity = useLpsStore((s) => s.removeActivity)
  const currentProjectId = useLpsStore((s) => s.currentProjectId)
  const loadFromProject  = useLpsStore((s) => s.loadFromProject)

  const [filterWeek, setFilterWeek]   = useState('')
  const [filterTeam, setFilterTeam]   = useState('')
  const [cncOpenId,  setCncOpenId]    = useState<string | null>(null)
  const [showAdd,    setShowAdd]      = useState(false)
  const [showComprometer, setShowComprometer] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const weekly    = useMemo(() => computeWeeklyPPC(activities), [activities])
  const weekOptions = useMemo(() => [...new Set(activities.map((a) => a.week))].sort(), [activities])
  const teamOptions = useMemo(() => [...new Set(activities.map((a) => a.responsibleTeam).filter(Boolean))], [activities])

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (filterWeek && a.week !== filterWeek) return false
      if (filterTeam && a.responsibleTeam !== filterTeam) return false
      return true
    }).sort((a, b) => a.week.localeCompare(b.week) || a.trechoCode.localeCompare(b.trechoCode))
  }, [activities, filterWeek, filterTeam])

  // PPC for current filter
  const filteredWeekly = weekly.filter((w) => !filterWeek || w.week === filterWeek)
  const filteredPpc = filteredWeekly.length > 0
    ? Math.round(filteredWeekly.reduce((s, w) => s + w.ppc, 0) / filteredWeekly.length)
    : null

  function toggleCompleted(a: LpsActivity) {
    const completed = !a.completed
    updateActivity(a.id, {
      completed,
      readyStatus: completed ? 'green' : a.readyStatus === 'green' ? 'red' : a.readyStatus,
    })
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)}
          className="bg-[#3d3d3d] border border-[#525252] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500">
          <option value="">Todas as semanas</option>
          {weekOptions.map((w) => (
            <option key={w} value={w}>{weekLabel(w)} ({w})</option>
          ))}
        </select>

        <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}
          className="bg-[#3d3d3d] border border-[#525252] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500">
          <option value="">Todas as equipes</option>
          {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {filteredPpc !== null && (
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${
            filteredPpc >= 80 ? 'text-green-400 border-green-800 bg-green-900/20'
            : filteredPpc >= 60 ? 'text-yellow-400 border-yellow-800 bg-yellow-900/20'
            : 'text-red-400 border-red-800 bg-red-900/20'
          }`}>
            PPC: {filteredPpc}%
          </span>
        )}

        <button
          onClick={() => setShowComprometer((v) => !v)}
          disabled={!currentProjectId}
          title={currentProjectId ? `Comprometer a semana ${semanaIsoAtual()}` : 'Selecione um projeto para comprometer a semana'}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] border transition-colors ${
            currentProjectId
              ? 'border-[#38bdf8]/50 bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20'
              : 'border-[#1e293b] bg-[#0a0f1a] text-[#475569] cursor-not-allowed'
          }`}
        >
          <CalendarCheck size={13} /> Comprometer Semana
        </button>

        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
          <Plus size={13} /> Adicionar Atividade
        </button>
      </div>

      {/* Wizard COMPROMETER SEMANA — grava em lps_tasks e recarrega o store */}
      {showComprometer && currentProjectId && (
        <ComprometerSemanaWizard
          projectId={currentProjectId}
          onClose={() => setShowComprometer(false)}
          onGravado={() => {
            setShowComprometer(false)
            void loadFromProject(currentProjectId)
          }}
        />
      )}

      {/* Table */}
      <div className="rounded-xl border border-[#3d3d3d] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#3d3d3d]/80 border-b border-[#525252]">
            <tr>
              <th className="text-left text-[#a3a3a3] px-3 py-3 text-xs font-semibold">Semana</th>
              <th className="text-left text-[#a3a3a3] px-3 py-3 text-xs font-semibold">Trecho</th>
              <th className="text-left text-[#a3a3a3] px-3 py-3 text-xs font-semibold">Descrição</th>
              <th className="text-left text-[#a3a3a3] px-3 py-3 text-xs font-semibold">Equipe</th>
              <th className="text-center text-[#a3a3a3] px-3 py-3 text-xs font-semibold">Semáforo</th>
              <th className="text-right text-[#a3a3a3] px-3 py-3 text-xs font-semibold">Prod. Planj.</th>
              <th className="text-left text-[#a3a3a3] px-3 py-3 text-xs font-semibold">CNC</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3d3d3d]">
            {showAdd && (
              <AddActivityRow onClose={() => setShowAdd(false)} />
            )}
            {filtered.map((a) => (
              <tr key={a.id} className="bg-[#2c2c2c] hover:bg-[#3d3d3d]/60 transition-colors">
                <td className="px-3 py-2.5 text-[#a3a3a3] text-xs whitespace-nowrap font-mono">
                  {weekLabel(a.week)}
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-semibold text-white">{a.trechoCode}</span>
                </td>
                <td className="px-3 py-2.5 text-[#f5f5f5] text-xs max-w-[220px] truncate">
                  {a.description}
                </td>
                <td className="px-3 py-2.5 text-[#a3a3a3] text-xs whitespace-nowrap">
                  {a.responsibleTeam ?? '—'}
                </td>

                {/* Semaphore dot — click to toggle completed or open CNC */}
                <td className="px-3 py-2.5 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => {
                        if (a.readyStatus === 'red') {
                          setCncOpenId(cncOpenId === a.id ? null : a.id)
                        } else {
                          toggleCompleted(a)
                        }
                      }}
                      title={STATUS_LABELS[a.readyStatus]}
                      className={`w-4 h-4 rounded-full ${STATUS_COLORS[a.readyStatus]} hover:opacity-80 transition-opacity cursor-pointer`}
                    />
                    {a.completed && (
                      <Check size={9} className="text-green-400" />
                    )}
                  </div>

                  {/* CNC editor inline below the row */}
                  {cncOpenId === a.id && (
                    <div className="absolute z-50 mt-1">
                      <CncEditor activity={a} onClose={() => setCncOpenId(null)} />
                    </div>
                  )}
                </td>

                <td className="px-3 py-2.5 text-right text-[#f5f5f5] text-xs font-mono whitespace-nowrap">
                  {a.plannedMeters ? `${a.plannedMeters} m` : '—'}
                  {a.executedMeters ? (
                    <span className="block text-[10px] text-green-400">{a.executedMeters} m exec.</span>
                  ) : null}
                </td>

                <td className="px-3 py-2.5">
                  {a.cncCategory ? (
                    <button
                      onClick={() => setCncOpenId(cncOpenId === a.id ? null : a.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 transition-colors whitespace-nowrap"
                    >
                      {CNC_OPTIONS.find((o) => o.value === a.cncCategory)?.label ?? a.cncCategory}
                    </button>
                  ) : (
                    <button
                      onClick={() => setCncOpenId(cncOpenId === a.id ? null : a.id)}
                      className="text-[#6b6b6b] hover:text-[#f5f5f5] text-[11px] transition-colors"
                    >
                      + CNC
                    </button>
                  )}
                </td>

                <td className="px-3 py-2.5">
                  {confirmDeleteId === a.id ? (
                    <ConfirmDialog
                      message="Remover atividade?"
                      onConfirm={() => { removeActivity(a.id); setConfirmDeleteId(null) }}
                      onCancel={() => setConfirmDeleteId(null)}
                    />
                  ) : (
                    <button onClick={() => setConfirmDeleteId(a.id)}
                      className="text-gray-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !showAdd && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-600 text-sm">
                  Nenhuma atividade encontrada. Clique em "Adicionar Atividade" para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600">
        {filtered.length} atividades · Clique na bolinha vermelha para registrar CNC · Clique nas demais para alternar conclusão
      </p>
    </div>
  )
}
