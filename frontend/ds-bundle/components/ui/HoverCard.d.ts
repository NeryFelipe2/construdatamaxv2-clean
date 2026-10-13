// HoverCard types for ConstrudaDataMax UI (based on Radix UI)
import type { HoverCardContentProps } from '@radix-ui/react-hover-card'

export interface HoverCardProps {}

export interface HoverCardTriggerProps {
  asChild?: boolean
  children?: React.ReactNode
}

export interface HoverCardContentProps extends HoverCardContentProps {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

export interface HoverCardCompound {
  Root: React.FC<{ children: React.ReactNode }>
  Trigger: React.FC<HoverCardTriggerProps>
  Content: React.FC<HoverCardContentProps>
}
