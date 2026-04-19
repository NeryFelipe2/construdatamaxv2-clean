import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  accent?: boolean
  variant?: StatVariant
  className?: string
}

const VARIANT_COLORS: Record<StatVariant, { icon: string; value: string }> = {
  default: { icon: 'bg-[#1a3662] text-[#6b6b6b]', value: 'text-[#f5f5f5]' },
  accent:  { icon: 'bg-[#2abfdc]/15 text-[#2abfdc]', value: 'text-[#2abfdc]' },
  success: { icon: 'bg-[#22c55e]/15 text-[#22c55e]', value: 'text-[#22c55e]' },
  warning: { icon: 'bg-[#fbbf24]/15 text-[#fbbf24]', value: 'text-[#fbbf24]' },
  danger:  { icon: 'bg-[#ef4444]/15 text-[#ef4444]', value: 'text-[#ef4444]' },
}

export function StatCard({ label, value, sub, icon: Icon, accent, variant, className }: StatCardProps) {
  const resolved = variant ?? (accent ? 'accent' : 'default')
  const colors = VARIANT_COLORS[resolved]

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-[#20406a] bg-[#14294e] p-4',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          {label}
        </span>
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg',
            colors.icon
          )}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-bold font-mono',
            colors.value
          )}
        >
          {value}
        </span>
        {sub && <span className="text-xs text-[#a3a3a3]">{sub}</span>}
      </div>
    </div>
  )
}
