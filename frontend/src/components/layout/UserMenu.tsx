/**
 * UserMenu.tsx - avatar com iniciais + dropdown (nome, e-mail, badge Admin
 * Global, botao Sair). Some quando nao ha usuario (modo local sem Supabase).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function UserMenu({ isDark = false }: { isDark?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const semSupabase = useAuthStore((s) => s.semSupabase)
  const sair = useAuthStore((s) => s.sair)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (semSupabase || !user) return null

  const nome = profile?.full_name || user.email || 'Usuário'
  const email = profile?.email || user.email || ''
  const isGlobalAdmin = profile?.is_global_admin === true

  const c = isDark
    ? { dropBg: 'bg-[#0d2040]', dropBorder: 'border-[#20406a]', text: 'text-[#e4f2f8]', sub: 'text-[#5a8caa]', hoverRow: 'hover:bg-[#14294e]' }
    : { dropBg: 'bg-white', dropBorder: 'border-gray-200', text: 'text-gray-800', sub: 'text-gray-500', hoverRow: 'hover:bg-gray-50' }

  async function handleSair() {
    setOpen(false)
    await sair()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setOpen(!open)}
        title={nome}
        aria-label="Menu do usuário"
        className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f97316] text-[#ffffff] text-[11px] font-bold border-2 border-[#ffffff]/20 hover:border-[#ffffff]/50 transition-colors shrink-0"
      >
        {iniciais(nome)}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn('absolute top-full right-0 mt-1 z-50 w-60 rounded-xl shadow-2xl overflow-hidden border', c.dropBg, c.dropBorder)}>
            <div className={cn('px-4 py-3 border-b', c.dropBorder)}>
              <div className={cn('text-xs font-semibold truncate', c.text)}>{nome}</div>
              {email && <div className={cn('text-[10px] truncate', c.sub)}>{email}</div>}
              {isGlobalAdmin && (
                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[9px] font-bold uppercase tracking-widest">
                  <ShieldCheck size={10} />
                  Admin Global
                </span>
              )}
            </div>
            <button
              onClick={handleSair}
              className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-red-400 transition-colors', c.hoverRow)}
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  )
}
