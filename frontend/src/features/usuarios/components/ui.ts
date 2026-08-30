/**
 * ui.ts — constantes de estilo do dialeto GRAFITE do módulo Usuários & Acessos.
 * (Texto claro é sempre text-[#f5f5f5]; branco puro #ffffff só sobre laranja.)
 */
import type { OrgRole } from '@/hooks/useUsuarios'

export const inputCls =
  'w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316] transition-colors'

export const selectCls =
  'w-full bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316] transition-colors'

export const btnPrimario =
  'px-4 py-2 rounded-lg text-sm font-medium bg-[#f97316] text-[#ffffff] hover:bg-[#ea580c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

export const btnSecundario =
  'px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

export const btnPerigo =
  'px-4 py-2 rounded-lg text-sm font-medium bg-[#b91c1c] text-[#ffffff] hover:bg-[#991b1b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

export const cardCls = 'bg-[#3d3d3d] border border-[#525252] rounded-xl'

export const modalOverlayCls =
  'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto'

export const modalBoxCls = 'bg-[#2c2c2c] border border-[#525252] rounded-xl shadow-2xl my-8'

export const thCls = 'text-left text-[#a3a3a3] text-xs font-medium px-4 py-2'

export const labelCls = 'block text-xs font-medium text-[#a3a3a3] mb-1.5'

/** Cor de cada papel na organização (chip da tabela / do select). */
export const ROLE_BADGE: Record<OrgRole, string> = {
  owner:  'bg-[#f97316]/15 text-[#fdba74] border border-[#f97316]/40',
  admin:  'bg-purple-900/40 text-purple-300 border border-purple-700/40',
  gestor: 'bg-sky-900/40 text-sky-300 border border-sky-700/40',
  membro: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40',
  leitor: 'bg-[#484848] text-[#a3a3a3] border border-[#5e5e5e]',
}

/** dd/mm/aaaa hh:mm — devolve null quando a data não veio (nunca inventa). */
export function formatarData(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

/** Copia para a área de transferência; devolve false quando o browser recusa. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
