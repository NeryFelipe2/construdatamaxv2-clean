/**
 * RestricoesPanel — CRUD real das restrições do LPS (Análise de Restrições).
 *
 * Origem do dado (27/07/2026): tabela Supabase `lps_restricoes` via lpsStore →
 * useLpsRestricoes.ts (74 linhas seed de ocorrencias_obra; API Render virou
 * fallback @deprecated). O formulário só expõe o que a tabela REALMENTE
 * persiste (descricao/tipo/impacto/responsavel/prazo/status/origem) — os
 * campos antigos tags/ações/observações não têm coluna e foram removidos da
 * UI pra não perder dado silenciosamente.
 *
 * IRR (Índice de Remoção de Restrições) = tratadas/total, onde "tratada" =
 * status <> 'identificada' (ou seja, 'em_resolucao' ou 'resolvida' — os 3
 * status padronizados que o store já usa). Janela = todas as restrições do
 * projeto carregadas.
 *
 * SUGESTÕES (rodapé): candidatas geradas em RUNTIME (nunca auto-inseridas):
 *  (a) ocorrencias_obra não resolvidas que ainda não viraram restrição
 *      (dedup: nenhuma restrição com origem contendo o id da ocorrência —
 *      mesmo padrão do seed de 27/07);
 *  (b) wcr_equipes ativas marcadas a_contratar sem restrição correspondente
 *      (dedup: frente_id ou origem contendo o id da equipe).
 * O botão PROMOVER insere via addRestriction (ação humana, promoção manual).
 */
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, AlertTriangle, X, ArrowUpRight } from 'lucide-react'
import { useLpsStore } from '@/store/lpsStore'
import { supabase } from '@/lib/supabase'
import { tipoParaCategoria } from '@/hooks/useLpsRestricoes'
import type { LpsRestriction, LpsRestrictionCategory, LpsRestrictionStatus } from '@/types'
import { ConfirmDialog } from './ConfirmDialog'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<LpsRestrictionCategory, string> = {
  projeto_engenharia: 'Projeto/Engenharia',
  materiais:          'Materiais',
  equipamentos:       'Equipamentos',
  mao_de_obra:        'Mão de Obra',
  externo:            'Externo',
  outros:             'Outros',
}

const CATEGORY_COLORS: Record<LpsRestrictionCategory, string> = {
  projeto_engenharia: '#6366f1',
  materiais:          '#f97316',
  equipamentos:       '#eab308',
  mao_de_obra:        '#a78bfa',
  externo:            '#38bdf8',
  outros:             '#94a3b8',
}

const STATUS_LABELS: Record<LpsRestrictionStatus, string> = {
  identificada:  'Identificada',
  em_resolucao:  'Em Resolução',
  resolvida:     'Resolvida',
}

const STATUS_COLORS: Record<LpsRestrictionStatus, string> = {
  identificada:  'text-red-400',
  em_resolucao:  'text-yellow-400',
  resolvida:     'text-green-400',
}

type FilterStatus = 'all' | LpsRestrictionStatus

// ─── Blank form factory ───────────────────────────────────────────────────────
// IMPORTANTE: não incluir origem/frenteId/tipoDb aqui — no update o store faz
// merge { ...r, ...form } e uma chave presente com undefined APAGARIA o valor
// original (a ausência da chave é o que preserva).

function blankForm(): Omit<LpsRestriction, 'id' | 'createdAt'> {
  return {
    tema: '',
    categoria: 'materiais',
    descricao: '',
    impacto: '',
    responsavel: '',
    prazoRemocao: '',
    acoesNecessarias: '',
    tags: [],
    observacoes: '',
    status: 'identificada',
  }
}

// ─── Sugestões (runtime, promoção manual) ────────────────────────────────────

interface OcorrenciaAberta {
  id: string
  nucleo: string | null
  rua: string | null
  data: string | null
  tipo: string | null
  descricao: string | null
  reportado_por: string | null
}

interface EquipeAContratar {
  id: string
  nome: string
  lider: string | null
}

interface SugestaoRestricao {
  chave: string
  rotulo: 'OCORRÊNCIA' | 'EQUIPE A CONTRATAR'
  tema: string
  descricao: string
  tipoDb: string
  origem: string
  frenteId?: string
  responsavel: string
}

/** Tipo livre de ocorrencias_obra → taxonomia CNC de lps_restricoes (mesma aproximação do seed 27/07). */
function tipoOcorrenciaParaTipoDb(tipo: string | null): string {
  const raw = String(tipo ?? '').toLowerCase()
  if (raw.includes('material')) return 'material'
  if (raw.includes('epi') || raw.includes('seguran')) return 'seguranca'
  if (raw.includes('vazamento') || raw.includes('retrabalho')) return 'retrabalho'
  if (raw.includes('morador') || raw.includes('interferencia') || raw.includes('interferência')) return 'interferencia/moradores'
  if (raw.includes('sabesp') || raw.includes('projeto')) return 'projeto/sabesp'
  if (raw.includes('equipamento') || raw.includes('maquina') || raw.includes('máquina')) return 'equipamento'
  if (raw.includes('chuva') || raw.includes('clima')) return 'clima'
  return 'outro'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RestricoesPanel() {
  const restrictions      = useLpsStore((s) => s.restrictions)
  const addRestriction    = useLpsStore((s) => s.addRestriction)
  const updateRestriction = useLpsStore((s) => s.updateRestriction)
  const removeRestriction = useLpsStore((s) => s.removeRestriction)

  const [filter, setFilter]             = useState<FilterStatus>('all')
  const [modalOpen, setModalOpen]       = useState(false)
  const [editId, setEditId]             = useState<string | null>(null)
  const [form, setForm]                 = useState(blankForm())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: LpsRestrictionStatus } | null>(null)

  // Fontes das sugestões (leitura direta, sem escrita automática).
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaAberta[]>([])
  const [equipesAContratar, setEquipesAContratar] = useState<EquipeAContratar[]>([])
  const [sugestoesErro, setSugestoesErro] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelado = false
    ;(async () => {
      try {
        const [ocorRes, eqRes] = await Promise.all([
          // Sem filtro de projeto: ocorrencias_obra tem linhas com projeto_id
          // null (mesma decisão de useCampoWhatsapp.ts).
          supabase!
            .from('ocorrencias_obra')
            .select('id, nucleo, rua, data, tipo, descricao, reportado_por')
            .eq('resolvida', false)
            .order('data', { ascending: false, nullsFirst: false }),
          supabase!
            .from('wcr_equipes')
            .select('id, nome, lider')
            .eq('ativo', true)
            .eq('a_contratar', true)
            .order('ordem'),
        ])
        if (cancelado) return
        if (ocorRes.error || eqRes.error) {
          setSugestoesErro(ocorRes.error?.message ?? eqRes.error?.message ?? 'Erro ao carregar fontes das sugestões')
          return
        }
        setOcorrencias((ocorRes.data ?? []) as OcorrenciaAberta[])
        setEquipesAContratar((eqRes.data ?? []) as EquipeAContratar[])
      } catch (err: any) {
        if (!cancelado) setSugestoesErro(err?.message ?? 'Erro ao carregar fontes das sugestões')
      }
    })()
    return () => { cancelado = true }
  }, [])

  const sugestoes = useMemo<SugestaoRestricao[]>(() => {
    const lista: SugestaoRestricao[] = []
    // (a) ocorrências abertas ainda sem restrição (dedup por origem contendo o id)
    for (const o of ocorrencias) {
      if (restrictions.some((r) => r.origem?.includes(o.id))) continue
      const local = [o.rua, o.nucleo].filter(Boolean).join(' · ')
      lista.push({
        chave: `oc-${o.id}`,
        rotulo: 'OCORRÊNCIA',
        tema: o.tipo ? o.tipo : 'ocorrência',
        descricao: `${local ? local + ': ' : ''}${o.descricao ?? 'Ocorrência sem descrição'}${o.data ? ` (${o.data})` : ''}`,
        tipoDb: tipoOcorrenciaParaTipoDb(o.tipo),
        origem: `promovida de ocorrencias_obra (id=${o.id})`,
        responsavel: o.reportado_por ?? '',
      })
    }
    // (b) equipes ativas a contratar sem restrição correspondente
    for (const e of equipesAContratar) {
      if (restrictions.some((r) => r.frenteId === e.id || r.origem?.includes(e.id))) continue
      lista.push({
        chave: `eq-${e.id}`,
        rotulo: 'EQUIPE A CONTRATAR',
        tema: 'mão de obra a contratar',
        descricao: `${e.nome} está ativa no organograma mas marcada "a contratar" — frente sem efetivo até a contratação.`,
        tipoDb: 'mao de obra',
        origem: `promovida de wcr_equipes a_contratar (id=${e.id})`,
        frenteId: e.id,
        responsavel: e.lider && e.lider !== 'A definir' ? e.lider : '',
      })
    }
    return lista
  }, [ocorrencias, equipesAContratar, restrictions])

  function promoverSugestao(s: SugestaoRestricao) {
    void addRestriction({
      tema: s.tema,
      categoria: tipoParaCategoria(s.tipoDb),
      descricao: s.descricao,
      impacto: '',
      responsavel: s.responsavel,
      prazoRemocao: '',
      acoesNecessarias: '',
      tags: [],
      observacoes: '',
      status: 'identificada',
      origem: s.origem,
      frenteId: s.frenteId,
      tipoDb: s.tipoDb,
    })
  }

  const today = new Date().toISOString().slice(0, 10)

  const visible = filter === 'all'
    ? restrictions
    : restrictions.filter((r) => r.status === filter)

  const counts = {
    total:        restrictions.length,
    identificada: restrictions.filter((r) => r.status === 'identificada').length,
    em_resolucao: restrictions.filter((r) => r.status === 'em_resolucao').length,
    resolvida:    restrictions.filter((r) => r.status === 'resolvida').length,
  }
  // IRR = tratadas/total (tratada = status <> 'identificada') — ver comentário do topo.
  const tratadas = counts.em_resolucao + counts.resolvida
  const irr = counts.total > 0 ? Math.round((tratadas / counts.total) * 100) : null

  function openNew() {
    setEditId(null)
    setForm(blankForm())
    setModalOpen(true)
  }

  function openEdit(r: LpsRestriction) {
    setEditId(r.id)
    setForm({
      tema: r.tema,
      categoria: r.categoria,
      descricao: r.descricao,
      impacto: r.impacto ?? '',
      responsavel: r.responsavel ?? '',
      prazoRemocao: r.prazoRemocao ?? '',
      acoesNecessarias: '',
      tags: [],
      observacoes: '',
      status: r.status,
    })
    setModalOpen(true)
  }

  const restricaoEmEdicao = editId ? restrictions.find((r) => r.id === editId) : undefined

  function handleSubmit() {
    if (!form.descricao.trim() && !form.tema.trim()) return
    if (editId) {
      updateRestriction(editId, form)
    } else {
      addRestriction(form)
    }
    setModalOpen(false)
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header + KPIs */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-white">Análise de Restrições</h2>
            <p className="text-[9px] text-[#6b6b6b] font-mono uppercase tracking-wider">TABELA lps_restricoes</p>
          </div>
          <KpiBadge label="TOTAL"        value={counts.total}        color="bg-[#484848] text-[#f5f5f5]" />
          <KpiBadge label="IDENTIFICADAS" value={counts.identificada} color="bg-red-900/50 text-red-300" />
          <KpiBadge label="EM RESOLUÇÃO"  value={counts.em_resolucao} color="bg-yellow-900/50 text-yellow-300" />
          <KpiBadge label="RESOLVIDAS"    value={counts.resolvida}    color="bg-green-900/50 text-green-300" />
          {/* IRR = tratadas/total */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1e293b] bg-[#0d1420] text-xs">
            <span className="font-bold text-lg leading-none font-mono [font-variant-numeric:tabular-nums] text-white">
              {irr === null ? '—' : `${irr}%`}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="uppercase tracking-wider text-[10px] text-[#a3a3a3]">IRR</span>
              <span className="text-[9px] text-[#6b6b6b]">tratadas/total</span>
            </span>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors"
        >
          <Plus size={14} /> Nova Restrição
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'identificada', 'em_resolucao', 'resolvida'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-orange-600 text-white'
                : 'bg-[#3d3d3d] text-[#a3a3a3] hover:bg-[#484848]'
            }`}
          >
            {f === 'all' ? 'Todas' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#3d3d3d] overflow-x-auto overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-10">
            Nenhuma restrição encontrada — 0 registros em lps_restricoes para este filtro/projeto.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#3d3d3d]/80 border-b border-[#525252]">
              <tr>
                <th className="text-left text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Categoria</th>
                <th className="text-left text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Tema / Descrição</th>
                <th className="text-left text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Responsável</th>
                <th className="text-left text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Prazo</th>
                <th className="text-left text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Origem</th>
                <th className="text-left text-[#a3a3a3] px-4 py-2.5 text-xs font-semibold">Status</th>
                <th className="px-4 py-2.5 text-xs" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3d3d]">
              {visible.map((r) => {
                const isExpired = r.prazoRemocao && r.prazoRemocao < today && r.status !== 'resolvida'
                return (
                  <tr
                    key={r.id}
                    className="bg-[#2c2c2c] hover:bg-[#3d3d3d]/50 transition-colors cursor-pointer"
                    onClick={() => openEdit(r)}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: CATEGORY_COLORS[r.categoria] + '30',
                          color: CATEGORY_COLORS[r.categoria],
                        }}
                        title={r.tipoDb ? `tipo no banco: ${r.tipoDb}` : undefined}
                      >
                        {CATEGORY_LABELS[r.categoria]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-white text-xs font-semibold">{r.tema}</p>
                      {r.descricao && r.descricao !== r.tema && (
                        <p className="text-[#6b6b6b] text-[10px] truncate">{r.descricao}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#a3a3a3] text-xs">{r.responsavel || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.prazoRemocao ? (
                        <span className={`flex items-center gap-1 font-mono [font-variant-numeric:tabular-nums] ${isExpired ? 'text-red-400' : 'text-[#f5f5f5]'}`}>
                          {isExpired && <AlertTriangle size={11} />}
                          {r.prazoRemocao}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      {r.origem
                        ? <span className="text-[#6b6b6b] text-[9px] font-mono truncate block" title={r.origem}>{r.origem}</span>
                        : <span className="text-gray-600 text-[9px]">manual</span>}
                    </td>
                    <td className="px-4 py-3 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                      {pendingStatus?.id === r.id ? (
                        <ConfirmDialog
                          message={`Alterar para ${STATUS_LABELS[pendingStatus.status]}?`}
                          confirmLabel="Alterar"
                          onConfirm={() => {
                            updateRestriction(r.id, {
                              status: pendingStatus.status,
                              resolvedAt: pendingStatus.status === 'resolvida' ? today : undefined,
                            })
                            setPendingStatus(null)
                          }}
                          onCancel={() => setPendingStatus(null)}
                          danger={false}
                        />
                      ) : (
                        <select
                          value={r.status}
                          onChange={(e) => setPendingStatus({ id: r.id, status: e.target.value as LpsRestrictionStatus })}
                          className={`bg-transparent text-xs font-semibold border-none outline-none cursor-pointer ${STATUS_COLORS[r.status]}`}
                        >
                          {(Object.keys(STATUS_LABELS) as LpsRestrictionStatus[]).map((s) => (
                            <option key={s} value={s} className="bg-[#2c2c2c] text-white">{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                      {confirmDeleteId === r.id ? (
                        <ConfirmDialog
                          message="Remover restrição?"
                          onConfirm={() => { removeRestriction(r.id); setConfirmDeleteId(null) }}
                          onCancel={() => setConfirmDeleteId(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* SUGESTÕES — candidatas geradas em runtime, promoção SEMPRE manual */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0d1420] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-bold text-white uppercase tracking-wider">
              Sugestões <span className="font-mono [font-variant-numeric:tabular-nums]">({sugestoes.length})</span>
            </p>
            <p className="text-[9px] text-slate-500 font-mono">
              ocorrencias_obra (não resolvidas) + wcr_equipes (ativas a contratar) — promoção manual, nada é inserido sozinho
            </p>
          </div>
        </div>
        {!supabase ? (
          <p className="text-slate-600 text-xs px-4 py-5">Supabase não configurado — sem fontes pra sugerir.</p>
        ) : sugestoesErro ? (
          <p className="text-red-400 text-xs px-4 py-5">Erro ao ler as fontes: {sugestoesErro}</p>
        ) : sugestoes.length === 0 ? (
          <p className="text-slate-600 text-xs px-4 py-5">
            Nenhuma candidata pendente — todas as ocorrências abertas e equipes a contratar já têm restrição correspondente.
          </p>
        ) : (
          <ul className="divide-y divide-[#1e293b]">
            {sugestoes.map((s) => (
              <li key={s.chave} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                  s.rotulo === 'OCORRÊNCIA' ? 'bg-amber-500/15 text-amber-400' : 'bg-violet-500/15 text-violet-300'
                }`}>
                  {s.rotulo}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-200 text-xs truncate" title={s.descricao}>
                    <span className="font-semibold">{s.tema}</span> — {s.descricao}
                  </p>
                  <p className="text-[9px] text-slate-600 font-mono truncate">{s.origem} · tipo: {s.tipoDb}</p>
                </div>
                <button
                  onClick={() => promoverSugestao(s)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#1e293b] bg-[#0a0f1a] hover:border-orange-500/50 text-orange-400 text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0"
                >
                  <ArrowUpRight size={11} /> Promover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252]">
              <h3 className="text-sm font-bold text-white">
                {editId ? 'Editar Restrição' : 'Nova Restrição'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-[#6b6b6b] hover:text-[#f5f5f5]">
                <X size={16} />
              </button>
            </div>

            {/* Modal body — só campos que lps_restricoes persiste de verdade */}
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Tema */}
              <FieldGroup label="Tema (rótulo curto)">
                <input
                  type="text"
                  value={form.tema}
                  onChange={(e) => setForm((f) => ({ ...f, tema: e.target.value }))}
                  placeholder="Ex: falta de manilha DN300"
                  className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </FieldGroup>

              {/* Categoria */}
              <FieldGroup label="Categoria">
                <select
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as LpsRestrictionCategory }))}
                  className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  {(Object.keys(CATEGORY_LABELS) as LpsRestrictionCategory[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </FieldGroup>

              {/* Descrição */}
              <FieldGroup label="Descrição / Restrição *">
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  rows={3}
                  placeholder="Descreva a restrição..."
                  className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </FieldGroup>

              {/* Impacto + Responsável row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup label="Impacto">
                  <input
                    type="text"
                    value={form.impacto}
                    onChange={(e) => setForm((f) => ({ ...f, impacto: e.target.value }))}
                    placeholder="Ex: Paralisa equipe B"
                    className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </FieldGroup>
                <FieldGroup label="Responsável">
                  <input
                    type="text"
                    value={form.responsavel}
                    onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                    placeholder="Ex: Compras / encarregado"
                    className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </FieldGroup>
              </div>

              {/* Prazo + Status row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup label="Prazo de Remoção">
                  <input
                    type="date"
                    value={form.prazoRemocao}
                    onChange={(e) => setForm((f) => ({ ...f, prazoRemocao: e.target.value }))}
                    className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </FieldGroup>
                <FieldGroup label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LpsRestrictionStatus }))}
                    className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    {(Object.keys(STATUS_LABELS) as LpsRestrictionStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </FieldGroup>
              </div>

              {/* Origem (somente leitura — rastreabilidade do seed/promoção) */}
              {restricaoEmEdicao?.origem && (
                <FieldGroup label="Origem (somente leitura)">
                  <p className="text-[10px] text-[#6b6b6b] font-mono break-all bg-[#3d3d3d]/50 border border-[#525252] rounded px-3 py-2">
                    {restricaoEmEdicao.origem}
                  </p>
                </FieldGroup>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#525252]">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-[#a3a3a3] hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.descricao.trim() && !form.tema.trim()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {editId ? 'Salvar' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${color} text-xs`}>
      <span className="font-bold text-lg leading-none font-mono [font-variant-numeric:tabular-nums]">{value}</span>
      <span className="uppercase tracking-wider text-[10px] opacity-80">{label}</span>
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
