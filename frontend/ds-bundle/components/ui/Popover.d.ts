// Popover types for ConstrudaDataMax UI (based on Radix UI)
import type { PopoverContentProps } from '@radix-ui/react-popover'

export interface PopoverProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export interface PopoverTriggerProps {
  asChild?: boolean
  children?: React.ReactNode
}

export interface PopoverContentProps extends PopoverContentProps {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

export interface PopoverCompound {
  Root: React.FC<{ children: React.ReactNode }>
  Trigger: React.FC<PopoverTriggerProps>
  Content: React.FC<PopoverContentProps>
  Anchor: React.FC<{ children: React.ReactNode }>
}
