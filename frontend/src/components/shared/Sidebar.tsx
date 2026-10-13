import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Sun, Moon, FlaskConical, ChevronRight, ChevronLeft, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { useAppModeStore } from '@/store/appModeStore'
import { useAlertCounts } from '@/hooks/useAlertCounts'
import { NAV_ITEMS_FLAT } from '@/config/navigation'

const SIDEBAR_KEY = 'cdata-sidebar'

// NOTA (20/07/2026): este componente não está mais referenciado por nenhuma
// rota (App.tsx tem seu próprio Sidebar inline para os temas Dark/Light, e o
// tema eKyte usa AppLayout.tsx). Mantido + atualizado por segurança: se algum
// dia for religado, os itens já vêm sincronizados via NAV_ITEMS_FLAT em vez de
// uma lista duplicada e desatualizada (era essa duplicação que escondia
// módulos do menu).
const navItems = NAV_ITEMS_FLAT

// ─── Atlântico water-drop logo (matches brand mark) ───────────────────────────
function WaterDropLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 36 44"
      fill="none"
      stroke="#2abfdc"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={Math.round(size * 44 / 36)}
    >
      {/* Outer teardrop */}
      <path d="M18 2 C18 2 33 17 33 28 C33 37.2 26.3 43 18 43 C9.7 43 3 37.2 3 28 C3 17 18 2 18 2Z" />
      {/* Inner teardrop */}
      <path d="M18 12 C18 12 27 23 27 29.5 C27 35.5 23 39.5 18 39.5 C13 39.5 9 35.5 9 29.5 C9 23 18 12 18 12Z" />
    </svg>
  )
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { theme, toggleTheme } = useThemeStore(
    useShallow((s) => ({ theme: s.theme, toggleTheme: s.toggleTheme }))
  )
  const { isDemoMode, toggleDemoMode } = useAppModeStore(
    useShallow((s) => ({ isDemoMode: s.isDemoMode, toggleDemoMode: s.toggleDemoMode }))
  )

  const alertCounts = useAlertCounts()

  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) !== 'false' } catch { return true }
  })

  function toggleSidebar() {
    setIsOpen((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch { /* noop */ }
      return next
    })
  }

  return (
    <aside
      className={cn(
        'flex flex-col shrink-0 border-r border-[#20406a] bg-[#0d2040] h-full',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        isOpen ? 'w-[200px]' : 'w-16',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 border-b border-[#20406a] shrink-0 px-[14px] gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
          style={{
            background: 'radial-gradient(circle at 40% 35%, #112e52 0%, #071422 100%)',
            boxShadow: '0 0 12px rgba(42,191,220,0.25), inset 0 1px 0 rgba(42,191,220,0.15)',
            border: '1px solid rgba(42,191,220,0.3)',
          }}
        >
          <WaterDropLogo size={20} />
        </div>
        {isOpen && (
          <div className="flex flex-col leading-none">
            <span
              className="text-sm font-bold whitespace-nowrap"
              style={{ color: '#e4f2f8', letterSpacing: '0.02em' }}
            >
              Atlântico
            </span>
            <span className="text-[9px] font-medium tracking-widest uppercase" style={{ color: '#2abfdc', opacity: 0.8 }}>
              Plataforma
            </span>
          </div>
        )}
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto text-[#6b6b6b] hover:text-[#e4f2f8] transition-colors md:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col flex-1 gap-0.5 p-2 pt-3 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={isOpen ? undefined : item.label}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg transition-colors',
                'h-10 px-[10px]',
                isActive
                  ? 'bg-[#2abfdc]/12 text-[#2abfdc]'
                  : 'text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8]',
              )
            }
          >
            <span className="relative shrink-0">
              <item.icon size={20} />
              {(alertCounts[item.to] ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#ef4444] text-white text-[9px] font-bold leading-none">
                  {alertCounts[item.to] > 9 ? '9+' : alertCounts[item.to]}
                </span>
              )}
            </span>
            {isOpen && (
              <span className="text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {item.label}
              </span>
            )}
          </NavLink>
        ))}

        {/* Bottom controls */}
        <div className="mt-auto flex flex-col gap-0.5 pt-2 border-t border-[#20406a]">
          {/* Expand/collapse toggle */}
          <button
            onClick={toggleSidebar}
            title={isOpen ? 'Recolher menu' : 'Expandir menu'}
            className="flex items-center gap-3 h-10 px-[10px] rounded-lg text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8] transition-colors"
          >
            {isOpen ? <ChevronLeft size={20} className="shrink-0" /> : <ChevronRight size={20} className="shrink-0" />}
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">Recolher</span>}
          </button>

          {/* Demo mode toggle */}
          <button
            onClick={toggleDemoMode}
            title={isDemoMode ? 'Desativar Modo Demo' : 'Ativar Modo Demo'}
            className={cn(
              'flex items-center gap-3 h-10 px-[10px] rounded-lg transition-colors',
              isDemoMode
                ? 'bg-[#2abfdc]/12 text-[#2abfdc]'
                : 'text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8]',
            )}
          >
            <FlaskConical size={18} className="shrink-0" />
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">Demo</span>}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            className="flex items-center gap-3 h-10 px-[10px] rounded-lg text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8] transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>}
          </button>
        </div>
      </nav>
    </aside>
  )
}
