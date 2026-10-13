import { useState } from 'react'
import { Layers, Calculator } from 'lucide-react'
import { usePreConstrucaoStore } from '@/store/preConstrucaoStore'
import { PipelineBar }      from './components/PipelineBar'
import { UploadZone }       from './components/UploadZone'
import { ExtractionView }   from './components/ExtractionView'
import { NormalizacaoView } from './components/NormalizacaoView'
import { CostMatchingView } from './components/CostMatchingView'
import { ProposalView }     from './components/ProposalView'
import { AnalysisHistory }  from './components/AnalysisHistory'
import { ViabilidadeContratoView } from './components/ViabilidadeContratoView'

type Modulo = 'pipeline' | 'viabilidade'

export function PreConstrucaoPage() {
  const currentStep = usePreConstrucaoStore((s) => s.currentStep)
  const [modulo, setModulo] = useState<Modulo>('pipeline')

  const STEP_COMPONENTS = {
    upload:        <UploadZone />,
    extraction:    <ExtractionView />,
    normalization: <NormalizacaoView />,
    matching:      <CostMatchingView />,
    proposal:      <ProposalView />,
  }

  return (
    <div className="flex h-full overflow-hidden">
      {modulo === 'pipeline' && <AnalysisHistory />}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252] shrink-0">
          <div>
            <h1 className="text-[#f5f5f5] font-bold text-base">Pré-Construção</h1>
            <p className="text-[10px] text-[#6b6b6b]">Estimativa e Orçamentação Inteligente</p>
          </div>
          <div className="flex items-center gap-1 bg-[#111] border border-[#525252] rounded-lg p-1">
            <button
              onClick={() => setModulo('pipeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                modulo === 'pipeline' ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
              }`}
            >
              <Layers size={12} /> Pipeline
            </button>
            <button
              onClick={() => setModulo('viabilidade')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                modulo === 'viabilidade' ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
              }`}
            >
              <Calculator size={12} /> Viabilidade do Contrato
            </button>
          </div>
        </div>
        {modulo === 'pipeline' && (
          <div className="px-6 py-4 border-b border-[#525252] shrink-0">
            <PipelineBar currentStep={currentStep} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">
          {modulo === 'pipeline' ? STEP_COMPONENTS[currentStep] : <ViabilidadeContratoView />}
        </div>
      </div>
    </div>
  )
}
