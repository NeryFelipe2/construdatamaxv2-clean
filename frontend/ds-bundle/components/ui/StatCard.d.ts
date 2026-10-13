// StatCard types for ConstrudaDataMax UI
import type { LucideIcon } from 'lucide-react'

export type StatVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'

export interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  accent?: boolean
  variant?: StatVariant
  className?: string
}
