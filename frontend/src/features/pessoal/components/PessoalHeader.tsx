/**
 * PessoalHeader — barra superior com KPIs e navegação por abas do módulo
 * Pessoal. Molde: EvmHeader (KPIs honestos: valor null = "—" com a razão em
 * `note`, nunca 0 fingindo dado quando as migrations não foram aplicadas).
 */
import { RefreshCw, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AVISO_MIGRATIONS } from './ui'

export type PessoalTab = 'funcionarios' | 'equipes' | 'cargos' | 'importar' | 'duplicatas'

const TABS: { key: PessoalTab; label: string }[] = [
  { key: 'funcionarios', label: 'Funcionários' },
  { key: 'equipes',      label: 'Equipes' },
  { key: 'cargos',       label: 'Cargos' },
  { key: 'importar',     label: 'Importar' },
  { key: 'duplicatas',   label: 'Duplicatas' },
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
      {value == null && note && (
        <p className="text-[#6b6b6b] text-[9px] mt-0.5 leading-tight">{note}</p>
      )}
    </div>
  )
}

interface Props {
  activeTab: PessoalTab
  onTab: (tab: PessoalTab) => void
  kpis: { ativos: number; desligados: number; emContratacao: number; aRevisar: number } | null
  tabelasAusentes: boolean
  duplicatasPendentes: number
  onReload: () => void
}

export function PessoalHeader({ activeTab, onTab, kpis, tabelasAusentes, duplicatasPendentes, onReload }: Props) {
  const nota = tabelasAusentes ? AVISO_MIGRATIONS : 'sem dados carregados'
  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Título + ações */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <Users size={20} className="text-[#ffffff]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-semibold text-lg leading-tight">Pessoal</h1>
            <p className="text-[#a3a3a3] text-xs">
              Cadastro único de funcionários, equipes e cargos ·{' '}
              <span className={tabelasAusentes ? 'text-[#f97316]' : 'text-[#22c55e]'}>
                {tabelasAusentes ? 'migrations pendentes' : 'cadastro unificado'}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={onReload}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
        >
          <RefreshCw size={15} />
          Recarregar
        </button>
      </div>

      {tabelasAusentes && (
        <div className="mx-6 mb-3 bg-[#f97316]/10 border border-[#f97316]/40 rounded-lg px-4 py-2.5">
          <p className="text-[#f97316] text-xs">{AVISO_MIGRATIONS}</p>
        </div>
      )}

      {/* KPIs — honestos: null → "—" com a razão */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        <KpiCard label="Ativos"          value={kpis?.ativos ?? null}        note={nota} />
        <KpiCard label="Desligados"      value={kpis?.desligados ?? null}    note={nota} />
        <KpiCard label="Em contratação"  value={kpis?.emContratacao ?? null} note={nota} />
        <KpiCard label="A revisar"       value={kpis?.aRevisar ?? null}      note={nota} />
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
                {tab.key === 'duplicatas' && duplicatasPendentes > 0 && (
                  <span className="bg-[#f97316] text-[#ffffff] text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {duplicatasPendentes}
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
