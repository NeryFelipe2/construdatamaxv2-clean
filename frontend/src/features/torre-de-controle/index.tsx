import { useState } from 'react'
import { ObrasListPanel }  from './components/ObrasListPanel'
import { ObrasMap }         from './components/ObrasMap'
import { ObraDetailPanel }  from './components/ObraDetailPanel'
import { ObraDialog }       from './components/ObraDialog'
import { RiskDialog }       from './components/RiskDialog'

type MobileTab = 'lista' | 'mapa' | 'detalhes'

const MOBILE_TABS: { key: MobileTab; label: string }[] = [
  { key: 'lista',    label: 'Lista' },
  { key: 'mapa',     label: 'Mapa' },
  { key: 'detalhes', label: 'Detalhes' },
]

export function TorreDeControlePage() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('lista')

  return (
    <>
      {/* Mobile tab switcher — only visible on small screens */}
      <div className="flex lg:hidden border-b border-[#525252] bg-[#2c2c2c] shrink-0">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              mobileTab === tab.key
                ? 'text-[#f97316] border-b-2 border-[#f97316]'
                : 'text-[#6b6b6b] hover:text-[#a3a3a3]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: all three panels side-by-side */}
      {/* Mobile: only the active panel */}
      <div className="flex h-full overflow-hidden">
        <div className={`${mobileTab === 'lista' ? 'flex flex-1 lg:flex-initial' : 'hidden'} lg:flex flex-col`}>
          <ObrasListPanel />
        </div>
        <div className={`${mobileTab === 'mapa' ? 'flex flex-1' : 'hidden'} lg:flex lg:flex-1`}>
          <ObrasMap />
        </div>
        <div className={`${mobileTab === 'detalhes' ? 'flex flex-1 lg:flex-initial' : 'hidden'} lg:flex flex-col`}>
          <ObraDetailPanel />
        </div>
      </div>

      <ObraDialog />
      <RiskDialog />
    </>
  )
}
