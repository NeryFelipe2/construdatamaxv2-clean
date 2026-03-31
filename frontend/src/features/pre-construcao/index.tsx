import { usePreConstrucaoStore } from '@/store/preConstrucaoStore'
import { PipelineBar }      from './components/PipelineBar'
import { UploadZone }       from './components/UploadZone'
import { ExtractionView }   from './components/ExtractionView'
import { NormalizacaoView } from './components/NormalizacaoView'
import { CostMatchingView } from './components/CostMatchingView'
import { ProposalView }     from './components/ProposalView'
import { AnalysisHistory }  from './components/AnalysisHistory'

export function PreConstrucaoPage() {
  const currentStep = usePreConstrucaoStore((s) => s.currentStep)

  const STEP_COMPONENTS = {
    upload:        <UploadZone />,
    extraction:    <ExtractionView />,
    normalization: <NormalizacaoView />,
    matching:      <CostMatchingView />,
    proposal:      <ProposalView />,
  }

  return (
    <div className="flex h-full overflow-hidden">
      <AnalysisHistory />
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#20406a] shrink-0">
          <div>
            <h1 className="text-[#f5f5f5] font-bold text-base">Pré-Construção</h1>
            <p className="text-[10px] text-[#6b6b6b]">Estimativa e Orçamentação Inteligente</p>
          </div>
        </div>
        <div className="px-6 py-4 border-b border-[#20406a] shrink-0">
          <PipelineBar currentStep={currentStep} />
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {STEP_COMPONENTS[currentStep]}
        </div>
      </div>
    </div>
  )
}
