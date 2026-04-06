import { Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GestaoHeaderProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const TABS: { key: string; label: string }[] = [
  { key: 'equipamentos', label: 'Equipamentos' },
  { key: 'dashboard',    label: 'Dashboard'    },
  { key: 'manutencoes',  label: 'Manutenções'  },
  { key: 'utilizacao',   label: 'Utilização'   },
  { key: 'custos',       label: 'Custos'       },
]

export function GestaoHeader({ activeTab, onTabChange }: GestaoHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-0 border-b border-[#525252] bg-[#333333] shrink-0">
      {/* Left — module title */}
      <div className="flex items-center gap-3 py-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15">
          <Settings2 size={18} className="text-[#f97316]" />
        </div>
        <div>
          <h1 className="text-[#f5f5f5] font-bold text-base leading-tight">
            Gestão de Equipamentos
          </h1>
          <p className="text-[#6b6b6b] text-xs">Manutenção, utilização e custos da frota</p>
        </div>
      </div>

      {/* Right — tab bar */}
      <nav className="flex items-end h-full">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'relative px-5 py-4 text-xs font-semibold transition-colors whitespace-nowrap',
                isActive
                  ? 'text-[#f97316]'
                  : 'text-[#6b6b6b] hover:text-[#a3a3a3]',
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#f97316] rounded-t-sm" />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
