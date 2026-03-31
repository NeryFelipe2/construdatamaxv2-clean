import { Search, AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'
import type { Rede360Tab } from '@/types'

const TABS: { id: Rede360Tab; label: string }[] = [
  { id: 'home',     label: 'Home'                   },
  { id: 'outages',  label: 'Live Outage Map'        },
  { id: 'planning', label: 'Integrated Planning'    },
  { id: 'risk',     label: 'Asset Risk Management' },
]

export function Rede360Header() {
  const { activeTab, setActiveTab, outages, searchQuery, setSearchQuery } = useRede360Store(
    useShallow((s) => ({
      activeTab:      s.activeTab,
      setActiveTab:   s.setActiveTab,
      outages:        s.outages,
      searchQuery:    s.searchQuery,
      setSearchQuery: s.setSearchQuery,
    }))
  )
  const activeOutages = outages.filter((o) => o.status === 'active').length

  return (
    <div className="bg-[#0a1628] border-b border-[#20406a] shrink-0">
      {/* Top row: brand + search + meta */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#20406a]/50">
        <span className="text-[#2abfdc] font-bold text-sm tracking-wide whitespace-nowrap">Rede 360</span>
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across your grid..."
            className="w-full pl-7 pr-3 py-1 bg-[#14294e] border border-[#20406a] rounded text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#2abfdc]"
          />
        </div>
        <span className="text-xs text-[#6b6b6b] ml-auto whitespace-nowrap">National Data</span>
        {activeOutages > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-300 whitespace-nowrap">
            <AlertTriangle size={12} />
            Current Outages: {activeOutages}
          </div>
        )}
      </div>
      {/* Tab row */}
      <div className="flex items-center px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'h-10 px-4 text-xs font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-b-2 border-[#2abfdc] text-[#f5f5f5]'
                : 'text-[#6b6b6b] hover:text-[#8fb3c8]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
