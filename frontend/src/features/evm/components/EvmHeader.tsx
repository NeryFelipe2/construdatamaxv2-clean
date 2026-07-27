/**
 * EvmHeader — top bar with KPI cards and tab navigation for the EVM module.
 */
import { useEffect } from 'react'
import { DollarSign, Download, RefreshCw } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { useProjectContext } from '@/store/projectContext'
import { useAppModeStore } from '@/store/appModeStore'
import { useEvmReal } from '@/hooks/useEvmReal'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import type { EvmTab } from '@/types'

const TABS: { key: EvmTab; label: string }[] = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'medicao',       label: 'Medição Ponderada' },
  { key: 'plano-contas',  label: 'Plano de Contas' },
  { key: 'work-packages', label: 'Work Packages' },
  { key: 'indices',       label: 'Índices' },
  { key: 'curva-real',    label: 'Curva S Real' },
]

/**
 * KpiCard — aceita `value: null` = insumo real ausente (Fase 5): mostra "—"
 * cinza com a razão em `note` (ex.: "sem custo real lançado"). Nunca exibe
 * 0.00 fingindo índice calculado quando o dado não existe.
 */
function KpiCard({
  label,
  value,
  isCurrency = false,
  isIndex = false,
  note,
}: {
  label: string
  value: number | null
  isCurrency?: boolean
  isIndex?: boolean
  note?: string
}) {
  const formatted = value == null
    ? '—'
    : isCurrency
      ? formatCurrency(value)
      : value.toFixed(2)

  const color = value == null
    ? '#6b6b6b'
    : isIndex
      ? value >= 1
        ? '#22c55e'
        : '#ef4444'
      : '#f5f5f5'

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[140px]" title={value == null ? note : undefined}>
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      <p className="font-mono text-lg font-semibold" style={{ color }}>
        {formatted}
      </p>
      {value == null && note && (
        <p className="text-[#6b6b6b] text-[9px] mt-0.5 leading-tight">{note}</p>
      )}
    </div>
  )
}

export function EvmHeader() {
  const { activeTab, setActiveTab, workPackages, costAccounts, measurements, evmMetrics, loadDemoData, recalculateMetrics } = useEvmStore()
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const real = useEvmReal(isDemoMode ? null : activeProjectId)

  // Segurança extra além do cascade em `appModeStore` (que já chama
  // loadDemoData/clearData ao ligar/desligar o toggle): se alguém entrar
  // nesta tela já com o Modo Demo ligado e o store ainda vazio (ex.: refresh
  // de página), carrega o mock — mesmo padrão de `operacao-campo/index.tsx`.
  useEffect(() => {
    if (isDemoMode && workPackages.length === 0 && costAccounts.length === 0 && measurements.length === 0) {
      loadDemoData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode])

  // Fora do Modo Demo, com projeto ativo e dado real disponível, o cabeçalho
  // (fixo em todas as abas, inclusive "Curva S Real") mostra os KPIs reais em
  // vez do mock — antes ficava sempre mock mesmo em cima de dado real, o que
  // confundia (10/07/2026).
  //
  // Fase 5 (custo no circuito): no modo real cada KPI só aparece quando os
  // insumos existem de verdade — CPI precisa de despesa lançada (AC), SPI
  // precisa de baseline+BAC (PV), EAC/VAC derivam do CPI. Insumo ausente →
  // null → o card mostra "—" com a razão, nunca 0.00 inventado.
  const usandoReal = !isDemoMode && !!activeProjectId && real.temDadosReais
  const kpis: { CPI: number | null; SPI: number | null; BAC: number | null; EAC: number | null; VAC: number | null } = usandoReal
    ? {
        CPI: real.temDespesaReal && real.metrics.AC > 0 ? real.metrics.CPI : null,
        SPI: real.bac > 0 && real.metrics.PV > 0 ? real.metrics.SPI : null,
        BAC: real.bac > 0 ? real.bac : null,
        EAC: real.temDespesaReal && real.metrics.AC > 0 && real.bac > 0 ? real.metrics.EAC : null,
        VAC: real.temDespesaReal && real.metrics.AC > 0 && real.bac > 0 ? real.metrics.VAC : null,
      }
    : evmMetrics
  const { CPI, SPI, BAC, EAC, VAC } = kpis
  const notaSemAc = 'sem custo real lançado (0 despesas em lancamentos_financeiros)'
  const notaSemBac = 'sem BAC: orcamento_total, planejamento valorado e campanha × preços vazios'

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">
              Gerenciamento de Valor (EVM)
            </h1>
            <p className="text-[#a3a3a3] text-xs">
              Earned Value Management ·{' '}
              <span className={usandoReal ? 'text-[#22c55e]' : 'text-[#f97316]'}>
                {usandoReal ? 'dado real do projeto' : 'dado demonstração'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDemoMode && (
            <button
              onClick={loadDemoData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] transition-colors hover:bg-[#ea580c]"
              title="Recarrega o exemplo de demonstração"
            >
              <Download size={15} />
              Recarregar Exemplo
            </button>
          )}
          <button
            onClick={recalculateMetrics}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <RefreshCw size={15} />
            Recalcular
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        <KpiCard label="CPI" value={CPI} isIndex note={notaSemAc} />
        <KpiCard label="SPI" value={SPI} isIndex note="sem PV: baseline ou BAC ausentes" />
        <KpiCard label="BAC (R$)" value={BAC} isCurrency note={notaSemBac} />
        <KpiCard label="EAC (R$)" value={EAC} isCurrency note={notaSemAc} />
        <KpiCard label="VAC (R$)" value={VAC} isCurrency note={notaSemAc} />
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2',
                  isActive
                    ? 'text-white border-orange-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
