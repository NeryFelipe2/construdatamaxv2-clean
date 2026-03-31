import { useState } from 'react'
import { Search, Menu, X } from 'lucide-react'
import { FlowHoverButton } from '@/components/ui/flow-hover-button'

const NAV_LINKS = [
  { label: 'Plataforma', href: '#plataforma' },
  { label: 'Módulos', href: '#modulos' },
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Contato', href: '#contato' },
]

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header
      style={{ background: 'rgba(11,26,48,0.96)', borderBottom: '1px solid rgba(255,255,255,0.12)' }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <svg width="22" height="28" viewBox="0 0 24 32" fill="none">
              <path d="M12 2C12 2 2 14 2 21C2 26 6.5 30 12 30C17.5 30 22 26 22 21C22 14 12 2 12 2Z" stroke="#2abfdc" strokeWidth="1.6" fill="none" />
              <path d="M12 8C12 8 5 16 5 21C5 24.5 8.1 27 12 27C15.9 27 19 24.5 19 21C19 16 12 8 12 8Z" stroke="#5cd6ed" strokeWidth="1.4" fill="none" />
              <path d="M12 13.5C12 13.5 8.5 18 8.5 21C8.5 23 10 24.5 12 24.5C14 24.5 15.5 23 15.5 21C15.5 18 12 13.5 12 13.5Z" stroke="#8ae8f7" strokeWidth="1.2" fill="none" />
            </svg>
            <span
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.18em' }}
              className="text-white font-semibold text-sm uppercase"
            >
              Atlântico
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{ letterSpacing: '0.06em' }}
                className="text-white/75 text-xs font-medium uppercase hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-4">
            <button className="text-white/75 hover:text-white transition-colors p-1">
              <Search size={16} />
            </button>
            <FlowHoverButton variant="accent" href="/app/gestao-360" className="text-xs py-2 px-4">
              Começar Agora
            </FlowHoverButton>
          </div>

          {/* Mobile */}
          <button
            className="md:hidden text-white/85 hover:text-white p-1"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: '#0b1a30', borderTop: '1px solid rgba(255,255,255,0.12)' }} className="md:hidden">
          <div className="px-6 py-6 flex flex-col gap-5">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{ letterSpacing: '0.08em' }}
                className="text-white/80 text-xs uppercase font-medium hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <FlowHoverButton variant="accent" href="/app/gestao-360" className="w-full justify-center mt-2 text-xs">
              Começar Agora
            </FlowHoverButton>
          </div>
        </div>
      )}
    </header>
  )
}
