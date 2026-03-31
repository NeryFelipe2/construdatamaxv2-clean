import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar } from './Sidebar'
import { DemoBanner } from './DemoBanner'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DemoBanner />

      {/* Mobile top bar — hidden on md+ */}
      <div className="flex md:hidden items-center gap-3 px-4 h-12 border-b border-[#20406a] bg-[#0d2040] shrink-0 z-20">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-[#6b6b6b] hover:text-[#2abfdc] transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        <span className="text-[#e4f2f8] text-sm font-bold tracking-wide">Atlântico</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Backdrop — mobile only */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar wrapper: overlay on mobile, inline on desktop */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-40 h-full',
            'md:relative md:inset-auto md:z-auto',
            'transition-transform duration-200 ease-in-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          )}
        >
          <Sidebar onClose={() => setMobileOpen(false)} />
        </div>

        <main className="flex-1 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
