/**
 * OperacaoCampoPage — main page for the Operação e Campo module.
 * Split view: Calendar (left) + Dashboards (right) on desktop, tabs on mobile.
 */
import { useEffect, useState } from 'react'
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'
import { OperacaoCampoHeader } from './components/OperacaoCampoHeader'
import { CalendarioPanel } from './components/CalendarioPanel'
import { DashboardsPanel } from './components/DashboardsPanel'

export function OperacaoCampoPage() {
  const activities    = useOperacaoCampoStore((s) => s.activities)
  const loadDemoData  = useOperacaoCampoStore((s) => s.loadDemoData)

  const [mobileView, setMobileView] = useState<'calendario' | 'dashboards'>('calendario')

  useEffect(() => {
    if (activities.length === 0) loadDemoData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <OperacaoCampoHeader />

      {/* Mobile tab toggle */}
      <div className="lg:hidden flex gap-1 px-4 pt-3 shrink-0">
        {(['calendario', 'dashboards'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setMobileView(view)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              mobileView === view
                ? 'bg-[#f97316]/20 text-[#f97316]'
                : 'bg-[#3d3d3d] text-[#6b6b6b]'
            }`}
          >
            {view === 'calendario' ? 'Calendário' : 'Dashboards'}
          </button>
        ))}
      </div>

      {/* Content — split view on desktop */}
      <div className="flex-1 overflow-hidden p-4 flex gap-4">
        {/* Desktop: both visible */}
        <div className="hidden lg:flex gap-4 flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto">
            <CalendarioPanel />
          </div>
          <div className="overflow-y-auto">
            <DashboardsPanel />
          </div>
        </div>

        {/* Mobile: tab switch */}
        <div className="lg:hidden flex-1 overflow-auto">
          {mobileView === 'calendario' ? <CalendarioPanel /> : <DashboardsPanel />}
        </div>
      </div>
    </div>
  )
}
