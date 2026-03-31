import { cn } from '@/lib/utils'
import React from 'react'

interface FlowHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  children?: React.ReactNode
  variant?: 'accent' | 'ghost' | 'white'
  href?: string
}

export const FlowHoverButton: React.FC<FlowHoverButtonProps> = ({
  icon,
  children,
  variant = 'accent',
  className,
  href,
  ...props
}) => {
  const base = cn(
    `relative cursor-pointer z-0 inline-flex items-center justify-center gap-2 overflow-hidden
    px-6 py-2.5 font-semibold text-sm tracking-wide transition-all duration-300
    before:absolute before:inset-0 before:-z-10 before:translate-x-[150%] before:translate-y-[150%] before:scale-[2.5]
    before:rounded-[100%] before:transition-transform before:duration-700 before:content-[""]
    hover:before:translate-x-[0%] hover:before:translate-y-[0%] active:scale-95`,
    variant === 'accent'
      ? 'border border-[#2abfdc] text-[#2abfdc] before:bg-[#2abfdc] hover:text-black'
      : variant === 'white'
      ? 'border border-white/30 text-white before:bg-white hover:text-black'
      : 'border border-white/15 text-white/70 before:bg-white/10 hover:text-white hover:border-white/30',
    className
  )

  if (href) {
    return (
      <a href={href} className={base}>
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
      </a>
    )
  }

  return (
    <button className={base} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
