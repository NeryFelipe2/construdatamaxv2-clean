/**
 * ResumoPeriodoPanel — réplica funcional do RESUMO (SUMIFS) da Execução_Geral:
 * tabela núcleo × serviço somando LA/LE/PRA/PRE/C.UMA/C.INSP/PV/PI/LIE/LIA
 * no intervalo de datas selecionado. Fonte real via useRelatorio360Real — sem
 * número inventado: sem lançamento no período = aviso honesto, não zero fake.
 */
import { AlertTriangle, CalendarRange, ClipboardList } from 'lucide-react'
import type { ResumoPeriodo, ResumoServicoRow } from '@/hooks/useRelatorio360Real'

function fmtM(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
function fmtUn(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

type ColKey = 'la' | 'le' | 'praM' | 'preM' | 'cUma' | 'cInsp' | 'pv' | 'pi' | 'lie' | 'lia'

const COLS: Array<{ key: ColKey; label: string; tipo: 'm' | 'un' }> = [
  { key: 'la', label: 'LA', tipo: 'un' },
  { key: 'le', label: 'LE', tipo: 'un' },
  { key: 'praM', label: 'PRA (m)', tipo: 'm' },
  { key: 'preM', label: 'PRE (m)', tipo: 'm' },
  { key: 'cUma', label: 'C.UMA', tipo: 'un' },
  { key: 'cInsp', label: 'C.INSP', tipo: 'un' },
  { key: 'pv', label: 'PV', tipo: 'un' },
  { key: 'pi', label: 'PI', tipo: 'un' },
  { key: 'lie', label: 'LIE', tipo: 'un' },
  { key: 'lia', label: 'LIA', tipo: 'un' },
]

function fmtCol(row: ResumoServicoRow, col: (typeof COLS)[number]): string {
  const v = row[col.key]
  return col.tipo === 'm' ? fmtM(v) : fmtUn(v)
}

interface Props {
  resumo: ResumoPeriodo
  periodoInicio: string | null
  periodoFim: string | null
  onChangeInicio: (v: string) => void
  onChangeFim: (v: string) => void
  loading: boolean
  temRegistrosNoPeriodo: boolean
}

export function ResumoPeriodoPanel({
  resumo,
  periodoInicio,
  periodoFim,
  onChangeInicio,
  onChangeFim,
  loading,
  temRegistrosNoPeriodo,
}: Props) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-[#f97316]" />
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Resumo do Período — Núcleo × Serviço</h3>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[#a3a3a3] text-[10px] uppercase tracking-wider flex items-center gap-1">
              <CalendarRange size={10} /> De
            </label>
            <input
              type="date"
              value={periodoInicio ?? ''}
              onChange={(e) => onChangeInicio(e.target.value)}
              className="h-8 px-2 rounded-lg border border-[#525252] bg-[#484848] text-[#f5f5f5] text-xs font-mono focus:outline-none focus:border-[#f97316]/60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[#a3a3a3] text-[10px] uppercase tracking-wider">Até</label>
            <input
              type="date"
              value={periodoFim ?? ''}
              min={periodoInicio ?? undefined}
              onChange={(e) => onChangeFim(e.target.value)}
              className="h-8 px-2 rounded-lg border border-[#525252] bg-[#484848] text-[#f5f5f5] text-xs font-mono focus:outline-none focus:border-[#f97316]/60"
            />
          </div>
        </div>
      </div>

      {!temRegistrosNoPeriodo ? (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5">
          <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-200/90">
            {loading
              ? 'Carregando produção...'
              : 'Sem produção lançada no período selecionado para esta obra. Lance a produção diária na aba Produção do RDO ou ajuste o intervalo de datas acima. Nada aqui é estimado ou de exemplo.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b6b6b] text-[10px] border-b border-[#525252] uppercase tracking-wide">
                <th className="text-left px-2 py-2 font-medium">Núcleo</th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-right px-2 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="text-right px-2 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {resumo.linhas.map((l) => (
                <tr key={l.nucleo} className="border-t border-[#525252]/50 hover:bg-[#484848]/20">
                  <td className="px-2 py-1.5 text-[#e5e5e5]">{l.nucleo}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-2 py-1.5 text-right text-[#e5e5e5] tabular-nums">
                      {fmtCol(l, c)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold text-[#f97316] tabular-nums">{fmtM(l.totalLinha)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#f97316]/40 bg-[#f97316]/10">
                <td className="px-2 py-2 font-bold text-[#f97316]">TOTAL</td>
                {COLS.map((c) => (
                  <td key={c.key} className="px-2 py-2 text-right font-bold text-[#f97316] tabular-nums">
                    {fmtCol(resumo.totalGeral, c)}
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-bold text-[#f97316] tabular-nums">{fmtM(resumo.totalGeral.totalLinha)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
