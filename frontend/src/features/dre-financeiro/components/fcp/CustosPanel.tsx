/**
 * CustosPanel — quadro nominal da equipe + custos gerais, por obra.
 * Os totais NÃO são somados aqui: vêm de fcp_custo_obra() no banco, a mesma
 * função que o fluxo usa. Somar de novo no front criaria uma segunda verdade.
 */
import { Link2, Link2Off } from 'lucide-react'
import type { UseFcpReturn } from '@/hooks/useFcp'
import { cardCls, thCls, trCls, vazioCls, brl } from './ui'

const ROTULO_CATEGORIA: Record<string, string> = {
  folha: 'Folha', engenheiro: 'Engenheiro', estrutura: 'Estrutura', indiretos: 'Indiretos',
}
const COR_CATEGORIA: Record<string, string> = {
  folha: 'bg-blue-500/15 text-blue-300',
  engenheiro: 'bg-purple-500/15 text-purple-300',
  estrutura: 'bg-cyan-500/15 text-cyan-300',
  indiretos: 'bg-amber-500/15 text-amber-300',
}

export function CustosPanel({ fcp }: { fcp: UseFcpReturn }) {
  const { obras, pessoas, gerais, custoPorObra, premissas } = fcp

  if (obras.length === 0) return <div className={vazioCls}>Nenhuma obra cadastrada neste FCP.</div>

  return (
    <div className="space-y-6">
      {obras.map((obra) => {
        const pes = pessoas.filter((p) => p.fcp_obra_id === obra.id)
        const ger = gerais.filter((g) => g.fcp_obra_id === obra.id)
        const c = custoPorObra[obra.id]
        const ligadas = pes.filter((p) => p.pessoa_id).length

        return (
          <div key={obra.id} className={`${cardCls} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#525252] flex-wrap">
              <h3 className="text-sm font-bold text-[#f5f5f5] uppercase tracking-wide">{obra.nome}</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-[#a3a3a3]">Custo mensal</span>
                <span className="font-mono text-base font-semibold text-[#f97316]">
                  {c ? brl(c.total) : '—'}
                </span>
              </div>
            </div>

            {c && (
              <div className="flex gap-3 overflow-x-auto px-5 py-3 border-b border-[#525252]/50">
                {([['Folha', c.folha, 'paga_folha'], ['Engenheiro', c.engenheiro, 'paga_engenheiro'],
                   ['Estrutura', c.estrutura, 'paga_estrutura'], ['Indiretos', c.indiretos, 'paga_indiretos'],
                  ] as const).map(([rotulo, valor, campo]) => {
                  const quem = premissas?.[campo]
                  return (
                    <div key={rotulo} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-4 py-2 min-w-[140px]">
                      <div className="text-[10px] text-[#a3a3a3] uppercase tracking-wide">{rotulo}</div>
                      <div className="font-mono text-sm text-[#f5f5f5]">{brl(valor)}</div>
                      {quem && (
                        <div className={`text-[10px] mt-0.5 ${quem === 'WCR' ? 'text-amber-300' : 'text-[#6b6b6b]'}`}>
                          paga: {quem}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* quadro nominal */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h4 className="text-xs font-bold text-[#a3a3a3] uppercase tracking-wider">
                  Equipe — quadro nominal ({pes.length} {pes.length === 1 ? 'pessoa' : 'pessoas'})
                </h4>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6b6b6b]">
                  {ligadas > 0
                    ? <><Link2 size={12} className="text-green-400" />{ligadas} de {pes.length} ligadas ao cadastro de Recursos Humanos</>
                    : <><Link2Off size={12} />nenhuma ligada ao cadastro — equipe ainda não cadastrada em Recursos Humanos</>}
                </span>
              </div>
              {pes.length === 0 ? (
                <div className={vazioCls}>Nenhuma pessoa lançada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={trCls}>
                        <th className={thCls}>Eq.</th><th className={thCls}>Nome</th><th className={thCls}>Cargo</th>
                        <th className={`${thCls} text-right`}>Salário</th>
                        <th className={`${thCls} text-right`}>Encargos</th>
                        <th className={`${thCls} text-right`}>Benefícios</th>
                        <th className={`${thCls} text-right`}>Total / mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pes.map((p) => (
                        <tr key={p.id} className={`${trCls} hover:bg-[#484848]/40`}>
                          <td className="px-4 py-1.5 text-[#a3a3a3] text-xs">{p.equipe ?? '—'}</td>
                          <td className="px-4 py-1.5 text-[#f5f5f5]">
                            {p.nome}
                            {p.pessoa_id && <Link2 size={11} className="inline ml-1.5 text-green-400" />}
                          </td>
                          <td className="px-4 py-1.5 text-[#a3a3a3] text-xs">{p.cargo ?? '—'}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs text-[#a3a3a3]">{brl(p.salario)}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs text-[#a3a3a3]">{brl(p.encargos)}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs text-[#a3a3a3]">{brl(p.beneficios)}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-[#f5f5f5]">
                            {brl(p.salario + p.encargos + p.beneficios)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* custos gerais */}
            <div className="px-5 pb-5">
              <h4 className="text-xs font-bold text-[#a3a3a3] uppercase tracking-wider mb-2">
                Custos gerais da obra (R$/mês)
              </h4>
              {ger.length === 0 ? (
                <div className={vazioCls}>Nenhum custo geral lançado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={trCls}>
                        <th className={thCls}>Item</th><th className={thCls}>Categoria</th>
                        <th className={`${thCls} text-right`}>Qtd</th>
                        <th className={`${thCls} text-right`}>Valor unit.</th>
                        <th className={`${thCls} text-right`}>Total / mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ger.map((g) => (
                        <tr key={g.id} className={`${trCls} hover:bg-[#484848]/40`}>
                          <td className="px-4 py-1.5 text-[#f5f5f5]">{g.item}</td>
                          <td className="px-4 py-1.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${COR_CATEGORIA[g.categoria]}`}>
                              {ROTULO_CATEGORIA[g.categoria]}
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs text-[#a3a3a3]">{g.quantidade}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs text-[#a3a3a3]">{brl(g.valor_unitario)}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-[#f5f5f5]">
                            {brl(g.quantidade * g.valor_unitario)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
