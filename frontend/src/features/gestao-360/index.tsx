import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  HardHat,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react'
import { useProjectContext, selectActiveProjeto } from '@/store/projectContext'
import { useSupabaseGestao } from '@/hooks/useSupabaseGestao'
import { ControleFinanceiroPanel } from './components/ControleFinanceiroPanel'
import { TimelineOperacaoPanel } from './components/TimelineOperacaoPanel'

type TabId = 'dashboard' | 'financeiro'
type ConnectionStatus = 'connected' | 'partial' | 'local'

function MetricCard({
  title,
  value,
  icon: Icon,
  color,
  sub,
  badge,
  badgeColor,
}: {
  title: string
  value: string | number
  icon: any
  color: string
  sub?: string
  badge?: string | number
  badgeColor?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        <Icon size={18} className={color} />
      </div>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {badge !== undefined && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${badgeColor || 'bg-red-100 text-red-600'}`}>
            {typeof badge === 'number' ? `${badge}` : badge}
          </span>
        )}
      </div>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  )
}

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-600 w-10 text-right">{pct}%</span>
    </div>
  )
}

function ConnectionBadge({ status, loading }: { status: ConnectionStatus; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/20 text-blue-200 text-[10px] font-mono">
        <Loader2 size={10} className="animate-spin" />
        <span>Carregando integracoes...</span>
      </div>
    )
  }

  const config = status === 'connected'
    ? { className: 'bg-green-500/20 text-green-300', label: 'Canonico', icon: <Wifi size={10} /> }
    : status === 'partial'
      ? { className: 'bg-yellow-500/20 text-yellow-300', label: 'Parcial', icon: <Wifi size={10} /> }
      : { className: 'bg-red-500/20 text-red-300', label: 'Local', icon: <WifiOff size={10} /> }

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono ${config.className}`}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  )
}

export function Gestao360Page() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const { activeProjectId } = useProjectContext()
  const activeProjeto = useProjectContext(selectActiveProjeto)
  const {
    loading,
    error,
    kpi,
    frentes,
    contatos,
    rdos,
    notificacoes,
    projetoNome,
    isConnected,
    connectionStatus,
    refresh,
  } = useSupabaseGestao(activeProjectId)

  useEffect(() => {
    if (activeProjectId) refresh()
  }, [activeProjectId, refresh])

  const execucaoItems = [
    { label: 'Extensao Planejada', value: `${(kpi.extensaoTotal / 1000).toFixed(1)}km`, pct: 100, icon: TrendingUp },
    { label: 'Frentes Ativas', value: String(kpi.frentesAtivas), pct: kpi.totalFrentes > 0 ? Math.round((kpi.frentesAtivas / kpi.totalFrentes) * 100) : 0, icon: Target },
    { label: 'PVs Total', value: String(kpi.pvsTotal), pct: kpi.pvsTotal > 0 ? Math.round((kpi.pvsCadastrados / kpi.pvsTotal) * 100) : 0, icon: Wrench },
    { label: 'RDOs Registrados', value: String(kpi.totalRdos), pct: kpi.totalRdos > 0 ? Math.round((kpi.rdosFechados / kpi.totalRdos) * 100) : 0, icon: FileText },
  ]

  const statusValue = connectionStatus === 'connected' ? 'LIVE' : connectionStatus === 'partial' ? 'PARCIAL' : 'LOCAL'
  const statusSub = connectionStatus === 'connected'
    ? 'API canonica conectada'
    : connectionStatus === 'partial'
      ? 'Fallback operacional ativo'
      : 'Sem dados canonicos'

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] overflow-y-auto">
      <div className="bg-[#1a47c2] text-white px-6 py-0 flex items-center gap-0 shrink-0">
        <div className="flex items-center gap-2 py-3 pr-6 border-r border-white/20">
          <HardHat size={18} className="text-white/80" />
          <span className="text-sm font-bold">Painel de Gestao 360</span>
          <ConnectionBadge status={connectionStatus} loading={loading} />
        </div>
        <div className="flex items-center gap-2 px-4">
          <button
            onClick={() => refresh()}
            className="text-white/60 hover:text-white transition-colors p-1 rounded"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <span className="text-white/60 text-xs">{activeProjeto?.nome || projetoNome}</span>
        </div>
        <div className="ml-auto flex">
          {[
            { id: 'dashboard' as TabId, label: 'Dashboard', sub: 'Visao geral' },
            { id: 'financeiro' as TabId, label: 'Painel Financeiro', sub: 'EVM & Custos' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-5 py-3 text-xs font-semibold transition-all border-b-[3px] ${
                tab === item.id
                  ? 'border-white text-white bg-white/10'
                  : 'border-transparent text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <div>{item.label}</div>
              <div className="text-[9px] font-normal opacity-70">{item.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>Erro ao carregar dados: {error}</span>
          <button onClick={refresh} className="ml-auto text-red-500 hover:text-red-700 font-bold">Tentar novamente</button>
        </div>
      )}

      {tab === 'dashboard' && (
      <div className="flex-1 p-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          <MetricCard
            title="Frentes de Obra"
            value={kpi.totalFrentes}
            icon={ClipboardList}
            color="text-blue-500"
            badge={kpi.frentesPausadas > 0 ? `${kpi.frentesPausadas} pausadas` : undefined}
            badgeColor="bg-orange-100 text-orange-600"
            sub={`Ativas: ${kpi.frentesAtivas} · Pausadas: ${kpi.frentesPausadas}`}
          />
          <MetricCard
            title="RDOs Hoje"
            value={kpi.rdosHoje}
            icon={FileText}
            color="text-indigo-500"
            badge={kpi.rdosPendentes > 0 ? `${kpi.rdosPendentes} pendentes` : undefined}
            badgeColor="bg-yellow-100 text-yellow-700"
            sub={`Total: ${kpi.totalRdos} · Fechados: ${kpi.rdosFechados}`}
          />
          <MetricCard
            title="Extensao Total"
            value={`${(kpi.extensaoTotal / 1000).toFixed(1)}km`}
            icon={TrendingUp}
            color="text-emerald-500"
            sub={`${kpi.totalFrentes} frentes planejadas`}
          />
          <MetricCard
            title="PVs Total"
            value={kpi.pvsTotal}
            icon={Target}
            color="text-cyan-500"
            sub="Pocos de visita planejados"
          />
          <MetricCard
            title="Equipe em Campo"
            value={kpi.equipeCampo}
            icon={Users}
            color="text-violet-500"
            badge={`${kpi.contatosAtivos} total`}
            badgeColor="bg-blue-100 text-blue-600"
          />
          <MetricCard
            title="Status Dados"
            value={statusValue}
            icon={Database}
            color={isConnected ? 'text-green-500' : 'text-red-500'}
            sub={statusSub}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Equipe do Projeto</h3>
              <span className="text-[10px] text-gray-400 font-mono">{contatos.length} membros</span>
            </div>
            {contatos.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Nenhum membro cadastrado</p>
                <p className="text-[10px] mt-1">Cadastre contatos na base canônica</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_80px] text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-100">
                  <span />
                  <span className="text-center">Cargo</span>
                </div>
                {contatos.map((contato) => (
                  <div key={contato.id} className="grid grid-cols-[1fr_80px] items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{contato.avatar}</span>
                      <div className="min-w-0">
                        <span className="text-xs text-gray-700 font-medium truncate block">{contato.nome}</span>
                        <span className="text-[10px] text-gray-400 truncate block">{contato.telefone}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-500 text-center truncate">{contato.cargo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Frentes de Obra</h3>
              <span className="text-xs text-blue-500 font-medium">{kpi.frentesAtivas} ativas</span>
            </div>
            {frentes.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Target size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Nenhuma frente cadastrada</p>
              </div>
            ) : (
              <div className="space-y-4">
                {frentes.map((frente) => (
                  <div key={frente.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">{frente.nome}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          frente.status === 'ativa' ? 'bg-green-100 text-green-700'
                            : frente.status === 'pausada' ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}>{frente.status}</span>
                        <span className="text-[10px] text-gray-400">{frente.pvs} PVs</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 mb-1">{frente.setor} · {(frente.extensaoTotal / 1000).toFixed(1)}km</div>
                    <ProgressBar value={frente.progresso} max={100} color={frente.status === 'ativa' ? 'bg-blue-500' : 'bg-gray-300'} />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{kpi.frentesAtivas}</div>
                <div className="text-[10px] text-gray-400">Ativas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-500">{(kpi.extensaoTotal / 1000).toFixed(1)}km</div>
                <div className="text-[10px] text-gray-400">Extensao total</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-500">{kpi.frentesPausadas}</div>
                <div className="text-[10px] text-gray-400">Pausadas</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Notificacoes</h3>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                {notificacoes.filter((item) => item.tipo === 'alerta').length}
              </span>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {notificacoes.map((item, index) => (
                <div
                  key={`${item.tipo}-${index}`}
                  className={`flex gap-3 p-2.5 rounded-lg border ${
                    item.tipo === 'alerta' ? 'border-red-200 bg-red-50/50'
                      : item.tipo === 'ok' ? 'border-green-200 bg-green-50/50'
                        : 'border-gray-100'
                  }`}
                >
                  {item.tipo === 'alerta'
                    ? <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                    : item.tipo === 'ok'
                      ? <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                      : <ArrowUpRight size={14} className="text-blue-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{item.texto}</p>
                    <span className="text-[10px] text-gray-400">{item.hora}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Resumo de Execucao</h3>
            <div className="grid grid-cols-2 gap-4">
              {execucaoItems.map((item, index) => {
                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-cyan-500']
                return (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900 mb-1">{item.value}</div>
                    <ProgressBar value={item.pct} max={100} color={colors[index] || 'bg-blue-500'} />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">RDOs Recentes</h3>
            {rdos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Nenhum RDO registrado</p>
                <p className="text-xs mt-1">Os RDOs enviados pelo WhatsApp aparecerao aqui</p>
                <p className="text-[10px] mt-2 text-gray-300">Pipeline: WhatsApp {'->'} n8n {'->'} Supabase {'->'} Dashboard</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {rdos.slice(0, 10).map((rdo) => (
                  <div key={rdo.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <div className={`w-2 h-2 rounded-full ${rdo.status === 'fechado' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700">{rdo.frenteNome}</div>
                      <div className="text-[10px] text-gray-400">{rdo.data} · {rdo.clima} · {rdo.turno}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      rdo.status === 'fechado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {rdo.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <TimelineOperacaoPanel projetoId={activeProjectId} />
      </div>
      )}

      {tab === 'financeiro' && (
        <div className="flex-1 overflow-y-auto px-6 py-6 border-t border-gray-200">
          <ControleFinanceiroPanel />
        </div>
      )}
    </div>
  )
}
