/**
 * PlanoPpcPanel — aba 17. O compromisso da semana grava em lps_tasks (aparece no quadro
 * do Last Planner) + op_plano_item (serviço, semana, conclusão). PPC e Pareto calculados.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Target } from 'lucide-react'
import type { ContextoCalculo } from '../dominio/calculos'
import { paretoCausas, ppcSemana } from '../dominio/calculos'
import { TELAS } from '../dominio/telas'
import { dataBR } from '../dominio/datas'
import { TelaCrud } from './TelaCrud'
import { excluirPlanoItem, salvarPlanoItem } from './gravacoesCompostas'
import { btnNeutro, cardCls, corSituacao, pct, tdCls, thCls, trCls } from './ui'

export function PlanoPpcPanel({ ctx, projetoId, orgId, recarregar }: {
  ctx: ContextoCalculo; projetoId: string; orgId: string | null; recarregar: () => Promise<void>
}) {
  const semanas = useMemo(() => [...new Set(ctx.idx.plano.map((p) => p.semana))].sort().reverse().map((s) => ppcSemana(ctx.dados.plano, s)), [ctx])
  const pareto = useMemo(() => paretoCausas(ctx.dados.plano), [ctx])
  const codigo = (id: unknown) => ctx.dados.servicos.find((s) => s.id === id)?.codigo ?? null

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-4 flex flex-wrap items-center gap-3`}>
        <Target size={16} className="text-[#f97316]" />
        <p className="text-sm text-[#f5f5f5] flex-1">Os compromissos entram no <b>LPS / Lean</b> — o PPC oficial e o fechamento da semana ficam lá.</p>
        <Link to="/app/lps-lean?tab=ppc" className={btnNeutro}><ExternalLink size={13} /> Abrir PPC no LPS</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardCls} overflow-x-auto`}>
          <div className="px-4 py-3 text-sm font-medium text-[#f5f5f5]">PPC por semana</div>
          {semanas.length === 0 ? <p className="px-4 pb-4 text-xs text-[#6b6b6b]">nenhum compromisso lançado</p> : (
            <table className="w-full"><thead><tr className={trCls}>
              {['Semana', 'Programado', 'Concluído', 'PPC'].map((h) => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead><tbody>{semanas.map((s) => (
              <tr key={s.semana} className={trCls}>
                <td className={tdCls}>{dataBR(s.semana)}</td><td className={`${tdCls} text-right`}>{s.programado}</td>
                <td className={`${tdCls} text-right`}>{s.concluido}</td>
                <td className={`${tdCls} text-right ${corSituacao(s.ppc === null ? '' : s.ppc >= 0.85 ? 'BOA' : s.ppc >= 0.7 ? 'ATENÇÃO' : 'BAIXO')}`}>{pct(s.ppc)}</td>
              </tr>
            ))}</tbody></table>
          )}
        </div>
        <div className={`${cardCls} overflow-x-auto`}>
          <div className="px-4 py-3 text-sm font-medium text-[#f5f5f5]">Causas de não cumprimento — Pareto</div>
          {pareto.length === 0 ? <p className="px-4 pb-4 text-xs text-[#6b6b6b]">nenhuma causa lançada</p> : (
            <table className="w-full"><tbody>{pareto.map((c) => (
              <tr key={c.causa} className={trCls}><td className={tdCls}>{c.causa}</td><td className={`${tdCls} text-right`}>{c.n}</td><td className={`${tdCls} text-right`}>{pct(c.pct)}</td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>

      <TelaCrud
        tela={TELAS.plano} ctx={ctx} projetoId={projetoId} recarregar={recarregar}
        gravar={{
          salvar: (v, existente) => salvarPlanoItem(projetoId, orgId, codigo(v.op_servico_id), v, existente?.id ?? null),
          excluir: (l) => excluirPlanoItem(l.id),
        }}
      />
    </div>
  )
}
