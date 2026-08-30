// Button types for ConstrudaDataMax UI
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react'

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

export interface ButtonVariants {
  variant: Record<ButtonVariant, string>
  size: Record<ButtonSize, string>
  defaultVariants: {
    variant: ButtonVariant
    size: ButtonSize
  }
}
