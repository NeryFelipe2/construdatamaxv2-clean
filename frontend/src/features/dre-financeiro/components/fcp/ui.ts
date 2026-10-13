/**
 * ui.ts — classes compartilhadas do FCP, no dialeto grafite da plataforma.
 * Nunca usar `text-white` aqui: o tema claro o sobrescreve com !important
 * (globals.css) e o texto some sobre fundo escuro. Use text-[#f5f5f5], e
 * text-[#ffffff] só quando o branco precisa sobreviver sobre laranja.
 */
export const cardCls = 'bg-[#3d3d3d] border border-[#525252] rounded-xl'
export const inputCls =
  'bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] ' +
  'focus:outline-none focus:border-[#f97316] disabled:opacity-50 disabled:cursor-not-allowed'
export const btnPrimario =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f97316] ' +
  'text-[#ffffff] hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
export const btnNeutro =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] ' +
  'text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
export const thCls = 'text-left text-[#a3a3a3] text-xs font-medium px-4 py-2 whitespace-nowrap'
export const trCls = 'border-b border-[#525252]/50'
export const vazioCls = 'text-[#6b6b6b] text-sm text-center py-8'

export const brl = (v: number | null | undefined): string =>
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })

export const num1 = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export const num2 = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export const pct = (v: number | null | undefined, casas = 1): string =>
  v === null || v === undefined ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`

export const dataBr = (iso: string | null | undefined): string =>
  !iso ? '—' : new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')

/** vermelho quando negativo — saldo de caixa é o número que o leitor procura */
export const corValor = (v: number): string => (v < 0 ? 'text-red-400' : 'text-[#f5f5f5]')
