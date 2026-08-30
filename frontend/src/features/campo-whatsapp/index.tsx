// ════════════════════════════════════════════════════════════════════════════
// Campo WhatsApp — "lista pra ir dando check" nas pendências extraídas dos
// grupos de campo (12/06–09/07/2026). 4 tabelas Supabase:
//   ocorrencias_obra • cadastro_ligacoes • bota_fora_viagens • whatsapp_midia
// Aba "Mídia" usa whatsapp_midia (1.679 mídias reais: fotos/vídeos/áudios dos
// grupos de produção) pra volume por dia/grupo, busca e lista — ver useWhatsappMidia.
// Visual segue o padrão de wcr-diario/index.tsx (dark slate + cards).
// ════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  MessageSquare, AlertTriangle, CheckCircle2, Home, Truck,
  Search, RotateCw, ClipboardCheck, Undo2,
  Image, Video, Mic, FileText, Smile, File as FileIcon,
} from 'lucide-react'
import { useCampoWhatsapp } from '@/hooks/useCampoWhatsapp'
import type { OcorrenciaObra, CadastroLigacao, BotaForaViagem } from '@/hooks/useCampoWhatsapp'
import { useWhatsappMidia } from '@/hooks/useWhatsappMidia'
import type { WhatsappMidiaItem } from '@/hooks/useWhatsappMidia'
import { supabase } from '@/lib/supabase'

type Tab = 'ocorrencias' | 'ligacoes' | 'botafora' | 'midia'

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
  { key: 'ligacoes', label: 'Ligações casa-a-casa', icon: Home },
  { key: 'botafora', label: 'Bota-fora', icon: Truck },
  { key: 'midia', label: 'Mídia (WhatsApp)', icon: Image },
]

// ─── Ícones por tipo de mídia ───────────────────────────────────────────────
const MIDIA_ICON: Record<string, any> = {
  foto: Image,
  video: Video,
  audio: Mic,
  documento: FileText,
  planilha: FileText,
  sticker: Smile,
  vcf: FileText,
}

function midiaIcon(tipo: string | null) {
  return MIDIA_ICON[tipo ?? ''] ?? FileIcon
}

/** Nome do grupo salvo com "_" no lugar de acentos/espaços — deixa legível sem inventar acentuação. */
function fmtGrupo(g: string): string {
  return g.replace(/_+/g, ' ').trim()
}

function fmtHora(h: string | null): string {
  if (!h) return '—'
  return h.slice(0, 5)
}

/** Dia efetivo de uma mídia: data_chat, com fallback pro timestamp embutido no nome do arquivo. */
function diaEfetivoMidia(m: WhatsappMidiaItem): string | null {
  if (m.data_chat) return m.data_chat.slice(0, 10)
  if (m.data_hora_nome_arquivo) return m.data_hora_nome_arquivo.slice(0, 10)
  return null
}

/** Gráfico de barras inline (SVG puro) — volume de mídias por dia. */
function MidiaDiaChart({ pontos }: { pontos: [string, number][] }) {
  const W = 700
  const H = 180
  const PAD = { left: 28, right: 12, top: 10, bottom: 26 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const max = Math.max(...pontos.map(([, c]) => c), 1)
  const n = pontos.length
  const barGap = 3
  const barW = Math.max(2, innerW / n - barGap)
  const labelStep = Math.max(1, Math.ceil(n / 12))

  function x(i: number) { return PAD.left + i * (innerW / n) }
  function barH(c: number) { return (c / max) * innerH }
  function y(c: number) { return PAD.top + innerH - barH(c) }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={PAD.left} y1={PAD.top + innerH} x2={W - PAD.right} y2={PAD.top + innerH} stroke="#334155" strokeWidth="1" />
      {pontos.map(([dia, count], i) => (
        <g key={dia}>
          <rect x={x(i)} y={y(count)} width={barW} height={barH(count)} fill="#10b981" opacity="0.85" rx="1">
            <title>{fmtData(dia)}: {count} mídia{count === 1 ? '' : 's'}</title>
          </rect>
          {i % labelStep === 0 && (
            <text x={x(i) + barW / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#64748b">
              {dia.slice(8, 10)}/{dia.slice(5, 7)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── Badges por tipo de ocorrência ──────────────────────────────────────────
const TIPO_BADGE: Record<string, string> = {
  vazamento: 'bg-red-500/20 text-red-300 border-red-500/40',
  embargo: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  falta_material: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  falta_epi: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  seguranca: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  reclamacao: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  manutencao: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  pendencia_admin: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  outro: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
}

const TIPO_LABEL: Record<string, string> = {
  vazamento: 'Vazamento',
  embargo: 'Embargo',
  falta_material: 'Falta material',
  falta_epi: 'Falta EPI',
  seguranca: 'Segurança',
  reclamacao: 'Reclamação',
  manutencao: 'Manutenção',
  pendencia_admin: 'Pend. admin',
  outro: 'Outro',
}

// ─── Badges por status do cadastro casa-a-casa ──────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  instalado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  verificado_ok: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  ja_baixado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  pendente: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  sem_relogio: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  falta_1_relogio: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  ausente: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  numero_nao_existe: 'bg-red-500/20 text-red-300 border-red-500/40',
  sem_agua: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  reparo_solicitado: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
}

function tipoBadgeCls(tipo: string | null): string {
  return TIPO_BADGE[tipo ?? ''] ?? TIPO_BADGE.outro
}

function tipoLabel(tipo: string | null): string {
  if (!tipo) return '—'
  return TIPO_LABEL[tipo] ?? tipo.replace(/_/g, ' ')
}

function statusBadgeCls(status: string | null): string {
  return STATUS_BADGE[status ?? ''] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
}

/** 'YYYY-MM-DD' → 'dd/mm/aaaa' sem passar por new Date() (evita shift de timezone). */
function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function fmtValor(v: number | null): string | null {
  if (v == null) return null
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Componentes básicos ────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${accent}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase text-slate-400 font-medium tracking-wide">{label}</div>
        <div className="text-2xl font-bold text-white mt-1">{value}</div>
      </div>
    </div>
  )
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
        ativo
          ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

function EstadoVazio({ mensagem }: { mensagem?: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-10 text-center">
      <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
      <p className="text-sm text-slate-300 font-medium">Sem dados — verifique a conexão Supabase</p>
      <p className="text-xs text-slate-500 mt-1">
        {mensagem ?? 'As tabelas ocorrencias_obra, cadastro_ligacoes e bota_fora_viagens não retornaram linhas.'}
      </p>
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────
export function CampoWhatsappPage() {
  const { ocorrencias, cadastros, viagens, loading, error, reload, marcarOcorrencia, marcarCadastro } = useCampoWhatsapp()
  const { itens: midias, loading: midiaLoading, error: midiaError, reload: reloadMidia } = useWhatsappMidia()

  const [tab, setTab] = useState<Tab>('ocorrencias')

  // filtros — ocorrências
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [filtroStatusOcor, setFiltroStatusOcor] = useState<'todas' | 'pendentes' | 'resolvidas'>('todas')

  // filtros — ligações casa-a-casa
  const [filtroNucleo, setFiltroNucleo] = useState<string>('')
  const [filtroRua, setFiltroRua] = useState<string>('')
  const [filtroStatusCad, setFiltroStatusCad] = useState<string>('')
  const [buscaCasa, setBuscaCasa] = useState<string>('')

  // filtros — mídia WhatsApp
  const [filtroGrupoMidia, setFiltroGrupoMidia] = useState<string>('')
  const [filtroTipoMidia, setFiltroTipoMidia] = useState<string>('')
  const [buscaMidia, setBuscaMidia] = useState<string>('')

  // ── Stats ──
  const ocorPendentes = useMemo(() => ocorrencias.filter((o) => !o.resolvida).length, [ocorrencias])
  const ocorResolvidas = ocorrencias.length - ocorPendentes
  const casasPendentes = useMemo(() => cadastros.filter((c) => !c.resolvida).length, [cadastros])
  const casasOk = cadastros.length - casasPendentes
  const totalViagens = useMemo(
    () => viagens.reduce((acc, v) => acc + (v.quantidade_viagens ?? 0), 0),
    [viagens],
  )

  // ── Ocorrências filtradas ──
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>()
    ocorrencias.forEach((o) => { if (o.tipo) set.add(o.tipo) })
    return Array.from(set).sort()
  }, [ocorrencias])

  const ocorrenciasFiltradas = useMemo(() => {
    return ocorrencias.filter((o) => {
      if (filtroTipo && o.tipo !== filtroTipo) return false
      if (filtroStatusOcor === 'pendentes' && o.resolvida) return false
      if (filtroStatusOcor === 'resolvidas' && !o.resolvida) return false
      return true
    })
  }, [ocorrencias, filtroTipo, filtroStatusOcor])

  // ── Cadastros filtrados ──
  const nucleosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    cadastros.forEach((c) => { if (c.nucleo) set.add(c.nucleo) })
    return Array.from(set).sort()
  }, [cadastros])

  const ruasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    cadastros.forEach((c) => {
      if (filtroNucleo && c.nucleo !== filtroNucleo) return
      if (c.rua) set.add(c.rua)
    })
    return Array.from(set).sort()
  }, [cadastros, filtroNucleo])

  const statusDisponiveis = useMemo(() => {
    const set = new Set<string>()
    cadastros.forEach((c) => { if (c.status) set.add(c.status) })
    return Array.from(set).sort()
  }, [cadastros])

  const cadastrosFiltrados = useMemo(() => {
    return cadastros.filter((c) => {
      if (filtroNucleo && c.nucleo !== filtroNucleo) return false
      if (filtroRua && c.rua !== filtroRua) return false
      if (filtroStatusCad && c.status !== filtroStatusCad) return false
      if (buscaCasa && !(c.numero_casa ?? '').toLowerCase().includes(buscaCasa.toLowerCase())) return false
      return true
    })
  }, [cadastros, filtroNucleo, filtroRua, filtroStatusCad, buscaCasa])

  // ── Mídia WhatsApp — agregados ──
  const gruposMidiaDisponiveis = useMemo(() => {
    const set = new Set<string>()
    midias.forEach((m) => set.add(m.grupo))
    return Array.from(set).sort()
  }, [midias])

  const tiposMidiaDisponiveis = useMemo(() => {
    const set = new Set<string>()
    midias.forEach((m) => { if (m.tipo) set.add(m.tipo) })
    return Array.from(set).sort()
  }, [midias])

  const midiasPorGrupo = useMemo(() => {
    const map = new Map<string, number>()
    midias.forEach((m) => map.set(m.grupo, (map.get(m.grupo) ?? 0) + 1))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [midias])

  const midiasPorTipo = useMemo(() => {
    const map = new Map<string, number>()
    midias.forEach((m) => { const t = m.tipo ?? 'outro'; map.set(t, (map.get(t) ?? 0) + 1) })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [midias])

  const midiasPorDia = useMemo(() => {
    const map = new Map<string, number>()
    midias.forEach((m) => {
      const d = diaEfetivoMidia(m)
      if (!d) return
      map.set(d, (map.get(d) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [midias])

  const midiasSemData = useMemo(() => midias.filter((m) => !diaEfetivoMidia(m)).length, [midias])

  const midiasFiltradas = useMemo(() => {
    const termo = buscaMidia.trim().toLowerCase()
    return midias.filter((m) => {
      if (filtroGrupoMidia && m.grupo !== filtroGrupoMidia) return false
      if (filtroTipoMidia && m.tipo !== filtroTipoMidia) return false
      if (termo) {
        const alvo = `${m.arquivo} ${m.autor ?? ''} ${fmtGrupo(m.grupo)}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [midias, filtroGrupoMidia, filtroTipoMidia, buscaMidia])

  const MIDIA_LISTA_LIMITE = 150
  const midiasExibidas = midiasFiltradas.slice(0, MIDIA_LISTA_LIMITE)

  const semDadosLegado = !loading && ocorrencias.length === 0 && cadastros.length === 0 && viagens.length === 0
  const semDadosMidia = !midiaLoading && midias.length === 0
  const semDados = !supabase || (tab === 'midia' ? semDadosMidia : semDadosLegado)

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40">
            <MessageSquare className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Campo WhatsApp</h1>
            <p className="text-sm text-slate-400">
              Dados reais extraídos dos grupos de campo (12/06–09/07/2026) — fonte citada em cada item
            </p>
          </div>
          <button
            onClick={() => { reload(); reloadMidia() }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading || midiaLoading ? 'animate-spin' : ''}`} />
            Recarregar
          </button>
        </div>
        {(error || midiaError) && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {error || midiaError}
          </p>
        )}
      </div>

      {/* StatCards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={AlertTriangle} label="Ocorrências pendentes" value={ocorPendentes} accent="bg-red-500" />
        <StatCard icon={CheckCircle2} label="Ocorrências resolvidas" value={ocorResolvidas} accent="bg-emerald-500" />
        <StatCard icon={Home} label="Casas pendentes" value={casasPendentes} accent="bg-amber-500" />
        <StatCard icon={ClipboardCheck} label="Casas ok" value={casasOk} accent="bg-cyan-500" />
        <StatCard icon={Truck} label="Viagens bota-fora" value={totalViagens} accent="bg-orange-500" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-700 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const ativo = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                ativo
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {semDados ? (
        <EstadoVazio mensagem={tab === 'midia' ? 'A tabela whatsapp_midia não retornou linhas.' : undefined} />
      ) : (
        <>
          {/* ══ Aba Ocorrências ══ */}
          {tab === 'ocorrencias' && (
            <div>
              {/* Filtros */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-500 uppercase font-medium mr-1">Tipo:</span>
                  <Chip ativo={filtroTipo === ''} onClick={() => setFiltroTipo('')}>Todos</Chip>
                  {tiposDisponiveis.map((t) => (
                    <Chip key={t} ativo={filtroTipo === t} onClick={() => setFiltroTipo(filtroTipo === t ? '' : t)}>
                      {tipoLabel(t)}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-500 uppercase font-medium mr-1">Status:</span>
                  {(['todas', 'pendentes', 'resolvidas'] as const).map((s) => (
                    <Chip key={s} ativo={filtroStatusOcor === s} onClick={() => setFiltroStatusOcor(s)}>
                      {s === 'todas' ? 'Todas' : s === 'pendentes' ? 'Pendentes' : 'Resolvidas'}
                    </Chip>
                  ))}
                  <span className="text-xs text-slate-400 ml-auto">
                    {ocorrenciasFiltradas.length} de {ocorrencias.length} ocorrências
                  </span>
                </div>
              </div>

              {/* Lista */}
              <div className="space-y-2">
                {ocorrenciasFiltradas.map((o: OcorrenciaObra) => (
                  <div
                    key={o.id}
                    className={`bg-slate-900/60 border border-slate-700 rounded-xl p-4 transition-opacity ${o.resolvida ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase border ${tipoBadgeCls(o.tipo)}`}>
                            {tipoLabel(o.tipo)}
                          </span>
                          <span className="text-xs font-mono text-slate-500">{fmtData(o.data)}</span>
                          {(o.nucleo || o.rua) && (
                            <span className="text-xs text-slate-400">
                              {[o.nucleo, o.rua].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${o.resolvida ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                          {o.descricao ?? '—'}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                          {o.reportado_por && (
                            <span className="text-xs text-slate-400">
                              Reportado por: <span className="text-orange-300">{o.reportado_por}</span>
                            </span>
                          )}
                          {o.origem_fonte && (
                            <span className="text-xs text-slate-500" title={o.origem_fonte}>
                              Fonte: {o.origem_fonte}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => marcarOcorrencia(o.id, !o.resolvida)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 ${
                          o.resolvida
                            ? 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white hover:border-slate-400'
                            : 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'
                        }`}
                      >
                        {o.resolvida ? (<><Undo2 className="w-3.5 h-3.5" /> Reabrir</>) : (<><CheckCircle2 className="w-3.5 h-3.5" /> Resolver</>)}
                      </button>
                    </div>
                  </div>
                ))}
                {ocorrenciasFiltradas.length === 0 && (
                  <div className="text-center text-sm text-slate-500 py-8">Nenhuma ocorrência com esses filtros.</div>
                )}
              </div>
            </div>
          )}

          {/* ══ Aba Ligações casa-a-casa ══ */}
          {tab === 'ligacoes' && (
            <div>
              {/* Filtros */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-500 uppercase font-medium mr-1">Núcleo:</span>
                  <Chip ativo={filtroNucleo === ''} onClick={() => { setFiltroNucleo(''); setFiltroRua('') }}>Todos</Chip>
                  {nucleosDisponiveis.map((n) => (
                    <Chip
                      key={n}
                      ativo={filtroNucleo === n}
                      onClick={() => { setFiltroNucleo(filtroNucleo === n ? '' : n); setFiltroRua('') }}
                    >
                      {n}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={filtroRua}
                    onChange={(e) => setFiltroRua(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">Todas as ruas ({ruasDisponiveis.length})</option>
                    {ruasDisponiveis.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    value={filtroStatusCad}
                    onChange={(e) => setFiltroStatusCad(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">Todos os status</option>
                    {statusDisponiveis.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <div className="flex-1 min-w-[180px] relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={buscaCasa}
                      onChange={(e) => setBuscaCasa(e.target.value)}
                      placeholder="Buscar por número da casa..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tabela */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 text-xs text-slate-400 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" />
                  {cadastrosFiltrados.length} de {cadastros.length} casas
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-500 uppercase text-[10px] tracking-wide">
                        <th className="px-3 py-2 text-center w-10" title="Check (resolvida)">✓</th>
                        <th className="px-3 py-2 text-left">Rua</th>
                        <th className="px-3 py-2 text-left">Nº</th>
                        <th className="px-3 py-2 text-left">Morador</th>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-center">HMs</th>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Obs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cadastrosFiltrados.map((c: CadastroLigacao) => (
                        <tr
                          key={c.id}
                          className={`border-b border-slate-800 hover:bg-slate-800/40 transition-colors ${c.resolvida ? 'opacity-50' : ''}`}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={c.resolvida}
                              onChange={() => marcarCadastro(c.id, !c.resolvida)}
                              className="accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-300" title={c.origem_fonte ?? undefined}>{c.rua ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-200 font-mono">{c.numero_casa ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-300">{c.nome_morador ?? '—'}</td>
                          <td className="px-3 py-2">
                            {c.tipo ? (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                                c.tipo === 'esgoto' ? 'bg-purple-500/20 text-purple-300' : 'bg-cyan-500/20 text-cyan-300'
                              }`}>{c.tipo}</span>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {c.status ? (
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] border whitespace-nowrap ${statusBadgeCls(c.status)}`}>
                                {c.status.replace(/_/g, ' ')}
                              </span>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-300 font-mono">{c.hidrometros_qtd ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{fmtData(c.data)}</td>
                          <td className="px-3 py-2 text-slate-500 max-w-[180px] truncate" title={c.obs ?? undefined}>{c.obs ?? ''}</td>
                        </tr>
                      ))}
                      {cadastrosFiltrados.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-3 py-8 text-center text-slate-500">Nenhuma casa com esses filtros.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ Aba Bota-fora ══ */}
          {tab === 'botafora' && (
            <div className="space-y-3">
              {viagens.map((v: BotaForaViagem) => (
                <div key={v.id} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">{fmtData(v.data)}</span>
                        {v.quantidade_viagens != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-orange-500/20 text-orange-300 border-orange-500/40">
                            {v.quantidade_viagens} {v.quantidade_viagens === 1 ? 'viagem' : 'viagens'}
                          </span>
                        )}
                        {v.fornecedor && (
                          <span className="text-xs text-slate-300">
                            <Truck className="w-3 h-3 inline mr-1 text-orange-400" />
                            {v.fornecedor}
                          </span>
                        )}
                      </div>
                      {v.descricao && <p className="text-sm text-slate-200">{v.descricao}</p>}
                      {v.obs && <p className="text-xs text-slate-400 mt-1">{v.obs}</p>}
                      {v.origem_fonte && (
                        <p className="text-xs text-slate-500 mt-1" title={v.origem_fonte}>Fonte: {v.origem_fonte}</p>
                      )}
                    </div>
                    {fmtValor(v.valor) && (
                      <div className="text-lg font-bold text-emerald-400 flex-shrink-0">{fmtValor(v.valor)}</div>
                    )}
                  </div>
                </div>
              ))}
              {viagens.length === 0 && (
                <div className="text-center text-sm text-slate-500 py-8">Nenhuma viagem de bota-fora registrada.</div>
              )}
            </div>
          )}

          {/* ══ Aba Mídia (WhatsApp) ══ */}
          {tab === 'midia' && (
            <div className="space-y-4">
              {/* Aviso honesto — sem storage_url, não há preview de imagem */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-200">
                  {midias.length} mídias reais capturadas dos grupos (grupo, autor, tipo e data/hora vêm direto do banco).
                  Nenhum arquivo tem <code className="text-amber-100">storage_url</code> salvo hoje — por isso não há
                  pré-visualização de imagem, só os metadados reais de cada envio.
                </p>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Image} label="Mídias capturadas" value={midias.length} accent="bg-emerald-500" />
                <StatCard icon={RotateCw} label="Dias com atividade" value={midiasPorDia.length} accent="bg-sky-500" />
                <StatCard icon={Home} label="Grupos ativos" value={gruposMidiaDisponiveis.length} accent="bg-purple-500" />
                <StatCard icon={AlertTriangle} label="Sem data identificada" value={midiasSemData} accent="bg-slate-500" />
              </div>

              {/* Volume por dia */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Volume de mídias por dia</h3>
                {midiasPorDia.length > 0 ? (
                  <MidiaDiaChart pontos={midiasPorDia} />
                ) : (
                  <p className="text-xs text-slate-500">Sem datas identificadas para plotar.</p>
                )}
              </div>

              {/* Volume por grupo */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Volume por grupo</h3>
                <div className="space-y-2">
                  {midiasPorGrupo.map(([grupo, count]) => {
                    const max = midiasPorGrupo[0]?.[1] ?? 1
                    return (
                      <div key={grupo} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-56 truncate flex-shrink-0" title={fmtGrupo(grupo)}>
                          {fmtGrupo(grupo)}
                        </span>
                        <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500/70" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-slate-300 w-10 text-right">{count}</span>
                      </div>
                    )
                  })}
                  {midiasPorGrupo.length === 0 && (
                    <p className="text-xs text-slate-500">Nenhum grupo com mídia.</p>
                  )}
                </div>
              </div>

              {/* Breakdown por tipo */}
              <div className="flex flex-wrap gap-2">
                {midiasPorTipo.map(([tipoMidia, count]) => {
                  const Icon = midiaIcon(tipoMidia)
                  return (
                    <span
                      key={tipoMidia}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-slate-800/60 border border-slate-700 text-slate-300"
                    >
                      <Icon className="w-3.5 h-3.5" /> {tipoMidia} <span className="text-slate-500">({count})</span>
                    </span>
                  )
                })}
              </div>

              {/* Filtros */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-3">
                <select
                  value={filtroGrupoMidia}
                  onChange={(e) => setFiltroGrupoMidia(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  <option value="">Todos os grupos ({gruposMidiaDisponiveis.length})</option>
                  {gruposMidiaDisponiveis.map((g) => (
                    <option key={g} value={g}>{fmtGrupo(g)}</option>
                  ))}
                </select>
                <select
                  value={filtroTipoMidia}
                  onChange={(e) => setFiltroTipoMidia(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  <option value="">Todos os tipos</option>
                  {tiposMidiaDisponiveis.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={buscaMidia}
                    onChange={(e) => setBuscaMidia(e.target.value)}
                    placeholder="Buscar por autor, grupo ou arquivo..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Lista */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 text-xs text-slate-400 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" />
                  Mostrando {midiasExibidas.length} de {midiasFiltradas.length} mídias
                  {midiasFiltradas.length > MIDIA_LISTA_LIMITE && ' (refine a busca para ver mais)'}
                </div>
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="border-b border-slate-700 text-slate-500 uppercase text-[10px] tracking-wide">
                        <th className="px-3 py-2 text-left w-8"></th>
                        <th className="px-3 py-2 text-left">Grupo</th>
                        <th className="px-3 py-2 text-left">Autor</th>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-left">Hora</th>
                        <th className="px-3 py-2 text-left">Arquivo</th>
                        <th className="px-3 py-2 text-center">No chat?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {midiasExibidas.map((m: WhatsappMidiaItem) => {
                        const Icon = midiaIcon(m.tipo)
                        const dia = diaEfetivoMidia(m)
                        return (
                          <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                            <td className="px-3 py-2"><Icon className="w-3.5 h-3.5 text-slate-400" /></td>
                            <td className="px-3 py-2 text-slate-300" title={m.grupo}>{fmtGrupo(m.grupo)}</td>
                            <td className="px-3 py-2 text-slate-300">{m.autor ?? '—'}</td>
                            <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{fmtData(dia)}</td>
                            <td className="px-3 py-2 text-slate-400 font-mono">{fmtHora(m.hora_chat)}</td>
                            <td className="px-3 py-2 text-slate-500 max-w-[220px] truncate font-mono" title={m.arquivo}>
                              {m.arquivo}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {m.encontrado_no_chat
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
                                : <span className="text-slate-600">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                      {midiasExibidas.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Nenhuma mídia com esses filtros.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CampoWhatsappPage
