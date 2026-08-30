// FlowHoverButton types for ConstrudaDataMax UI

export type FlowHoverButtonVariant = 'accent' | 'ghost' | 'white'

export interface FlowHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  children?: React.ReactNode
  variant?: FlowHoverButtonVariant
  href?: string
}
