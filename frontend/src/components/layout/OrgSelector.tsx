/**
 * OrgSelector.tsx - seletor de organizacao (empresa) na topbar.
 * Estrutura copiada do ProjectSelector de App.tsx (botao Building2 + nome +
 * ChevronDown, overlay fixed inset-0 z-40, dropdown), com fonte no orgStore.
 *
 * Regras:
 *  - 0 orgs -> nao renderiza nada (pre-migration / modo degradado).
 *  - <=1 org e usuario nao e admin global -> so o nome como texto.
 *  - admin global -> primeira opcao "Todas as empresas" (orgAtivaId = null).
 */
import { useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrgStore } from '@/store/orgStore'
import { useAuthStore } from '@/store/authStore'

export function OrgSelector({ isDark = false }: { isDark?: boolean }) {
  const orgs = useOrgStore((s) => s.orgs)
  const orgAtivaId = useOrgStore((s) => s.orgAtivaId)
  const trocarOrg = useOrgStore((s) => s.trocarOrg)
  const isGlobalAdmin = useAuthStore((s) => s.profile?.is_global_admin === true)
  const [open, setOpen] = useState(false)

  if (orgs.length === 0) return null

  const active = orgs.find((o) => o.id === orgAtivaId) ?? null
  const label = active?.nome ?? (isGlobalAdmin ? 'Todas as empresas' : orgs[0].nome)

  // Mesmos tokens de tema do ProjectSelector (App.tsx).
  const c = isDark
    ? { btnBg: 'bg-[#112645]', btnBorder: 'border-[#20406a]', btnHover: 'hover:border-[#2abfdc]/50', text: 'text-[#e4f2f8]', accent: 'text-[#2abfdc]', dropBg: 'bg-[#0d2040]', dropBorder: 'border-[#20406a]', section: 'text-[#5a8caa]', sub: 'text-[#5a8caa]', hoverRow: 'hover:bg-[#14294e]', activeRow: 'bg-[#2abfdc]/10' }
    : { btnBg: 'bg-white', btnBorder: 'border-gray-300', btnHover: 'hover:border-blue-400', text: 'text-gray-800', accent: 'text-blue-600', dropBg: 'bg-white', dropBorder: 'border-gray-200', section: 'text-gray-400', sub: 'text-gray-500', hoverRow: 'hover:bg-gray-50', activeRow: 'bg-blue-50' }

  // Uma org so e sem poder de troca: apenas o nome, sem dropdown.
  if (orgs.length <= 1 && !isGlobalAdmin) {
    return (
      <div className="flex items-center gap-2 px-1 max-w-[200px]">
        <Building2 size={14} className={cn('shrink-0', c.accent)} />
        <span className={cn('text-xs font-medium truncate', c.text)}>{label}</span>
      </div>
    )
  }

  function selecionar(id: string | null) {
    setOpen(false)
    if (id === orgAtivaId) return // evita reload sem mudanca
    void trocarOrg(id)
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setOpen(!open)}
        className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors max-w-[220px]', c.btnBg, c.btnBorder, c.btnHover)}
      >
        <Building2 size={14} className={cn('shrink-0', c.accent)} />
        <span className={cn('text-xs font-medium truncate', c.text)}>{label}</span>
        <ChevronDown size={12} className={cn('shrink-0 transition-transform', c.sub, open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn('absolute top-full left-0 mt-1 z-50 w-64 rounded-xl shadow-2xl overflow-hidden border', c.dropBg, c.dropBorder)}>
            <div className={cn('p-2 border-b', c.dropBorder)}>
              <span className={cn('text-[9px] font-bold uppercase tracking-widest px-2', c.section)}>Empresas</span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {isGlobalAdmin && (
                <button
                  onClick={() => selecionar(null)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors', c.hoverRow, orgAtivaId === null && c.activeRow)}
                >
                  <div className="w-2 h-2 rounded-full shrink-0 bg-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-xs font-medium truncate', c.text)}>Todas as empresas</div>
                    <div className={cn('text-[10px]', c.sub)}>Visão global (admin)</div>
                  </div>
                </button>
              )}
              {orgs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => selecionar(o.id)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors', c.hoverRow, o.id === orgAtivaId && c.activeRow)}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: o.cor_primaria || '#94a3b8' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-xs font-medium truncate', c.text)}>{o.nome}</div>
                    {o.slug && <div className={cn('text-[10px] truncate', c.sub)}>{o.slug}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
