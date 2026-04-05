import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PipelineStep } from '@/types'

interface PipelineBarProps {
  currentStep: PipelineStep
}

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: 'upload',        label: 'Upload' },
  { key: 'extraction',    label: 'Extração' },
  { key: 'normalization', label: 'Normalização' },
  { key: 'matching',      label: 'Matching' },
  { key: 'proposal',      label: 'Proposta' },
]

const STEP_ORDER: PipelineStep[] = ['upload', 'extraction', 'normalization', 'matching', 'proposal']

function stepIndex(step: PipelineStep): number {
  return STEP_ORDER.indexOf(step)
}

export function PipelineBar({ currentStep }: PipelineBarProps) {
  const currentIdx = stepIndex(currentStep)

  return (
    <div className="flex items-center w-full">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx
        const isActive    = idx === currentIdx
        const isPending   = idx > currentIdx

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                  isCompleted && 'bg-[#f97316] text-white',
                  isActive    && 'bg-[#f97316] text-white ring-2 ring-[#f97316]/40',
                  isPending   && 'border-2 border-[#1f3c5e] text-[#6b6b6b] bg-transparent',
                )}
              >
                {isCompleted ? (
                  <Check size={14} strokeWidth={3} />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap',
                  (isCompleted || isActive) ? 'text-[#f5f5f5]' : 'text-[#6b6b6b]',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2 mb-4 rounded-full',
                  idx < currentIdx ? 'bg-[#f97316]' : 'bg-[#1f3c5e]',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
