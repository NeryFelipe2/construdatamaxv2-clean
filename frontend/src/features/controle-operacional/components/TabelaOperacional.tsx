/**
 * TabelaOperacional — a lista genérica de uma tela, montada só a partir de telas.ts.
 * Cabeçalho AZUL = coluna que se digita; cinza com ƒ = calculada (a regra do Excel).
 */
import { useMemo, type ReactNode } from 'react'
import { Pencil, Trash2, FileWarning } from 'lucide-react'
import type { ContextoCalculo } from '../dominio/calculos'
import { calcDaTela, exibirCampo, formatarCalc, type LinhaTela, type Tela } from '../dominio/telas'
import { btnMini, corSituacao, tdCls, thCls, trCls, vazioCls } from './ui'

export interface TabelaOperacionalProps {
  tela: Tela
  linhas: LinhaTela[]
  ctx: ContextoCalculo
  onEditar?: (l: LinhaTela) => void
  onExcluir?: (l: LinhaTela) => void
  acoes?: (l: LinhaTela, calc: Record<string, unknown>) => ReactNode
  limite?: number
}

const COLUNAS_SITUACAO = new Set(['status', 'situacao_prazo', 'situacao', 'aderencia', 'leitura'])

export function TabelaOperacional({ tela, linhas, ctx, onEditar, onExcluir, acoes, limite = 300 }: TabelaOperacionalProps) {
  const campos = tela.campos.filter((c) => !c.soFormulario)
  const codigo = useMemo(() => {
    const m = new Map(ctx.dados.servicos.map((s) => [s.id, s.codigo]))
    return (id: string) => m.get(id) ?? null
  }, [ctx.dados.servicos])
  const visiveis = useMemo(() => linhas.slice(0, limite), [linhas, limite])
  const calcs = useMemo(() => visiveis.map((l) => calcDaTela(tela.id, l, ctx)), [visiveis, tela.id, ctx])

  if (linhas.length === 0) return <div className={vazioCls}>Nada lançado ainda.</div>

  return (
    <div className="border border-[#525252] rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[62vh] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#3d3d3d] z-10">
            <tr className={trCls}>
              {campos.map((c) => (
                <th key={c.campo} className={`${thCls} !text-sky-300`} title="coluna digitada">{c.rotulo}</th>
              ))}
              {tela.calculadas.map((c) => (
                <th key={c.campo} className={`${thCls} bg-[#333333]`} title="calculada — não se digita">ƒ {c.rotulo}</th>
              ))}
              {(onEditar || onExcluir || acoes) && <th className={thCls}></th>}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l, i) => {
              const calc = calcs[i]
              return (
                <tr key={l.id} className={`${trCls} hover:bg-[#333333]`}>
                  {campos.map((c, j) => (
                    <td key={c.campo} className={`${tdCls} max-w-[260px] truncate`} title={String(l[c.campo] ?? '')}>
                      {j === 0 && l.ausente_na_planilha_em ? (
                        <span className="inline-flex items-center gap-1 mr-1 text-amber-300" title={`não veio na última planilha (apontado em ${String(l.ausente_na_planilha_em).slice(0, 10)}) — nada foi apagado`}>
                          <FileWarning size={12} />
                        </span>
                      ) : null}
                      {exibirCampo(l[c.campo], c.tipo, { servicoCodigo: codigo })}
                    </td>
                  ))}
                  {tela.calculadas.map((c) => (
                    <td key={c.campo} className={`${tdCls} bg-[#333333]/40 ${COLUNAS_SITUACAO.has(c.campo) ? corSituacao(calc[c.campo]) : ''} ${c.formato === 'brl' || c.formato === 'num' || c.formato === 'int' || c.formato === 'pct' ? 'text-right font-mono text-xs' : ''}`}>
                      {formatarCalc(calc[c.campo], c.formato)}
                    </td>
                  ))}
                  {(onEditar || onExcluir || acoes) && (
                    <td className={`${tdCls} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        {acoes?.(l, calc)}
                        {onEditar && <button className={btnMini} onClick={() => onEditar(l)} title="editar"><Pencil size={12} /></button>}
                        {onExcluir && <button className={btnMini} onClick={() => onExcluir(l)} title="excluir (fica no histórico; não volta pela planilha)"><Trash2 size={12} /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {linhas.length > limite && (
        <div className="px-3 py-2 text-xs text-[#a3a3a3] border-t border-[#525252]">
          mostrando {limite} de {linhas.length} — use a busca para achar o resto
        </div>
      )}
    </div>
  )
}
