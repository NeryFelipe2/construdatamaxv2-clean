/**
 * ui.ts — constantes de estilo do dialeto GRAFITE do módulo Pessoal.
 * (Texto claro é sempre text-[#f5f5f5]; branco puro #ffffff só sobre laranja.)
 */
import type { PessoaStatus } from '@/hooks/usePessoas'

export const inputCls =
  'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 transition-colors'

export const selectCls =
  'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50 transition-colors'

export const btnPrimario =
  'px-4 py-2 rounded-lg text-sm font-medium bg-[#f97316] text-[#ffffff] hover:bg-[#ea580c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

export const btnSecundario =
  'px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

export const cardCls = 'bg-[#3d3d3d] border border-[#525252] rounded-xl'

export const modalOverlayCls = 'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4'

export const modalBoxCls = 'bg-[#2c2c2c] border border-[#525252] rounded-xl shadow-2xl'

export const thCls = 'text-left text-[#a3a3a3] text-xs font-medium px-4 py-2'

export const STATUS_META: Record<PessoaStatus, { label: string; badge: string }> = {
  ativo:          { label: 'Ativo',          badge: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40' },
  desligado:      { label: 'Desligado',      badge: 'bg-red-900/40 text-red-300 border border-red-700/40' },
  em_contratacao: { label: 'Em contratação', badge: 'bg-sky-900/40 text-sky-300 border border-sky-700/40' },
  afastado:       { label: 'Afastado',       badge: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40' },
  desconhecido:   { label: 'Desconhecido',   badge: 'bg-[#484848] text-[#a3a3a3] border border-[#5e5e5e]' },
}

export const AVISO_MIGRATIONS =
  'Migrations de pessoal ainda não aplicadas no banco (020/021/022) — os dados aparecem assim que forem coladas no Supabase.'
