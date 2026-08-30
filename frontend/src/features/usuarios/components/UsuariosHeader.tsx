/**
 * UsuariosHeader — barra superior (título · KPIs · abas) do módulo
 * Usuários & Acessos. Molde: EvmHeader / PessoalHeader.
 *
 * KPIs honestos: valor null vira "—" com a razão em `note` — nunca zero
 * fabricado quando a Edge Function não respondeu.
 */
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export type UsuariosTab = 'acessos' | 'convites'

const TABS: { key: UsuariosTab; label: string }[] = [
  { key: 'acessos', label: 'Quem tem acesso' },
  { key: 'convites', label: 'Convites pendentes' },
]

function KpiCard({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <div
      className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[140px]"
      title={value == null ? note : undefined}
    >
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      <p className="font-mono text-lg font-semibold" style={{ color: value == null ? '#6b6b6b' : '#f5f5f5' }}>
        {value == null ? '—' : value}
      </p>
      {value == null && note && <p className="text-[#6b6b6b] text-[9px] mt-0.5 leading-tight">{note}</p>}
    </div>
  )
}

interface Props {
  activeTab: UsuariosTab
  onTab: (tab: UsuariosTab) => void
  kpis: { pessoas: number; adminsGlobais: number; convites: number; empresas: number } | null
  /** razão exibida embaixo do "—" quando kpis é null */
  notaSemDado: string
  subtitulo: string
  subtituloOk: boolean
  convitesPendentes: number
  onReload: () => void
  recarregando: boolean
}

export function UsuariosHeader({
  activeTab,
  onTab,
  kpis,
  notaSemDado,
  subtitulo,
  subtituloOk,
  convitesPendentes,
  onReload,
  recarregando,
}: Props) {
  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Título + ações */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <ShieldCheck size={20} className="text-[#ffffff]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-semibold text-lg leading-tight">Usuários &amp; Acessos</h1>
            <p className="text-[#a3a3a3] text-xs">
              Quem entra no ConstruData e o que cada um enxerga ·{' '}
              <span className={subtituloOk ? 'text-[#22c55e]' : 'text-[#f97316]'}>{subtitulo}</span>
            </p>
          </div>
        </div>
        <button
          onClick={onReload}
          disabled={recarregando}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors disabled:opacity-40"
        >
          <RefreshCw size={15} className={recarregando ? 'animate-spin' : undefined} />
          Recarregar
        </button>
      </div>

      {/* KPIs */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        <KpiCard label="Com acesso" value={kpis?.pessoas ?? null} note={notaSemDado} />
        <KpiCard label="Admins globais" value={kpis?.adminsGlobais ?? null} note={notaSemDado} />
        <KpiCard label="Convites pendentes" value={kpis?.convites ?? null} note={notaSemDado} />
        <KpiCard label="Empresas" value={kpis?.empresas ?? null} note={notaSemDado} />
      </div>

      {/* Abas */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => onTab(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 flex items-center gap-1.5',
                  isActive
                    ? 'text-[#f5f5f5] border-orange-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50',
                )}
              >
                {tab.label}
                {tab.key === 'convites' && convitesPendentes > 0 && (
                  <span className="bg-[#f97316] text-[#ffffff] text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {convitesPendentes}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
