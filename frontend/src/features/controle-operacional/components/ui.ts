/**
 * ui.ts — classes do módulo, no dialeto grafite da plataforma (#2c2c2c / #525252 / #f97316).
 * Nunca `text-white`: o tema claro sobrescreve com !important e o texto some.
 */
export const cardCls = 'bg-[#3d3d3d] border border-[#525252] rounded-xl'
export const inputCls =
  'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] ' +
  'focus:outline-none focus:border-[#f97316] disabled:opacity-50 disabled:cursor-not-allowed'
export const btnPrimario =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f97316] ' +
  'text-[#ffffff] hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
export const btnNeutro =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] ' +
  'text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
export const btnMini =
  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-[#484848] ' +
  'text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
export const thCls = 'text-left text-[#a3a3a3] text-xs font-medium px-3 py-2 whitespace-nowrap'
export const tdCls = 'px-3 py-1.5 text-sm text-[#f5f5f5] whitespace-nowrap'
export const trCls = 'border-b border-[#525252]/50'
export const vazioCls = 'text-[#6b6b6b] text-sm text-center py-8'

export const brl = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const pct = (v: number | null | undefined, casas = 0): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`

export const num = (v: number | null | undefined, casas = 1): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas })

/** cor do selo de status/situação calculados */
export function corSituacao(v: unknown): string {
  const s = String(v ?? '').toUpperCase()
  if (!s) return 'text-[#6b6b6b]'
  if (/VENCID|FORA DO PRAZO|ATRASO|AFASTAR|RESTRI|CANCELAD|NÃO EXECUTADO|PARCIAL|BAIXO/.test(s)) return 'text-red-300'
  if (/BREVE|AGUARDANDO|30 DIAS|ATENÇÃO|REPROGRAMADO|A FATURAR|EM EXECUÇÃO/.test(s)) return 'text-amber-200'
  if (/NO PRAZO|MEDID|RECEBIDA|LIVRE|CONCLUÍDA|EXECUTADO|EM DIA|OK|BOA|NO DIA/.test(s)) return 'text-green-300'
  return 'text-[#f5f5f5]'
}
