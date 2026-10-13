/**
 * TermoLps — termo do glossário LPS com tooltip (borda pontilhada, hover).
 * Definições em src/features/guia/glossario.ts; termo desconhecido rende o
 * texto puro, sem fingir que tem definição.
 */
import type { ReactNode } from 'react'
import { GLOSSARIO } from './glossario'

export function TermoLps({ termo, children }: { termo: string; children?: ReactNode }) {
  const definicao = GLOSSARIO[termo]
  if (!definicao) return <>{children ?? termo}</>
  return (
    <span className="relative group cursor-help border-b border-dotted border-[#64748b] text-[#cbd5e1]">
      {children ?? termo}
      <span className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-64 group-hover:block rounded border border-[#1e293b] bg-[#0d1420] p-2.5 text-[10px] leading-relaxed text-[#cbd5e1] shadow-xl">
        <span className="block text-[9px] font-bold uppercase tracking-widest text-[#f97316] mb-1">{termo}</span>
        {definicao}
      </span>
    </span>
  )
}
