/**
 * RdoResumoPanel — aba 10. O RDO do sistema é o módulo /app/rdo; aqui fica só o que a
 * planilha calculava do dia (efetivo, HH, serviços, R$, ocorrências) e as linhas de RDO
 * que vieram na planilha, guardadas para não se perderem.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, FileText } from 'lucide-react'
import type { ContextoCalculo } from '../dominio/calculos'
import { rdoResumoDia } from '../dominio/calculos'
import { dataBR } from '../dominio/datas'
import { brl, btnNeutro, cardCls, num, tdCls, thCls, trCls, vazioCls } from './ui'

export function RdoResumoPanel({ ctx }: { ctx: ContextoCalculo }) {
  const dias = useMemo(() => {
    const s = new Set<string>()
    for (const a of ctx.idx.apontamentos) s.add(a.data)
    for (const o of ctx.idx.ordens) if (o.data_conclusao) s.add(o.data_conclusao)
    for (const o of ctx.idx.ocorrencias) if (o.data) s.add(o.data)
    const importados = new Map<string, Record<string, unknown>>()
    for (const p of ctx.dados.pendentes) {
      if (p.deleted_at || p.aba !== '10') continue
      const d = p.dados?.data as string | undefined
      if (d) { s.add(d); importados.set(d, p.dados) }
    }
    return [...s].sort().reverse().slice(0, 60).map((d) => ({ resumo: rdoResumoDia(d, ctx), importado: importados.get(d) ?? null }))
  }, [ctx])

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-4 flex flex-wrap items-center gap-3`}>
        <FileText size={16} className="text-[#f97316]" />
        <p className="text-sm text-[#f5f5f5] flex-1">O diário de obra oficial é o módulo <b>RDO</b>. Esta aba mostra o que a planilha calculava do dia.</p>
        <Link to="/app/rdo" className={btnNeutro}><ExternalLink size={13} /> Abrir RDO</Link>
      </div>
      {dias.length === 0 ? <div className={vazioCls}>Sem apontamento, OS ou ocorrência lançados.</div> : (
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full">
            <thead><tr className={trCls}>
              {['Data', 'Efetivo', 'Equipes', 'HH', 'Serv. executados', 'R$ produzido', 'Ocorrências', 'Da planilha (clima · atividades)'].map((h) => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody>{dias.map(({ resumo: r, importado }) => (
              <tr key={r.data} className={trCls}>
                <td className={tdCls}>{dataBR(r.data)}</td>
                <td className={`${tdCls} text-right`}>{num(r.efetivo, 0)}</td>
                <td className={`${tdCls} text-right`}>{r.equipes}</td>
                <td className={`${tdCls} text-right`}>{num(r.hh, 0)}</td>
                <td className={`${tdCls} text-right`}>{r.servicos_executados}</td>
                <td className={`${tdCls} text-right font-mono text-xs`}>{brl(r.valor_produzido)}</td>
                <td className={tdCls}>{r.texto_ocorrencias}</td>
                <td className={`${tdCls} max-w-[360px] truncate text-[#a3a3a3]`} title={importado ? String(importado.atividades ?? '') : ''}>
                  {importado ? [importado.clima_manha, importado.clima_tarde, importado.atividades].filter(Boolean).join(' · ') : '—'}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
