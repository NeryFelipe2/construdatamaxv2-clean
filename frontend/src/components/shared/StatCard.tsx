import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  accent?: boolean
  className?: string
}

export function StatCard({ label, value, sub, icon: Icon, accent, className }: StatCardProps) {
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
            accent ? 'bg-[#2abfdc]/15 text-[#2abfdc]' : 'bg-[#1a3662] text-[#6b6b6b]'
          )}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-bold font-mono',
            accent ? 'text-[#2abfdc]' : 'text-[#f5f5f5]'
          )}
        >
          {value}
        </span>
        {sub && <span className="text-xs text-[#a3a3a3]">{sub}</span>}
      </div>
    </div>
  )
}
