import { useState } from 'react'
import {
  BarChart3, Users, ClipboardList, AlertTriangle, CheckCircle2,
  TrendingUp, Clock, Calendar, ArrowUpRight, ArrowDownRight,
  Briefcase, HardHat, Truck, Wrench, FileText, Target
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
type TabId = 'atividades' | 'produtividade' | 'performance'

// ─── Mock Data ──────────────────────────────────────────────────────────────
const MOCK_KPI = {
  nsAtivas: 45, nsAtrasadas: 27, nsHoje: 2, nsSemData: 4,
  tarefas: 276, tarefasAtrasadas: 52, tarefasHoje: 8, tarefasAmanha: 29,
  rdosHoje: 12, rdosPendentes: 3,
  metrosExecutados: 4850, metrosMeta: 6000,
  pvsCadastrados: 187, pvsTotal: 220,
}

const EXECUTORES = [
  { nome: 'Marcos Silva', avatar: '👷', tarefas: 19, atrasadas: 12, hoje: 7 },
  { nome: 'Ana Souza', avatar: '👩‍🔧', tarefas: 14, atrasadas: 8, hoje: 5 },
  { nome: 'Carlos Lima', avatar: '🧑‍💼', tarefas: 10, atrasadas: 4, hoje: 3 },
  { nome: 'Paula Costa', avatar: '👩‍💻', tarefas: 9, atrasadas: 2, hoje: 6 },
  { nome: 'Felipe Santos', avatar: '👨‍🔬', tarefas: 6, atrasadas: 1, hoje: 4 },
]

const FRENTES = [
  { nome: 'Pantanal Baixo', ns: 12, progresso: 78 },
  { nome: 'São Manoel', ns: 8, progresso: 62 },
  { nome: 'Vila Belmiro', ns: 5, progresso: 45 },
  { nome: 'Macuco', ns: 7, progresso: 88 },
]

const NOTIFICACOES = [
  { tipo: 'alerta', texto: 'NS 260213 com prazo vencido há 3 dias', hora: '08:45' },
  { tipo: 'ok', texto: 'RDO de ontem aprovado pela fiscalização', hora: '08:30' },
  { tipo: 'alerta', texto: 'Topografia pendente no trecho PV-042 a PV-048', hora: '07:55' },
  { tipo: 'info', texto: 'Medição de Março enviada para protocolo', hora: '07:20' },
  { tipo: 'ok', texto: 'Cadastro A4 gerado: 12 folhas NTS0292', hora: 'Ontem' },
  { tipo: 'alerta', texto: 'Falta de material: tubo PVC DN200 (estoque 0)', hora: 'Ontem' },
]

// ─── Helper Components ──────────────────────────────────────────────────────
function MetricCard({ title, value, icon: Icon, color, sub, badge, badgeColor }: {
  title: string; value: string | number; icon: any; color: string;
  sub?: string; badge?: string | number; badgeColor?: string;
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
            {typeof badge === 'number' ? `${badge} atrasadas` : badge}
          </span>
        )}
      </div>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  )
}

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-600 w-10 text-right">{pct}%</span>
    </div>
  )
}

function InlineBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-20 h-3 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export function Gestao360Page() {
  const [tab, setTab] = useState<TabId>('atividades')
  const maxTarefas = Math.max(...EXECUTORES.map(e => e.tarefas))

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] overflow-y-auto">

      {/* Tab Bar - eKyte style */}
      <div className="bg-[#1a47c2] text-white px-6 py-0 flex items-center gap-0 shrink-0">
        <div className="flex items-center gap-2 py-3 pr-6 border-r border-white/20">
          <HardHat size={18} className="text-white/80" />
          <span className="text-sm font-bold">Painel de Gestão 360</span>
          <span className="text-[10px] bg-white/20 rounded px-1.5 py-0.5 font-mono">(EDO300)</span>
        </div>
        <div className="flex items-center gap-1 px-4 text-white/60 text-xs">
          <Clock size={12} />
          <span>Atualizado agora há pouco</span>
        </div>
        <div className="ml-auto flex">
          {[
            { id: 'atividades' as TabId, label: 'Minhas atividades', sub: 'Executor' },
            { id: 'produtividade' as TabId, label: 'Gestão de produtividade', sub: 'Equipe' },
            { id: 'performance' as TabId, label: 'Gestão de performance', sub: 'Obra' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-xs font-semibold transition-all border-b-[3px] ${
                tab === t.id
                  ? 'border-white text-white bg-white/10'
                  : 'border-transparent text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <div>{t.label}</div>
              <div className="text-[9px] font-normal opacity-70">{t.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 p-5 space-y-5">

        {/* Row 1: Top KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          <MetricCard title="NS em Atendimento" value={MOCK_KPI.nsAtivas} icon={ClipboardList} color="text-blue-500"
            badge={MOCK_KPI.nsAtrasadas} badgeColor="bg-red-100 text-red-600"
            sub={`Hoje: ${MOCK_KPI.nsHoje} · Sem data: ${MOCK_KPI.nsSemData}`} />

          <MetricCard title="Tarefas" value={MOCK_KPI.tarefas} icon={CheckCircle2} color="text-green-500"
            badge={MOCK_KPI.tarefasAtrasadas} badgeColor="bg-orange-100 text-orange-600"
            sub={`Hoje: ${MOCK_KPI.tarefasHoje} · Amanhã: ${MOCK_KPI.tarefasAmanha}`} />

          <MetricCard title="RDOs Hoje" value={MOCK_KPI.rdosHoje} icon={FileText} color="text-indigo-500"
            badge={`${MOCK_KPI.rdosPendentes} pendentes`} badgeColor="bg-yellow-100 text-yellow-700" />

          <MetricCard title="Metros Executados" value={`${MOCK_KPI.metrosExecutados.toLocaleString()}m`} icon={TrendingUp} color="text-emerald-500"
            sub={`Meta: ${MOCK_KPI.metrosMeta.toLocaleString()}m`} />

          <MetricCard title="PVs Cadastrados" value={MOCK_KPI.pvsCadastrados} icon={Target} color="text-cyan-500"
            sub={`de ${MOCK_KPI.pvsTotal} planejados`} />

          <MetricCard title="Equipe em Campo" value={18} icon={Users} color="text-violet-500"
            badge="3 frentes" badgeColor="bg-blue-100 text-blue-600" />
        </div>

        {/* Row 2: Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Tarefas por Executor */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Tarefas até hoje por executor</h3>
              <span className="text-[10px] text-gray-400 font-mono">+</span>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_50px_70px_40px] text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-100">
                <span />
                <span className="text-center">Até hoje</span>
                <span className="text-center">Atrasadas</span>
                <span className="text-center">Hoje</span>
              </div>
              {EXECUTORES.map((e, i) => (
                <div key={i} className="grid grid-cols-[1fr_50px_70px_40px] items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{e.avatar}</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-gray-700 font-medium truncate">{e.nome}</span>
                      <InlineBar value={e.tarefas} max={maxTarefas} color="bg-blue-400" />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-800 text-center">{e.tarefas}</span>
                  <span className={`text-sm font-bold text-center ${e.atrasadas > 5 ? 'text-red-500' : 'text-orange-400'}`}>
                    {e.atrasadas}
                  </span>
                  <span className="text-sm font-bold text-gray-600 text-center">{e.hoje}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Frentes de Obra */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Frentes de Obra</h3>
              <span className="text-xs text-blue-500 font-medium cursor-pointer hover:underline">Ver todas</span>
            </div>
            <div className="space-y-4">
              {FRENTES.map((f, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">{f.nome}</span>
                    <span className="text-[10px] text-gray-400">{f.ns} NS</span>
                  </div>
                  <ProgressBar
                    value={f.progresso}
                    max={100}
                    color={f.progresso >= 80 ? 'bg-green-500' : f.progresso >= 50 ? 'bg-blue-500' : 'bg-orange-400'}
                  />
                </div>
              ))}
            </div>

            {/* Mini Summary */}
            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">4</div>
                <div className="text-[10px] text-gray-400">Frentes ativas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">68%</div>
                <div className="text-[10px] text-gray-400">Média progresso</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-500">2</div>
                <div className="text-[10px] text-gray-400">Com atraso</div>
              </div>
            </div>
          </div>

          {/* Notificações */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Notificações</h3>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                {NOTIFICACOES.filter(n => n.tipo === 'alerta').length}
              </span>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {NOTIFICACOES.map((n, i) => (
                <div key={i} className={`flex gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer hover:bg-gray-50 ${
                  n.tipo === 'alerta' ? 'border-red-200 bg-red-50/50' :
                  n.tipo === 'ok' ? 'border-green-200 bg-green-50/50' :
                  'border-gray-100'
                }`}>
                  {n.tipo === 'alerta' ? <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" /> :
                   n.tipo === 'ok' ? <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" /> :
                   <ArrowUpRight size={14} className="text-blue-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{n.texto}</p>
                    <span className="text-[10px] text-gray-400">{n.hora}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Execution tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Resumo de Execução */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Resumo de Execução</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Rede Executada', value: '4.850m', pct: 81, color: 'bg-blue-500', icon: TrendingUp },
                { label: 'Ligações', value: '312', pct: 72, color: 'bg-emerald-500', icon: Wrench },
                { label: 'PVs Executados', value: '187', pct: 85, color: 'bg-violet-500', icon: Target },
                { label: 'Cadastros Gerados', value: '156', pct: 90, color: 'bg-cyan-500', icon: FileText },
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900 mb-1">{item.value}</div>
                  <ProgressBar value={item.pct} max={100} color={item.color} />
                </div>
              ))}
            </div>
          </div>

          {/* Meus Apontamentos */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Apontamentos de Produtividade</h3>
            <div className="flex items-center gap-6 mb-5">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">57h 41m</div>
                <div className="text-[10px] text-gray-400">Ontem</div>
              </div>
              <div className="flex gap-2 items-center">
                {[
                  { label: '55%', color: 'bg-green-400' },
                  { label: '104h', color: 'bg-blue-400' },
                ].map((b, i) => (
                  <span key={i} className={`text-[10px] font-bold text-white px-2 py-0.5 rounded ${b.color}`}>{b.label}</span>
                ))}
              </div>
              <div className="text-center ml-auto">
                <div className="text-2xl font-bold text-gray-900">14h 53m</div>
                <div className="text-[10px] text-gray-400">Hoje</div>
              </div>
              <div className="flex gap-2">
                {[
                  { label: '14%', color: 'bg-orange-400' },
                  { label: '104h', color: 'bg-blue-400' },
                ].map((b, i) => (
                  <span key={i} className={`text-[10px] font-bold text-white px-2 py-0.5 rounded ${b.color}`}>{b.label}</span>
                ))}
              </div>
            </div>

            <h4 className="text-xs font-bold text-gray-600 mb-3">Apontamento por executor ontem</h4>
            <div className="space-y-2">
              {EXECUTORES.slice(0, 4).map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm">{e.avatar}</span>
                  <span className="text-xs text-gray-700 font-medium w-24 truncate">{e.nome}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i === 0 ? 'bg-green-400' : i === 1 ? 'bg-blue-400' : 'bg-orange-400'}`}
                      style={{ width: `${60 + i * 10}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-600 w-14 text-right">{6 - i}h {15 + i * 12}m</span>
                  <span className="text-[10px] text-gray-400 w-14 text-right">{7 - i}h {45 - i * 10}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
