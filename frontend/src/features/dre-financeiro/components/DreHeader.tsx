/**
 * DreHeader — faixa superior do módulo DRE & Resultado (dialeto grafite).
 * Espelho do EvmHeader: faixa 1 (título + badge de origem + ações),
 * faixa 2 (KPI strip) e faixa 3 (abas, lidas/escritas no dreStore).
 *
 * DreKpiCard segue o contrato do KpiCard do EvmHeader: `value: null` =
 * insumo real ausente — mostra "—" cinza (#6b6b6b) com a razão em `note`.
 * Nunca exibe 0,00 fingindo dado calculado quando o dado não existe.
 * Estendido com `isPercent` e com os props do antigo KpiCard do corpo
 * (icon/color/trend/sub/tooltip/dataTour) — a cor do VALOR é semântica de
 * dado (receita verde, despesa vermelha), nunca cromo do tema.
 */
import { DollarSign, Plus, Upload, RefreshCw, Receipt, Wallet, Calculator, Target, ArrowUpRight, ArrowDownRight, CalendarRange, Landmark } from 'lucide-react'
import { InfoTooltip, type TooltipContent } from '@/components/ui/InfoTooltip'
import { TourButton } from '@/components/ui/GuidedTour'
import { useDreStore, type DreTab } from '@/store/dreStore'
import type { CanonicalIntegrationStatus } from '@/lib/api'

const TABS: { key: DreTab; label: string; icon: any }[] = [
  { key: 'dre', label: 'DRE', icon: Receipt },
  { key: 'fluxo', label: 'Fluxo de Caixa', icon: Wallet },
  { key: 'fcp', label: 'Fluxo de Caixa Projetado', icon: CalendarRange },
  { key: 'caixa', label: 'Controle de Caixa', icon: Landmark },
  { key: 'custos', label: 'Custo por Trecho', icon: Calculator },
  { key: 'eficiencia', label: 'Eficiência da Plataforma', icon: Target },
]

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

/** '#34d399' + 0.12 → 'rgba(52, 211, 153, 0.12)' — bolha do ícone sem gerar classe Tailwind dinâmica. */
function hexAlpha(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function DreKpiCard({
  label,
  value,
  isCurrency = false,
  isPercent = false,
  sub,
  note,
  icon: Icon,
  color = '#f5f5f5',
  trend,
  tooltip,
  dataTour,
  className = '',
}: {
  label: string
  /** null = insumo real ausente → "—" cinza + note. String já formatada é exibida como veio. */
  value: number | string | null
  isCurrency?: boolean
  isPercent?: boolean
  sub?: string
  /** Razão honesta exibida quando value == null (ex.: "sem lançamentos de receita"). */
  note?: string
  icon?: any
  /** Cor (hex) do valor/ícone — semântica de DADO (receita verde, despesa vermelha). */
  color?: string
  trend?: 'up' | 'down' | 'neutral'
  tooltip?: TooltipContent
  dataTour?: string
  className?: string
}) {
  const formatted = value == null
    ? '—'
    : typeof value === 'string'
      ? value
      : isCurrency
        ? fmtBRL(value)
        : isPercent
          ? `${value.toFixed(1)}%`
          : new Intl.NumberFormat('pt-BR').format(value)

  const valueColor = value == null ? '#6b6b6b' : color

  return (
    <div
      className={`bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 ${className}`}
      data-tour={dataTour}
      title={value == null ? note : undefined}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#a3a3a3] uppercase tracking-wider flex items-center gap-1">
          {label}
          {tooltip && <InfoTooltip content={tooltip} position="bottom" size={11} />}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: hexAlpha(valueColor, 0.12) }}>
            <Icon size={16} style={{ color: valueColor }} />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="font-mono text-lg font-semibold" style={{ color: valueColor }}>{formatted}</span>
        {value != null && trend && trend !== 'neutral' && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold pb-0.5 ${trend === 'up' ? 'text-green-400' : 'text-rose-400'}`}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          </span>
        )}
      </div>
      {value == null && note ? (
        <span className="text-[9px] text-[#6b6b6b] mt-1 block leading-tight">{note}</span>
      ) : (
        sub && <span className="text-[10px] text-[#6b6b6b] mt-1 block">{sub}</span>
      )}
    </div>
  )
}

interface DreHeaderProps {
  contrato: { numero: string; empresa: string; cliente: string; cidade: string }
  connectionStatus: CanonicalIntegrationStatus
  isRealData: boolean
  loading: boolean
  /** loading sem dado real na tela → KPIs viram "—" com note "carregando…". */
  carregando: boolean
  podeLancar: boolean
  motivoBloqueio?: string
  valorContrato: number | null
  prazoMeses: number | null
  receitaBruta: number | null
  custoTotal: number | null
  margemLiquida: number | null
  onNovoLancamento: () => void
  onImportarCsv: () => void
  onRefresh: () => void
}

export function DreHeader({
  contrato,
  connectionStatus,
  isRealData,
  loading,
  carregando,
  podeLancar,
  motivoBloqueio,
  valorContrato,
  prazoMeses,
  receitaBruta,
  custoTotal,
  margemLiquida,
  onNovoLancamento,
  onImportarCsv,
  onRefresh,
}: DreHeaderProps) {
  const { activeTab, setActiveTab } = useDreStore()

  // Badge de origem — mesmo padrão do LpsHeader (verde/amarelo/cinza).
  const badge = connectionStatus === 'connected'
    ? { label: 'Canônico', cls: 'bg-green-500/15 text-green-300' }
    : connectionStatus === 'partial'
      ? { label: 'Parcial', cls: 'bg-yellow-500/15 text-yellow-300' }
      : { label: isRealData ? 'Dados Locais' : 'Local', cls: 'bg-[#484848] text-[#a3a3a3]' }

  const notaCarregando = 'carregando…'

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Faixa 1 — título + badge + ações */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <DollarSign size={20} className="text-[#ffffff]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-semibold text-lg leading-tight">Resultado Econômico & DRE</h1>
            <p className="text-[#a3a3a3] text-xs flex items-center gap-2">
              <span>{contrato.numero} — {contrato.cliente} — {contrato.cidade}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onNovoLancamento}
            disabled={!podeLancar}
            title={motivoBloqueio}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#ffffff] bg-[#f97316] hover:bg-[#ea580c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f97316]"
          >
            <Plus size={13} /> Lançamento
          </button>
          <button
            onClick={onImportarCsv}
            disabled={!podeLancar}
            title={motivoBloqueio}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#484848]"
          >
            <Upload size={13} /> Importar CSV
          </button>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <TourButton tourId="dre-financeiro" />
        </div>
      </div>

      {/* Faixa 2 — KPI strip (contrato null → travessão + note honesto) */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        <DreKpiCard className="min-w-[150px] shrink-0" label="Valor Contrato" value={valorContrato} isCurrency
          note="sem orcamento_total cadastrado no projeto ativo" />
        <DreKpiCard className="min-w-[150px] shrink-0" label="Prazo" value={prazoMeses != null ? `${prazoMeses} meses` : null}
          note="sem data_inicio/data_fim cadastradas no projeto" />
        <DreKpiCard className="min-w-[150px] shrink-0" label="Receita Bruta" value={receitaBruta} isCurrency color="#34d399"
          note={carregando ? notaCarregando : 'sem lançamentos de receita para esta obra'} />
        <DreKpiCard className="min-w-[150px] shrink-0" label="Custo Total" value={custoTotal} isCurrency color="#fb7185"
          note={carregando ? notaCarregando : 'sem despesas lançadas para esta obra'} />
        <DreKpiCard className="min-w-[150px] shrink-0" label="Margem Líquida" value={margemLiquida} isPercent
          color={margemLiquida != null && margemLiquida < 0 ? '#fb7185' : '#34d399'}
          note={carregando ? notaCarregando : 'sem receita lançada — margem não calculável'} />
      </div>

      {/* Faixa 3 — abas */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'text-[#f5f5f5] border-[#f97316] bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50'
                }`}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
