// InfoTooltip types for ConstrudaDataMax UI
import type { ReactNode, MouseEventHandler } from 'react'

export interface TooltipContent {
  title: string
  description: string
  whyItMatters?: string
  actionHint?: string
  efficiencyNote?: string
}

export interface InfoTooltipProps {
  content: TooltipContent
  position?: 'top' | 'bottom' | 'left' | 'right'
  size?: number
  children?: ReactNode
  className?: string
  variant?: 'icon' | 'inline'
}

export interface InfoTooltipCompound {
  Tooltip: React.FC<InfoTooltipProps>
  TOOLTIPS: Record<string, TooltipContent>
}
