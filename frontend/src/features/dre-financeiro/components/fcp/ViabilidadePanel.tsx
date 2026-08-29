/**
 * ViabilidadePanel — produção necessária por cenário (vem de fcp_viabilidade()).
 * SERVIÇOS/DIA é o número que o engenheiro leva para a obra; obra com mix
 * água/esgoto mostra os dois separados, porque a equipe é diferente.
 */
import type { UseFcpReturn } from '@/hooks/useFcp'
import { cardCls, thCls, trCls, vazioCls, brl, num1, num2, pct } from './ui'

export function ViabilidadePanel({ fcp }: { fcp: UseFcpReturn }) {
  const { viabilidade, premissas, obras } = fcp
  if (viabilidade.length === 0) {
    return <div className={vazioCls}>Sem viabilidade calculada — confira o ticket e os custos de cada obra.</div>
  }
  const nomes = [...new Set(viabilidade.map((v) => v.obra))]

  return (
    <div className="space-y-5">
      <p className="text-xs text-[#6b6b6b] leading-relaxed max-w-3xl">
        MÍNIMA é o empate real: cobre o custo e o imposto da nota, sem sobrar nada.
        O cenário em vigor no fluxo é{' '}
        <span className="font-semibold text-[#f97316]">{premissas?.cenario ?? '—'}</span>.
      </p>

      {nomes.map((nome) => {
        const linhas = viabilidade.filter((v) => v.obra === nome).sort((a, b) => a.margem - b.margem)
        const obra = obras.find((o) => o.nome === nome)
        const temMix = obra?.pct_esgoto !== null && obra?.pct_esgoto !== undefined
        return (
          <div key={nome} className={`${cardCls} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#525252] flex-wrap">
              <h3 className="text-sm font-bold text-[#f5f5f5] uppercase tracking-wide">{nome}</h3>
              {temMix && obra && (
                <span className="text-[11px] text-[#a3a3a3]">
                  mix: {pct(1 - (obra.pct_esgoto ?? 0), 0)} água · {pct(obra.pct_esgoto ?? 0, 0)} esgoto
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={trCls}>
                    <th className={thCls}>Cenário</th>
                    <th className={`${thCls} text-right`}>Margem</th>
                    <th className={`${thCls} text-right`}>Receita líquida/mês</th>
                    <th className={`${thCls} text-right`}>Medição bruta/mês</th>
                    <th className={`${thCls} text-right`}>Serviços/mês</th>
                    <th className={`${thCls} text-right`}>Serviços/semana</th>
                    <th className={`${thCls} text-right`}>SERVIÇOS/DIA</th>
                    {temMix && <><th className={`${thCls} text-right`}>Água/dia</th>
                                 <th className={`${thCls} text-right`}>Esgoto/dia</th></>}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((v) => {
                    const emVigor = v.cenario === premissas?.cenario
                    return (
                      <tr key={v.cenario} className={`${trCls} ${emVigor ? 'bg-[#f97316]/10' : 'hover:bg-[#484848]/40'}`}>
                        <td className="px-4 py-2">
                          <span className={emVigor ? 'text-[#f97316] font-semibold' : 'text-[#f5f5f5]'}>
                            {v.cenario}
                          </span>
                          {emVigor && <span className="ml-2 text-[10px] text-[#f97316]">em vigor</span>}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{pct(v.margem, 0)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{brl(v.receita_liquida_mes)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{brl(v.medicao_bruta_mes)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{num1(v.servicos_mes)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{num1(v.servicos_semana)}</td>
                        <td className="px-4 py-2 text-right font-mono text-base font-semibold text-[#f5f5f5]">
                          {num2(v.servicos_dia)}
                        </td>
                        {temMix && <>
                          <td className="px-4 py-2 text-right font-mono text-xs text-cyan-300">{num2(v.agua_dia)}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs text-amber-300">{num2(v.esgoto_dia)}</td>
                        </>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <p className={`${vazioCls} text-left px-1`}>
        Produção em unidades não soma entre obras — os tickets são diferentes. Para comparar, use R$.
      </p>
    </div>
  )
}
