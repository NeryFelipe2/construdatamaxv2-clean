/**
 * InsightBanner.tsx — Banners de insights automáticos.
 * Respondem: "O que ganho?", "Qual garantia?", "Quanto custa?"
 * 
 * São gerados automaticamente baseados nos dados da plataforma.
 */
import { useState } from 'react'
import {
  Lightbulb, TrendingUp, Shield, DollarSign, AlertTriangle,
  ChevronDown, ChevronRight, X, Zap, CheckCircle2, Target,
  Clock, ArrowRight, BarChart3, Sparkles,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

export type InsightType = 'success' | 'warning' | 'info' | 'efficiency' | 'guarantee'

export interface Insight {
  id: string
  type: InsightType
  title: string
  message: string
  detail?: string
  metric?: { label: string; value: string; trend?: 'up' | 'down' }
  action?: { label: string; onClick?: () => void }
}

// ─── Style Map ──────────────────────────────────────────────────────────────

const STYLE_MAP: Record<InsightType, {
  bg: string; border: string; icon: any; iconColor: string; titleColor: string; textColor: string
}> = {
  success: {
    bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: CheckCircle2,
    iconColor: 'text-emerald-400', titleColor: 'text-emerald-400', textColor: 'text-emerald-200/80',
  },
  warning: {
    bg: 'bg-amber-500/5', border: 'border-amber-500/20', icon: AlertTriangle,
    iconColor: 'text-amber-400', titleColor: 'text-amber-400', textColor: 'text-amber-200/80',
  },
  info: {
    bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', icon: Lightbulb,
    iconColor: 'text-cyan-400', titleColor: 'text-cyan-400', textColor: 'text-cyan-200/80',
  },
  efficiency: {
    bg: 'bg-purple-500/5', border: 'border-purple-500/20', icon: Zap,
    iconColor: 'text-purple-400', titleColor: 'text-purple-400', textColor: 'text-purple-200/80',
  },
  guarantee: {
    bg: 'bg-blue-500/5', border: 'border-blue-500/20', icon: Shield,
    iconColor: 'text-blue-400', titleColor: 'text-blue-400', textColor: 'text-blue-200/80',
  },
}

// ─── Single Insight Banner ──────────────────────────────────────────────────

export function InsightBanner({ insight, onDismiss }: { insight: Insight; onDismiss?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const style = STYLE_MAP[insight.type]
  const IconComponent = style.icon

  return (
    <div className={`${style.bg} border ${style.border} rounded-xl px-4 py-3 transition-all`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 ${style.iconColor}`}>
          <IconComponent size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`text-xs font-bold ${style.titleColor}`}>{insight.title}</h4>
            {insight.metric && (
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#e4f2f8] bg-[#0d2040] px-2 py-0.5 rounded-full">
                {insight.metric.value}
                {insight.metric.trend === 'up' && <TrendingUp size={9} className="text-emerald-400" />}
                {insight.metric.trend === 'down' && <TrendingUp size={9} className="text-rose-400 rotate-180" />}
              </span>
            )}
          </div>
          <p className={`text-[11px] ${style.textColor} leading-relaxed mt-0.5`}>{insight.message}</p>
          
          {insight.detail && expanded && (
            <p className="text-[10px] text-[#8fb3c8] leading-relaxed mt-2 border-t border-[#20406a] pt-2">
              {insight.detail}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            {insight.detail && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-1 text-[10px] font-medium ${style.iconColor} hover:underline`}
              >
                {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                {expanded ? 'Menos detalhes' : 'Mais detalhes'}
              </button>
            )}
            {/* Só renderiza como botão clicável se houver onClick real — nunca um link morto (regra: sem botão que finge funcionar) */}
            {insight.action && insight.action.onClick && (
              <button
                onClick={insight.action.onClick}
                className="flex items-center gap-1 text-[10px] font-medium text-[#2abfdc] hover:underline"
              >
                <ArrowRight size={10} /> {insight.action.label}
              </button>
            )}
          </div>
        </div>
        {onDismiss && (
          <button onClick={() => onDismiss(insight.id)} className="text-[#5a8caa]/50 hover:text-white shrink-0">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Stacked Insights Panel ─────────────────────────────────────────────────

export function InsightsPanel({
  insights,
  title = 'Insights da Plataforma',
  collapsible = true,
}: {
  insights: Insight[]
  title?: string
  collapsible?: boolean
}) {
  const [isOpen, setIsOpen] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const visible = insights.filter((i) => !dismissed.has(i.id))

  if (visible.length === 0) return null

  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
      <button
        onClick={() => collapsible && setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-5 py-3 hover:bg-[#14294e] transition-colors"
      >
        <Sparkles size={14} className="text-purple-400" />
        <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex-1 text-left">
          {title}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
          {visible.length} {visible.length === 1 ? 'insight' : 'insights'}
        </span>
        {collapsible && (
          isOpen ? <ChevronDown size={14} className="text-[#5a8caa]" /> : <ChevronRight size={14} className="text-[#5a8caa]" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-2.5">
          {visible.map((insight) => (
            <InsightBanner
              key={insight.id}
              insight={insight}
              onDismiss={(id) => setDismissed((prev) => new Set([...prev, id]))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Pre-built insights generators ─────────────────────────────────────────

export function generateDreInsights(data: {
  margemBruta: number
  margemLiquida: number
  lucroLiquido: number
  totalReceita: number
  onVerCustoPorTrecho?: () => void
  onVerEficiencia?: () => void
  onVerComposicaoCustos?: () => void
}): Insight[] {
  const insights: Insight[] = []

  // Margem bruta analysis
  if (data.margemBruta > 25) {
    insights.push({
      id: 'dre-margem-ok',
      type: 'success',
      title: 'Margem bruta saudável',
      message: `Sua margem bruta está em ${data.margemBruta.toFixed(1)}% — acima da meta de 20% para projetos de saneamento.`,
      metric: { label: 'Margem', value: `${data.margemBruta.toFixed(1)}%`, trend: 'up' },
      detail: 'Isso significa que sua operação de campo está eficiente. Continue monitorando custos de materiais e produtividade das equipes.',
    })
  } else if (data.margemBruta < 20) {
    insights.push({
      id: 'dre-margem-baixa',
      type: 'warning',
      title: 'Margem bruta abaixo da meta',
      message: `Margem bruta em ${data.margemBruta.toFixed(1)}% — abaixo dos 20% recomendados. Revise custos diretos.`,
      metric: { label: 'Margem', value: `${data.margemBruta.toFixed(1)}%`, trend: 'down' },
      detail: 'Verifique: (1) Produtividade por equipe no Planejamento, (2) Custo unitário por trecho, (3) Retrabalhos no RDO.',
      action: { label: 'Ver Custo por Trecho', onClick: data.onVerCustoPorTrecho },
    })
  }

  // Lucro líquido
  if (data.margemLiquida >= 8) {
    insights.push({
      id: 'dre-lucro-ok',
      type: 'success',
      title: 'Projeto lucrativo',
      message: `Lucro líquido de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(data.lucroLiquido)} com margem de ${data.margemLiquida.toFixed(1)}%.`,
      detail: 'Meta para saneamento: 8-12%. Você está no target. A plataforma garante DRE atualizado em tempo real — sem surpresas no fechamento.',
    })
  }

  // Efficiency insight (always show)
  insights.push({
    id: 'dre-eficiencia',
    type: 'efficiency',
    title: 'O que você ganha usando a plataforma?',
    message: 'A plataforma economiza R$ 39.300/mês em processos manuais. ROI de 1.250%.',
    metric: { label: 'ROI', value: '1.250%', trend: 'up' },
    detail: 'Comparativo: Geração de NS cai de 4h para 5min. Conferência de medição cai de 40h para 2h. RDO em campo cai de 2,5h para 18min.',
    action: { label: 'Ver detalhes de eficiência', onClick: data.onVerEficiencia },
  })

  // Guarantee insight
  insights.push({
    id: 'dre-garantia',
    type: 'guarantee',
    title: 'Qual a garantia que o trecho custa tanto?',
    message: 'Cada custo é calculado pelo motor NS V5 com base em: profundidade, DN, tipo de solo e produtividade real.',
    detail: 'O algoritmo usa os dados reais da topografia (GSI), materiais aplicados (RDO) e produtividade medida (PPC). Não é estimativa — é rastreamento unitário.',
    action: { label: 'Ver composição de custos', onClick: data.onVerComposicaoCustos },
  })

  return insights
}

export function generateFluxoCaixaInsights(data: {
  saldoAtual: number
  mesBreakeven: string
  totalRecebido: number
  totalGasto: number
  onVerCronogramaFinanceiro?: () => void
}): Insight[] {
  const insights: Insight[] = []

  if (data.saldoAtual >= 0) {
    insights.push({
      id: 'fc-saldo-positivo',
      type: 'success',
      title: 'Fluxo de caixa positivo',
      message: `Saldo acumulado positivo. O projeto está gerando caixa e não precisa de aporte.`,
      metric: { label: 'Saldo', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(data.saldoAtual), trend: 'up' },
    })
  } else {
    insights.push({
      id: 'fc-saldo-negativo',
      type: 'warning',
      title: 'Capital de giro necessário',
      message: `Saldo negativo — o projeto precisa de capital de giro até atingir o breakeven em ${data.mesBreakeven}.`,
      metric: { label: 'Déficit', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.abs(data.saldoAtual)), trend: 'down' },
      detail: 'Estratégia: Antecipe trechos de maior valor de medição para acelerar recebimentos.',
      action: { label: 'Ver cronograma financeiro', onClick: data.onVerCronogramaFinanceiro },
    })
  }

  insights.push({
    id: 'fc-projecao',
    type: 'info',
    title: 'Projeção automática',
    message: 'A plataforma projeta o caixa futuro cruzando cronograma planejado × custos reais. Antecipe decisões.',
    detail: 'Sem a plataforma, o fluxo de caixa é feito manualmente em Excel — alto risco de erro e atraso na tomada de decisão.',
  })

  return insights
}

export function generateCustoTrechoInsights(data: {
  variacaoMedia: number
  totalTrechos: number
  trechosAbaixo: number
}): Insight[] {
  const insights: Insight[] = []

  if (data.variacaoMedia < 0) {
    insights.push({
      id: 'ct-economia',
      type: 'success',
      title: 'Trechos abaixo do orçamento',
      message: `${data.trechosAbaixo} de ${data.totalTrechos} trechos executados custaram MENOS que o planejado. Variação média: ${data.variacaoMedia.toFixed(1)}%.`,
      metric: { label: 'Economia', value: `${data.variacaoMedia.toFixed(1)}%`, trend: 'up' },
      detail: 'Isso confirma que o planejamento está preciso e a execução está eficiente.',
    })
  }

  insights.push({
    id: 'ct-rastreabilidade',
    type: 'guarantee',
    title: 'Rastreabilidade total',
    message: 'Cada R$/m de custo é composto por: escavação + assentamento + reaterro + teste + acabamento. Tudo auditável.',
    detail: 'O motor decompõe o custo em: MO (hh × taxa), material (tubo + conexões), equipamento (hm × taxa) e overhead. Qualquer variação é explicável.',
  })

  return insights
}
