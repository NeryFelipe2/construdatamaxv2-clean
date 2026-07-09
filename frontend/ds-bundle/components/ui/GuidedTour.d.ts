// GuidedTour types for ConstrudaDataMax UI
import type { ReactNode } from 'react'

export interface TourStep {
  target?: string
  title: string
  description: string
  insight?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

export interface TourContextValue {
  isActive: boolean
  currentStep: number
  totalSteps: number
  startTour: (tourId: string) => void
  stopTour: () => void
  nextStep: () => void
  prevStep: () => void
  activeTourId: string | null
}

export interface GuidedTourCompound {
  TourProvider: React.FC<{ children: ReactNode }>
  TourButton: React.FC<{ tourId: string; label?: string; className?: string }>
  TOURS: Record<string, TourStep[]>
  useTour: () => TourContextValue
}
