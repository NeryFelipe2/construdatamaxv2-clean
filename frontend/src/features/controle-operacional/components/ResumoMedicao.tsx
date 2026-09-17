/**
 * ResumoMedicao — total por boletim (R$) e quantidade por unidade (metro não soma com unidade).
 */
import { useMemo } from 'react'
import type { ContextoCalculo } from '../dominio/calculos'
import { quantidadesPorUnidade, totaisPorBoletim } from '../dominio/calculos'
import { brl, num } from './ui'

export function ResumoMedicao({ ctx }: { ctx: ContextoCalculo }) {
  const boletins = useMemo(() => totaisPorBoletim(ctx.idx), [ctx])
  const porUn = useMemo(() => [...quantidadesPorUnidade(ctx.idx.medicoes, ctx.idx).entries()], [ctx])
  if (boletins.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {boletins.map((b) => (
        <span key={b.boletim ?? '—'} className="rounded-md bg-[#3d3d3d] border border-[#525252] px-2 py-1 text-[#f5f5f5]"
          title={b.sem_valor ? `${b.sem_valor} item(ns) sem valor calculável (código não encontrado ou QTD vazia)` : ''}>
          {b.boletim ?? 'sem boletim'}: {b.itens} itens · <span className="font-mono">{brl(b.valor)}</span>
          {b.sem_valor > 0 && <span className="text-amber-200"> · {b.sem_valor} sem valor</span>}
        </span>
      ))}
      {porUn.map(([un, q]) => (
        <span key={un} className="rounded-md px-2 py-1 text-[#a3a3a3]">{num(q, 2)} {un}</span>
      ))}
    </div>
  )
}
