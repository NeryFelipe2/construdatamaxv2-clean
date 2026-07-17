// ════════════════════════════════════════════════════════════════════════════
// Campo WhatsApp — "lista pra ir dando check" nas pendências extraídas dos
// grupos de campo (12/06–09/07/2026). 3 tabelas Supabase:
//   ocorrencias_obra • cadastro_ligacoes • bota_fora_viagens
// Visual segue o padrão de wcr-diario/index.tsx (dark slate + cards).
// ════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  MessageSquare, AlertTriangle, CheckCircle2, Home, Truck,
  Search, RotateCw, ClipboardCheck, Undo2,
} from 'lucide-react'
import { useCampoWhatsapp } from '@/hooks/useCampoWhatsapp'
import type { OcorrenciaObra, CadastroLigacao, BotaForaViagem } from '@/hooks/useCampoWhatsapp'
import { supabase } from '@/lib/supabase'

type Tab = 'ocorrencias' | 'ligacoes' | 'botafora'

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
  { key: 'ligacoes', label: 'Ligações casa-a-casa', icon: Home },
  { key: 'botafora', label: 'Bota-fora', icon: Truck },
]

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

function EstadoVazio() {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-10 text-center">
      <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
      <p className="text-sm text-slate-300 font-medium">Sem dados — verifique a conexão Supabase</p>
      <p className="text-xs text-slate-500 mt-1">
        As tabelas ocorrencias_obra, cadastro_ligacoes e bota_fora_viagens não retornaram linhas.
      </p>
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────
export function CampoWhatsappPage() {
  const { ocorrencias, cadastros, viagens, loading, error, reload, marcarOcorrencia, marcarCadastro } = useCampoWhatsapp()

  const [tab, setTab] = useState<Tab>('ocorrencias')

  // filtros — ocorrências
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [filtroStatusOcor, setFiltroStatusOcor] = useState<'todas' | 'pendentes' | 'resolvidas'>('todas')

  // filtros — ligações casa-a-casa
  const [filtroNucleo, setFiltroNucleo] = useState<string>('')
  const [filtroRua, setFiltroRua] = useState<string>('')
  const [filtroStatusCad, setFiltroStatusCad] = useState<string>('')
  const [buscaCasa, setBuscaCasa] = useState<string>('')

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

  const semDados = !supabase || (!loading && ocorrencias.length === 0 && cadastros.length === 0 && viagens.length === 0)

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
            onClick={() => reload()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
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
        <EstadoVazio />
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
        </>
      )}
    </div>
  )
}

export default CampoWhatsappPage
