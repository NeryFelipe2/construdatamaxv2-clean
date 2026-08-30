/**
 * ProdutividadePanel — réplica funcional de PROD_EQUIPE / PROD_NÚCLEO da
 * Execução_Relatórios: média de rede (m/dia) e ligações (un/dia) por equipe
 * e por núcleo, no período selecionado (mesmo hook/estado do ResumoPeriodoPanel).
 *
 * Regra do denominador (documentada e exibida ao usuário): dias DISTINTOS com
 * pelo menos 1 lançamento de produção para aquela equipe/núcleo no período —
 * não é contagem de dias corridos do calendário.
 */
import { Gauge } from 'lucide-react'
import type { ProdutividadeRow } from '@/hooks/useRelatorio360Real'

function fmt1(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function ProdutividadeTable({ titulo, rows, chaveLabel }: { titulo: string; rows: ProdutividadeRow[]; chaveLabel: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <h4 className="text-[#f5f5f5] text-xs font-semibold mb-3">{titulo}</h4>
      {rows.length === 0 ? (
        <p className="text-[#6b6b6b] text-xs text-center py-4">Sem produção lançada no período.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[#6b6b6b] text-[10px] border-b border-[#525252] uppercase tracking-wide">
              <th className="text-left px-2 py-2 font-medium">{chaveLabel}</th>
              <th className="text-right px-2 py-2 font-medium">Dias c/ registro</th>
              <th className="text-right px-2 py-2 font-medium">Rede (m/dia)</th>
              <th className="text-right px-2 py-2 font-medium">Ligações (un/dia)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.chave} className="border-t border-[#525252]/50 hover:bg-[#484848]/20">
                <td className="px-2 py-1.5 text-[#e5e5e5]">{r.chave}</td>
                <td className="px-2 py-1.5 text-right text-[#a3a3a3] tabular-nums">{r.diasDistintos}</td>
                <td className="px-2 py-1.5 text-right text-[#f97316] font-semibold tabular-nums">{fmt1(r.redeMDiaUtil)}</td>
                <td className="px-2 py-1.5 text-right text-[#f97316] font-semibold tabular-nums">{fmt1(r.ligacoesUnDiaUtil)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function ProdutividadePanel({ porEquipe, porNucleo }: { porEquipe: ProdutividadeRow[]; porNucleo: ProdutividadeRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-[#f97316]" />
        <h3 className="text-[#f5f5f5] text-sm font-semibold">Produtividade — Média no Período</h3>
      </div>
      <p className="text-[#6b6b6b] text-[10px] leading-relaxed">
        Regra do denominador: nº de dias <b className="text-[#a3a3a3]">distintos</b> com pelo menos 1 lançamento de produção
        para a equipe/núcleo dentro do período selecionado (não é contagem de dias corridos do calendário).
        Rede = PRA + PRE (m); Ligações = LA + LE (un).
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProdutividadeTable titulo="Por Equipe" rows={porEquipe} chaveLabel="Equipe" />
        <ProdutividadeTable titulo="Por Núcleo" rows={porNucleo} chaveLabel="Núcleo" />
      </div>
    </div>
  )
}
