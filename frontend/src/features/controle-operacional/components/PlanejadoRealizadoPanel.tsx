/**
 * PlanejadoRealizadoPanel — aba 18: semana a semana e mês a mês, tudo calculado.
 */
import { useMemo } from 'react'
import type { ContextoCalculo } from '../dominio/calculos'
import { planejadoRealizadoMes, planejadoRealizadoSemana, semanasComDados } from '../dominio/calculos'
import { dataBR, inicioDoMes } from '../dominio/datas'
import { brl, cardCls, corSituacao, num, pct, tdCls, thCls, trCls, vazioCls } from './ui'

export function PlanejadoRealizadoPanel({ ctx }: { ctx: ContextoCalculo }) {
  const semanas = useMemo(() => semanasComDados(ctx.dados).map((s) => planejadoRealizadoSemana(s, ctx)), [ctx])
  const meses = useMemo(() => [...new Set(semanas.map((s) => inicioDoMes(s.semana)))].sort().map((m) => planejadoRealizadoMes(m, ctx)), [semanas, ctx])

  if (semanas.length === 0) return <div className={vazioCls}>Sem programação nem apontamento lançados — nada para comparar ainda.</div>

  return (
    <div className="space-y-4">
      <div className={`${cardCls} overflow-x-auto`}>
        <div className="px-4 py-3 text-sm font-medium text-[#f5f5f5]">Semana a semana</div>
        <table className="w-full">
          <thead><tr className={trCls}>
            {['Semana (2ª)', 'Programados', 'Executados', 'Aderência', 'PPC', 'HH previsto', 'HH apontado', 'Desvio HH', 'R$ medido', 'Meta da semana', 'Atingimento', 'Leitura']
              .map((h) => <th key={h} className={thCls}>{h}</th>)}
          </tr></thead>
          <tbody>{[...semanas].reverse().map((s) => (
            <tr key={s.semana} className={trCls}>
              <td className={tdCls}>{dataBR(s.semana)}</td>
              <td className={`${tdCls} text-right`}>{s.programados}</td>
              <td className={`${tdCls} text-right`}>{s.executados}</td>
              <td className={`${tdCls} text-right`}>{pct(s.aderencia)}</td>
              <td className={`${tdCls} text-right`}>{pct(s.ppc)}</td>
              <td className={`${tdCls} text-right`}>{num(s.hh_previsto, 0)}</td>
              <td className={`${tdCls} text-right`}>{num(s.hh_apontado, 0)}</td>
              <td className={`${tdCls} text-right`}>{pct(s.desvio_hh)}</td>
              <td className={`${tdCls} text-right font-mono text-xs`}>{brl(s.rs_medido)}</td>
              <td className={`${tdCls} text-right font-mono text-xs`}>{brl(s.meta_semana)}</td>
              <td className={`${tdCls} text-right`}>{pct(s.atingimento)}</td>
              <td className={`${tdCls} ${corSituacao(s.leitura)}`}>{s.leitura}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className={`${cardCls} overflow-x-auto`}>
        <div className="px-4 py-3 text-sm font-medium text-[#f5f5f5]">Fechamento mensal</div>
        <table className="w-full">
          <thead><tr className={trCls}>
            {['Mês', 'Programados', 'Executados', 'Aderência', 'HH apontado', 'R$ medido', 'Meta do mês', 'Atingimento', 'Resultado estimado']
              .map((h) => <th key={h} className={thCls}>{h}</th>)}
          </tr></thead>
          <tbody>{[...meses].reverse().map((m) => (
            <tr key={m.mes} className={trCls}>
              <td className={tdCls}>{m.mes.slice(0, 7)}</td>
              <td className={`${tdCls} text-right`}>{m.programados}</td>
              <td className={`${tdCls} text-right`}>{m.executados}</td>
              <td className={`${tdCls} text-right`}>{pct(m.aderencia)}</td>
              <td className={`${tdCls} text-right`}>{num(m.hh_apontado, 0)}</td>
              <td className={`${tdCls} text-right font-mono text-xs`}>{brl(m.rs_medido)}</td>
              <td className={`${tdCls} text-right font-mono text-xs`}>{brl(m.meta_mes)}</td>
              <td className={`${tdCls} text-right`}>{pct(m.atingimento)}</td>
              <td className={`${tdCls} text-right font-mono text-xs ${m.resultado !== null && m.resultado < 0 ? 'text-red-300' : ''}`}>{brl(m.resultado)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-xs text-[#6b6b6b]">Meta da semana = meta do mês ÷ 4,33 (regra da planilha). Resultado = medido × (1 − imposto) − custo do mês.</p>
    </div>
  )
}
