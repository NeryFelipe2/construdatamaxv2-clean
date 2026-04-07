/**
 * GuidedTour.tsx — Sistema de tutorial interativo / onboarding.
 * 
 * Destaca elementos da interface passo a passo, explicando o que são
 * e como geram valor para o gestor.
 * 
 * Usa um overlay com spotlight na área alvo + popover de explicação.
 */
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import {
  X, ChevronLeft, ChevronRight, Sparkles,
  BookOpen, Lightbulb, GraduationCap, Play, SkipForward,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TourStep {
  /** CSS selector or element ID to highlight */
  target?: string
  /** Title of the step */
  title: string
  /** Description — the main explanation */
  description: string
  /** Sub-text with efficiency/value insight */
  insight?: string
  /** Position of the popover relative to the target */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

interface TourContextValue {
  isActive: boolean
  currentStep: number
  totalSteps: number
  startTour: (tourId: string) => void
  stopTour: () => void
  nextStep: () => void
  prevStep: () => void
  activeTourId: string | null
}

// ─── Context ────────────────────────────────────────────────────────────────

const TourContext = createContext<TourContextValue>({
  isActive: false,
  currentStep: 0,
  totalSteps: 0,
  startTour: () => {},
  stopTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  activeTourId: null,
})

export function useTour() {
  return useContext(TourContext)
}

// ─── Pre-defined Tours ──────────────────────────────────────────────────────

export const TOURS: Record<string, TourStep[]> = {
  'dre-financeiro': [
    {
      title: '📊 DRE — Demonstrativo de Resultado',
      description: 'A DRE mostra a saúde financeira do seu contrato. Receitas no topo, custos deduzidos, e o lucro líquido no final.',
      insight: '💡 Com a plataforma, o DRE é atualizado em TEMPO REAL. Sem Excel, sem atraso.',
      position: 'center',
    },
    {
      target: '[data-tour="receita-bruta"]',
      title: '💰 Receita Bruta',
      description: 'Total de medições aprovadas pela fiscalização. É o dinheiro que o cliente aceita pagar.',
      insight: 'A plataforma confere automaticamente medição × contrato. Zero supramedição.',
      position: 'bottom',
    },
    {
      target: '[data-tour="custo-direto"]',
      title: '🔴 Custos Diretos',
      description: 'Tudo que vai direto pra obra: mão de obra, material, equipamento, transporte.',
      insight: 'Se custos diretos passam de 75% da receita, atenção! A margem está em risco.',
      position: 'bottom',
    },
    {
      target: '[data-tour="lucro-bruto"]',
      title: '📈 Lucro Bruto = Eficiência de Campo',
      description: 'Receita menos custos diretos. Mostra se sua operação de campo está eficiente.',
      insight: 'Meta saudável para saneamento: margem bruta acima de 20%.',
      position: 'bottom',
    },
    {
      target: '[data-tour="lucro-liquido"]',
      title: '✅ Lucro Líquido — O que sobra de verdade',
      description: 'Depois de pagar custos, administração e impostos. É o que remunera o investidor.',
      insight: 'Meta: 8-12% em saneamento. Abaixo de 5%? Hora de reajustar.',
      position: 'top',
    },
    {
      title: '🚀 O que muda com a plataforma?',
      description: 'O DRE que antes levava 2 dias para fechar agora é automático. Os dados vêm direto dos RDOs e medições.',
      insight: 'Economia de 95% do tempo. Decisão baseada em dados, não em achismo.',
      position: 'center',
    },
  ],

  'fluxo-caixa': [
    {
      title: '💵 Fluxo de Caixa',
      description: 'Mostra quanto dinheiro entra e sai do projeto mês a mês. Uma obra pode ter lucro no papel mas quebrar por falta de caixa.',
      insight: 'O gráfico de barras compara recebimentos (verde) com gastos (vermelho). O saldo acumulado é a diferença.',
      position: 'center',
    },
    {
      target: '[data-tour="breakeven"]',
      title: '📍 Breakeven — Ponto de Equilíbrio',
      description: 'O mês em que o projeto para de "tomar dinheiro". Quanto antes, melhor.',
      insight: 'Dica: Acelere trechos de maior valor para antecipar recebimentos e reduzir necessidade de capital de giro.',
      position: 'bottom',
    },
    {
      title: '🔮 Projeção Automática',
      description: 'A plataforma projeta o caixa futuro baseado no cronograma. Você vê problemas ANTES deles acontecerem.',
      insight: 'Sem a plataforma, isso é feito manualmente em Excel — alto risco de erro e atraso.',
      position: 'center',
    },
  ],

  'custo-trecho': [
    {
      title: '🛡️ Garantia de Custo por Trecho',
      description: 'Aqui está a resposta: "Qual a garantia de que esse trecho custa tanto?" Cada custo é decomposto e rastreável.',
      insight: 'O motor NS V5 calcula com base em: profundidade, diâmetro, tipo de solo, produtividade real e materiais aplicados.',
      position: 'center',
    },
    {
      target: '[data-tour="custo-unitario"]',
      title: '💲 Custo R$/metro',
      description: 'Quanto custa cada metro linear. Composto por: escavação + assentamento + reaterro + teste + acabamento.',
      insight: 'Compare com SINAPI/SEINFRA. Variação acima de ±5% precisa de justificativa técnica.',
      position: 'bottom',
    },
    {
      target: '[data-tour="variacao"]',
      title: '📊 Variação — Planejado vs Real',
      description: 'Verde (negativo) = economia. Laranja (positivo) = estouro. A plataforma sinaliza automaticamente.',
      insight: 'Investigue estouros >3%. Pode ser retrabalho, solo rochoso imprevisto ou baixa produtividade.',
      position: 'left',
    },
  ],

  'eficiencia': [
    {
      title: '⚡ O que VOCÊ ganha usando a plataforma?',
      description: 'Esta seção responde diretamente: quanto tempo, dinheiro e risco você economiza usando ConstruDataMax.',
      position: 'center',
    },
    {
      target: '[data-tour="economia-mensal"]',
      title: '💰 R$ 39.300/mês de economia',
      description: 'Comparação direta entre processo manual (5 engenheiros + cadistas) vs 1 operador + plataforma.',
      insight: 'ROI de 1.250%. Cada R$1 investido retorna R$12,50. Payback em 15 dias.',
      position: 'bottom',
    },
    {
      title: '📋 Tabela de Eficiência',
      description: 'Cada processo comparado lado a lado. NS que levava 4 horas agora leva 5 minutos. RDO cai de 2,5h para 18 minutos.',
      insight: 'Use esses números para justificar a renovação e expansão da plataforma para outros contratos.',
      position: 'center',
    },
  ],

  'planejamento': [
    {
      title: '📅 Planejamento × Execução',
      description: 'O módulo de Planejamento cruza o cronograma com o que foi executado nos RDOs.',
      insight: 'PPC (% Plano Concluído) é o indicador-chave: meta >80%. Abaixo disso, o planejamento não é confiável.',
      position: 'center',
    },
    {
      title: '📈 Curva S — Avanço Físico e Financeiro',
      description: 'Compara avanço planejado vs real. Se a curva real está abaixo da planejada, o projeto está atrasado.',
      insight: 'A SABESP exige curva S nas apresentações. A plataforma gera automaticamente.',
      position: 'center',
    },
  ],

  'rdo-overview': [
    {
      title: '📋 RDO — Base de Tudo',
      description: 'O RDO é o registro diário obrigatório. Sem ele, a fiscalização pode glosar trechos inteiros.',
      insight: 'Com o bot WhatsApp, preencher o RDO leva 5 minutos vs 2,5 horas manual.',
      position: 'center',
    },
    {
      title: '📱 RDO por WhatsApp',
      description: 'O apontador responde opções numeradas no WhatsApp. Tudo guiado, sem chance de erro.',
      insight: 'Os dados entram direto na plataforma organizados por NS, projeto e núcleo.',
      position: 'center',
    },
  ],
}

// ─── Tour Provider ──────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeTourId, setActiveTourId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  const steps = activeTourId ? TOURS[activeTourId] || [] : []

  const startTour = useCallback((tourId: string) => {
    setActiveTourId(tourId)
    setCurrentStep(0)
  }, [])

  const stopTour = useCallback(() => {
    setActiveTourId(null)
    setCurrentStep(0)
  }, [])

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      stopTour()
    }
  }, [currentStep, steps.length, stopTour])

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }, [currentStep])

  // Keyboard navigation
  useEffect(() => {
    if (!activeTourId) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') stopTour()
      if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep()
      if (e.key === 'ArrowLeft') prevStep()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [activeTourId, nextStep, prevStep, stopTour])

  const value: TourContextValue = {
    isActive: !!activeTourId,
    currentStep,
    totalSteps: steps.length,
    startTour,
    stopTour,
    nextStep,
    prevStep,
    activeTourId,
  }

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTourId && steps.length > 0 && (
        <TourOverlay step={steps[currentStep]} stepIndex={currentStep} totalSteps={steps.length} />
      )}
    </TourContext.Provider>
  )
}

// ─── Tour Overlay ───────────────────────────────────────────────────────────

function TourOverlay({
  step,
  stepIndex,
  totalSteps,
}: {
  step: TourStep
  stepIndex: number
  totalSteps: number
}) {
  const { nextStep, prevStep, stopTour } = useTour()

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={stopTour}
      />

      {/* Popover */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[440px] max-w-[90vw] bg-[#112645] border border-[#2a4a6e] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in-0 zoom-in-95" style={{ animationDuration: '200ms' }}>
          {/* Progress bar */}
          <div className="h-1 bg-[#0d2040]">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Header */}
          <div className="px-5 py-3 border-b border-[#20406a] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <GraduationCap size={16} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[#e4f2f8]">{step.title}</h3>
              <span className="text-[10px] text-[#5a8caa]">
                Passo {stepIndex + 1} de {totalSteps}
              </span>
            </div>
            <button onClick={stopTour} className="text-[#5a8caa] hover:text-white p-1">
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-[#c8dce8] leading-relaxed">{step.description}</p>

            {step.insight && (
              <div className="flex items-start gap-2 bg-purple-500/8 border border-purple-500/15 rounded-lg px-3 py-2.5">
                <Lightbulb size={13} className="text-purple-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-purple-200/80 leading-relaxed">{step.insight}</p>
              </div>
            )}
          </div>

          {/* Footer — Navigation */}
          <div className="px-5 py-3 bg-[#0d2040] border-t border-[#20406a] flex items-center gap-2">
            <button
              onClick={stopTour}
              className="text-[10px] text-[#5a8caa] hover:text-white flex items-center gap-1 px-2 py-1.5"
            >
              <SkipForward size={10} /> Pular
            </button>
            <div className="flex-1" />
            {stepIndex > 0 && (
              <button
                onClick={prevStep}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#8fb3c8] hover:text-white hover:bg-[#14294e] transition-colors"
              >
                <ChevronLeft size={12} /> Anterior
              </button>
            )}
            <button
              onClick={nextStep}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 transition-all shadow-lg"
            >
              {stepIndex < totalSteps - 1 ? (
                <>Próximo <ChevronRight size={12} /></>
              ) : (
                <>Concluir ✓</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Tour Trigger Button ────────────────────────────────────────────────────

export function TourButton({ tourId, label = 'Tutorial', className = '' }: {
  tourId: string
  label?: string
  className?: string
}) {
  const { startTour, isActive } = useTour()
  if (isActive) return null

  return (
    <button
      onClick={() => startTour(tourId)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all
        bg-purple-500/10 border border-purple-500/20 text-purple-300
        hover:bg-purple-500/20 hover:text-purple-200 hover:border-purple-500/40 ${className}`}
    >
      <BookOpen size={12} />
      {label}
    </button>
  )
}
