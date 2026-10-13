/**
 * RdoWcrNoFcp — o que os RDOs WCR finalizados dizem sobre a produção da semana, ao lado do plano.
 *
 * ⚠️ NADA É GRAVADO SOZINHO. O capital recomendado é o número que decide quanto dinheiro a obra
 * precisa; se ele mudasse a cada RDO salvo no campo, mudaria entre uma reunião e outra sem ninguém
 * saber por quê. A conta é da ponte pura (features/rdo/utils/wcrParaFcp.ts); a gravação só
 * acontece no clique em "Adotar", pelo mesmo lancarRealizado da grade.
 *
 * Só entram serviços em UNIDADE (ligações etc.): o FCP multiplica a produção pelo ticket por
 * serviço, e somar metro de rede nessa conta inflaria o faturamento projetado. Os metros aparecem
 * à parte.
 */
import { useEffect, useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import type { UseFcpReturn } from '@/hooks/useFcp'
import { useRdoStore } from '@/store/rdoStore'
import { useProjectContext } from '@/store/projectContext'
import { divergenciasDoPlano, vinculosDoFcp } from '@/features/rdo/utils/wcrParaFcp'
import type { PlanoFcp } from '../../utils/fcp/reimportarPlano'
import type { Semana } from '../../utils/fcp/tipos'
import { cardCls, thCls, trCls, num1, dataBr } from './ui'

export function RdoWcrNoFcp({ fcp }: { fcp: UseFcpReturn }) {
  const rdos = useRdoStore((s) => s.rdos)
  const carregarRdos = useRdoStore((s) => s.loadFromSupabase)
  const { activeProjectId } = useProjectContext()
  const [adotando, setAdotando] = useState<string | null>(null)

  // Na tela do DRE o módulo RDO pode não ter carregado nada ainda.
  useEffect(() => {
    if (activeProjectId && rdos.length === 0) void carregarRdos(activeProjectId)
  }, [activeProjectId, rdos.length, carregarRdos])

  const divergencias = useMemo(() => {
    if (!fcp.premissasMotor || fcp.obras.length === 0) return []
    const semanas: Semana[] = [...new Map(fcp.semanas.map((s) => [s.n_semana, {
      numero: s.n_semana, inicio: s.data_ini, fim: s.data_fim,
    }])).values()]
    const realizado: PlanoFcp['realizado'] = {}
    for (const r of fcp.realizados) (realizado[r.fcp_obra_id] ??= {})[r.n_semana] = r.producao
    const plano: PlanoFcp = {
      id: fcp.fcpId ?? '', nome: fcp.fcp?.nome ?? '', status: fcp.fcp?.status ?? 'rascunho',
      premissas: fcp.premissasMotor, realizado, criadoEm: '',
    }
    const previsto = (obraId: string, semana: number) =>
      fcp.semanas.find((s) => s.obra_id === obraId && s.n_semana === semana)?.producao_prevista ?? 0
    return divergenciasDoPlano(plano, rdos, vinculosDoFcp(fcp.obras), semanas, previsto)
  }, [fcp.premissasMotor, fcp.obras, fcp.semanas, fcp.realizados, fcp.fcpId, fcp.fcp, rdos])

  if (divergencias.length === 0) return null
  const nomeDa = (id: string) => fcp.obras.find((o) => o.id === id)?.nome ?? id
  const inicioDa = (n: number) => fcp.semanas.find((s) => s.n_semana === n)?.data_ini ?? ''

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <div className="px-5 py-3 border-b border-[#525252]">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#f5f5f5] uppercase tracking-wide">
          <ClipboardList size={14} className="text-[#f97316]" /> RDOs WCR × plano
        </h3>
        <p className="text-[11px] text-[#6b6b6b] mt-0.5">
          Só RDOs finalizados. Nada muda no FCP sem você clicar em Adotar. Metros de rede aparecem à parte e não entram na conta.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className={trCls}>
            <th className={thCls}>Obra</th>
            <th className={thCls}>Semana</th>
            <th className={`${thCls} text-right`}>No plano</th>
            <th className={`${thCls} text-right`}>RDOs somam</th>
            <th className={`${thCls} text-right`}>Diferença</th>
            <th className={`${thCls} text-right`}>Metros de rede</th>
            <th className={thCls}></th>
          </tr></thead>
          <tbody>
            {divergencias.map((d) => {
              const chave = `${d.cidadeId}-${d.semana}`
              const igual = d.noPlano !== undefined && Math.abs(d.noPlano - d.dosRdos) < 1e-9
              return (
                <tr key={chave} className={trCls}>
                  <td className="px-4 py-2 text-[#f5f5f5]">{nomeDa(d.cidadeId)}</td>
                  <td className="px-4 py-2 text-xs text-[#a3a3a3]">S{d.semana} · {dataBr(inicioDa(d.semana))}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">
                    {d.noPlano === undefined ? <span title="semana usa o previsto">previsto</span> : num1(d.noPlano)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-[#f5f5f5]">
                    {num1(d.dosRdos)} <span className="text-[#6b6b6b]">({d.rdos} RDO{d.rdos > 1 ? 's' : ''}{d.semMedida > 0 ? ` · ${d.semMedida} sem medida` : ''})</span>
                  </td>
                  <td className={`px-4 py-2 text-right font-mono text-xs ${d.diferenca < 0 ? 'text-red-300' : 'text-green-300'}`}>{num1(d.diferenca)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{d.metros > 0 ? `${num1(d.metros)} m` : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {igual ? <span className="text-[11px] text-[#6b6b6b]">já adotado</span> : (
                      <button
                        disabled={fcp.travado || adotando === chave}
                        onClick={async () => {
                          setAdotando(chave)
                          await fcp.lancarRealizado(d.cidadeId, d.semana, d.dosRdos)
                          setAdotando(null)
                        }}
                        className="rounded-md bg-[#484848] px-2.5 py-1 text-[11px] font-semibold text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-40">
                        {adotando === chave ? 'Adotando…' : 'Adotar'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
