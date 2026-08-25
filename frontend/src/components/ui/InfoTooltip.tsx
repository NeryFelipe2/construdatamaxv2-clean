/**
 * InfoTooltip.tsx — Tooltip contextual para botões, KPIs e seções.
 * Cada tooltip explica O QUE É, POR QUE IMPORTA e O QUE FAZER.
 * Hover no desktop, tap no mobile.
 */
import { useState, useRef, useEffect, type ReactNode } from 'react'
import { HelpCircle, Info, X, Lightbulb, ArrowRight, TrendingUp } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TooltipContent {
  title: string
  /** O que é esse dado / botão */
  description: string
  /** Por que é importante para o gestor */
  whyItMatters?: string
  /** O que o usuário pode fazer com essa informação */
  actionHint?: string
  /** Dica de eficiência da plataforma */
  efficiencyNote?: string
}

interface InfoTooltipProps {
  content: TooltipContent
  /** Where to position the popup */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Icon size */
  size?: number
  /** Custom trigger element */
  children?: ReactNode
  /** Custom class for the trigger */
  className?: string
  /** Variant: 'icon' shows (?) icon, 'inline' wraps children */
  variant?: 'icon' | 'inline'
}

// ─── Component ──────────────────────────────────────────────────────────────

export function InfoTooltip({
  content,
  position = 'top',
  size = 13,
  children,
  className = '',
  variant = 'icon',
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      {variant === 'inline' && children ? (
        <span
          className="cursor-help"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          onClick={() => setIsOpen(!isOpen)}
        >
          {children}
        </span>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          className="text-[#6b6b6b]/60 hover:text-[#f97316] transition-colors focus:outline-none"
          aria-label={`Informação: ${content.title}`}
        >
          <HelpCircle size={size} />
        </button>
      )}

      {isOpen && (
        <div
          ref={tooltipRef}
          className={`absolute z-[100] ${positionClasses[position]} w-72 animate-in fade-in-0 zoom-in-95`}
          style={{ animationDuration: '150ms' }}
        >
          <div className="bg-[#484848] border border-[#525252] rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Header */}
            <div className="bg-[#2c2c2c] px-4 py-2.5 flex items-center gap-2 border-b border-[#525252]">
              <Info size={13} className="text-[#f97316] shrink-0" />
              <span className="text-xs font-bold text-[#f5f5f5] flex-1">{content.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false) }}
                className="text-[#6b6b6b] hover:text-[#f5f5f5] p-0.5"
              >
                <X size={11} />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2.5">
              <p className="text-[11px] text-[#f5f5f5] leading-relaxed">{content.description}</p>

              {content.whyItMatters && (
                <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
                  <Lightbulb size={12} className="text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-wider">Por que importa</span>
                    <p className="text-[10px] text-yellow-200/80 leading-relaxed mt-0.5">{content.whyItMatters}</p>
                  </div>
                </div>
              )}

              {content.actionHint && (
                <div className="flex items-start gap-2 bg-[#f97316]/5 border border-[#f97316]/15 rounded-lg px-3 py-2">
                  <ArrowRight size={12} className="text-[#f97316] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] font-bold text-[#f97316] uppercase tracking-wider">O que fazer</span>
                    <p className="text-[10px] text-orange-200/80 leading-relaxed mt-0.5">{content.actionHint}</p>
                  </div>
                </div>
              )}

              {content.efficiencyNote && (
                <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                  <TrendingUp size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Eficiência</span>
                    <p className="text-[10px] text-emerald-200/80 leading-relaxed mt-0.5">{content.efficiencyNote}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </span>
  )
}

// ─── Predefined tooltips for common KPIs ────────────────────────────────────

export const TOOLTIPS = {
  // DRE
  receitaBruta: {
    title: 'Receita Bruta',
    description: 'Total de medições aprovadas pela fiscalização no período. Inclui rede coletora, ligações prediais, PVs e reajustamentos.',
    whyItMatters: 'É o topo do funil financeiro — tudo depende disso. Se a medição atrasa, o caixa seca.',
    actionHint: 'Compare com o cronograma planejado. Se está abaixo de 80%, investigue trechos parados.',
    efficiencyNote: 'A plataforma confere medição vs contrato automaticamente — zero supramedição.',
  } as TooltipContent,

  custoDirecto: {
    title: 'Custo Direto',
    description: 'Gastos diretamente ligados à execução: mão de obra, materiais, equipamentos, transporte e subempreiteiros.',
    whyItMatters: 'Se os custos diretos passam de 75% da receita, a margem está comprometida.',
    actionHint: 'Ordene os itens por valor. Negocie os maiores (materiais e MO) para ganhar margem.',
    efficiencyNote: 'O motor NS V5 calcula custo por metro de cada trecho — rastreável e auditável.',
  } as TooltipContent,

  lucroBruto: {
    title: 'Lucro Bruto',
    description: 'Receita menos custos diretos. Indica a eficiência da operação de campo.',
    whyItMatters: 'Margem bruta abaixo de 20% em saneamento é sinal de retrabalho ou ineficiência.',
    actionHint: 'Se estiver caindo mês a mês, revisar produtividade por equipe e custos unitários.',
  } as TooltipContent,

  lucroLiquido: {
    title: 'Lucro Líquido',
    description: 'O dinheiro que realmente sobra depois de pagar tudo: custos, administração e impostos.',
    whyItMatters: 'É o que remunera o investidor e financia o crescimento da empresa.',
    actionHint: 'Meta saudável em saneamento: 8-12%. Abaixo de 5%? Reajuste urgente.',
    efficiencyNote: 'DRE atualizado em tempo real — decisão baseada em dados, não em achismo.',
  } as TooltipContent,

  // Fluxo de Caixa
  fluxoCaixa: {
    title: 'Fluxo de Caixa',
    description: 'Mostra mês a mês quanto dinheiro entra (medições pagas) vs quanto sai (fornecedores, MO, etc.).',
    whyItMatters: 'Uma obra pode ter lucro no papel mas quebrar por falta de caixa. O fluxo previne isso.',
    actionHint: 'Identifique o "breakeven" (quando o saldo fica positivo) e planeje o capital de giro.',
    efficiencyNote: 'A plataforma projeta o caixa futuro baseado no cronograma — antecipe problemas.',
  } as TooltipContent,

  breakeven: {
    title: 'Breakeven (Ponto de Equilíbrio)',
    description: 'O mês em que o saldo acumulado vira positivo — o projeto para de "tomar dinheiro".',
    whyItMatters: 'Quanto antes o breakeven, menor o capital de giro necessário e menor o risco.',
    actionHint: 'Acelere trechos de maior valor para antecipar recebimentos.',
  } as TooltipContent,

  // Custo por Trecho
  custoUnitario: {
    title: 'Custo Unitário (R$/m)',
    description: 'Quanto custa cada metro linear de rede instalada neste trecho. Calculado pelo motor NS V5.',
    whyItMatters: 'É a GARANTIA de que o trecho custa o que diz. Cada insumo é rastreável.',
    actionHint: 'Compare com a tabela SINAPI/SEINFRA. Variações acima de ±5% precisam de justificativa.',
    efficiencyNote: 'Algoritmo do motor calcula com base em profundidade, DN, solo e produtividade real.',
  } as TooltipContent,

  variacaoCusto: {
    title: 'Variação de Custo',
    description: 'Diferença entre o custo planejado e o custo real executado do trecho.',
    whyItMatters: 'Variação negativa = economia. Positiva = estouro. Mostra onde a obra está ganhando ou perdendo.',
    actionHint: 'Investigue trechos com variação > +3%. Pode ser retrabalho ou solo imprevisto.',
  } as TooltipContent,

  // Eficiência
  eficiencia: {
    title: 'Eficiência da Plataforma',
    description: 'Comparação direta: quanto tempo cada processo leva manual vs com ConstruDataMax.',
    whyItMatters: 'Responde a pergunta: "O que eu ganho usando a plataforma?"',
    actionHint: 'Mostre para a diretoria: a plataforma economiza R$ 39.300/mês e se paga em 15 dias.',
    efficiencyNote: 'ROI de 1.250% — cada R$1 investido retorna R$12,50.',
  } as TooltipContent,

  roi: {
    title: 'ROI (Retorno sobre Investimento)',
    description: 'Quanto a plataforma retorna financeiramente para cada real investido na licença.',
    whyItMatters: 'Um ROI acima de 300% é excepcional. Acima de 1.000% é game-changer.',
    actionHint: 'Use esse número para justificar a renovação da licença e expansão para outros contratos.',
  } as TooltipContent,

  // Planejamento
  ppc: {
    title: 'PPC (% Plano Concluído)',
    description: 'Quanto do que foi planejado para a semana foi realmente executado. Meta: >80%.',
    whyItMatters: 'É o principal indicador de confiabilidade do planejamento. PPC baixo = promessas vazias.',
    actionHint: 'Analise as causas de não-conclusão (CNC). As 3 mais frequentes precisam de ação.',
    efficiencyNote: 'A plataforma calcula PPC automaticamente cruzando RDO × Planejamento.',
  } as TooltipContent,

  curvaS: {
    title: 'Curva S',
    description: 'Gráfico que compara avanço planejado vs real ao longo do tempo.',
    whyItMatters: 'Se a curva real está abaixo da planejada, o projeto está atrasado. Acima = adiantado.',
    actionHint: 'Use para reuniões com o cliente. A SABESP exige curva S nas apresentações.',
    efficiencyNote: 'Gerada automaticamente pela plataforma — sem planilha manual.',
  } as TooltipContent,

  // RDO
  rdo: {
    title: 'RDO (Relatório Diário de Obras)',
    description: 'Registro diário obrigatório com equipes, atividades, clima, equipamentos e fotos.',
    whyItMatters: 'É a base probatória para medição. Sem RDO, fiscalização pode glosar trechos.',
    actionHint: 'Preencha todo dia até 18h. Use o bot WhatsApp para agilizar.',
    efficiencyNote: 'RDO via WhatsApp: 5 minutos vs 2,5 horas manual. Economia de 88%.',
  } as TooltipContent,

  // Geral
  notaServico: {
    title: 'Nota de Serviço (NS)',
    description: 'Documento técnico que registra a execução de cada trecho com dados topográficos.',
    whyItMatters: 'É o link entre campo e escritório. A NS garante que a medição bate com a execução.',
    actionHint: 'Gere a NS automaticamente pelo motor NS V5 — 98% mais rápido que manual.',
    efficiencyNote: 'O motor NS V5 interpola dados do GSI e gera a NS completa em 5 minutos.',
  } as TooltipContent,
} as const
