/**
 * SemanalPanel — a grade de N semanas por obra + o bloco PLANEJADO × REALIZADO.
 *
 * Todas as linhas vêm calculadas de fcp_semanas(). O engenheiro só digita a
 * PRODUÇÃO REALIZADA; semana em branco usa o planejado (regra da planilha), e
 * apagar o valor devolve a semana ao planejado.
 */
import { useEffect, useState } from 'react'
import type { UseFcpReturn, FcpSemana } from '@/hooks/useFcp'
import { cardCls, thCls, trCls, vazioCls, brl, num1, pct, dataBr, corValor } from './ui'

/** Célula onde o engenheiro lança o realizado da semana. */
function CelulaRealizado({
  obraId, semana, valor, travado, onSalvar,
}: {
  obraId: string; semana: number; valor: number | null; travado: boolean
  onSalvar: (obraId: string, semana: number, v: number | null) => Promise<boolean>
}) {
  const [texto, setTexto] = useState(valor === null ? '' : String(valor))
  const [salvando, setSalvando] = useState(false)
  useEffect(() => setTexto(valor === null ? '' : String(valor)), [valor])

  const confirmar = async () => {
    const limpo = texto.trim().replace(',', '.')
    const novo = limpo === '' ? null : Number(limpo)
    if (novo !== null && !Number.isFinite(novo)) { setTexto(valor === null ? '' : String(valor)); return }
    if (novo === valor) return
    setSalvando(true)
    await onSalvar(obraId, semana, novo)
    setSalvando(false)
  }

  return (
    <input
      value={texto}
      disabled={travado || salvando}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      placeholder="—"
      title="Deixe vazio para usar o planejado"
      className="w-20 bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-xs text-right
                 font-mono text-[#f5f5f5] focus:outline-none focus:border-[#f97316]
                 disabled:opacity-50 placeholder:text-[#6b6b6b]"
    />
  )
}

function LinhaGrade({
  rotulo, valores, formato = 'moeda', destaque, negativoVermelho,
}: {
  rotulo: string; valores: number[]; formato?: 'moeda' | 'num'
  destaque?: boolean; negativoVermelho?: boolean
}) {
  const fmt = formato === 'moeda' ? brl : num1
  return (
    <tr className={`${trCls} ${destaque ? 'bg-[#484848]/30' : ''}`}>
      <td className={`px-4 py-1.5 whitespace-nowrap sticky left-0 z-10 ${destaque ? 'bg-[#3f3f3f]' : 'bg-[#3d3d3d]'}
                      ${destaque ? 'text-[#f5f5f5] font-semibold' : 'text-[#a3a3a3]'} text-xs`}>
        {rotulo}
      </td>
      {valores.map((v, i) => (
        <td key={i} className={`px-3 py-1.5 text-right font-mono text-xs whitespace-nowrap
                                ${negativoVermelho ? corValor(v) : destaque ? 'text-[#f5f5f5]' : 'text-[#a3a3a3]'}`}>
          {fmt(v)}
        </td>
      ))}
    </tr>
  )
}

export function SemanalPanel({ fcp }: { fcp: UseFcpReturn }) {
  const { obras, semanas, travado, lancarRealizado, horizonteSemanas, setHorizonteSemanas, capital } = fcp

  if (obras.length === 0) return <div className={vazioCls}>Nenhuma obra cadastrada neste FCP.</div>
  if (semanas.length === 0) {
    return <div className={vazioCls}>Sem grade calculada — confira as premissas e o ticket de cada obra.</div>
  }

  const porObra = (id: string) => semanas.filter((s) => s.obra_id === id).sort((a, b) => a.n_semana - b.n_semana)
  const nSem = Math.max(...semanas.map((s) => s.n_semana))
  const idx = Array.from({ length: nSem }, (_, i) => i + 1)

  // GLOBAL = soma das obras, semana a semana (o acumulado é recalculado aqui
  // porque somar os acumulados de cada obra daria o mesmo, mas em ordem errada
  // se alguma obra tiver menos semanas)
  const global = idx.map((n) => {
    const linha = semanas.filter((s) => s.n_semana === n)
    return {
      recebimento: linha.reduce((a, s) => a + s.recebimento, 0),
      despesas: linha.reduce((a, s) => a + s.despesas, 0),
      saldo: linha.reduce((a, s) => a + s.saldo_periodo, 0),
    }
  })
  let acum = 0
  const globalAcum = global.map((g) => (acum += g.saldo))
  const pior = Math.min(...globalAcum)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#a3a3a3]">Horizonte</span>
          <select value={horizonteSemanas} onChange={(e) => setHorizonteSemanas(Number(e.target.value))}
            className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]">
            {[8, 12, 16, 24].map((n) => <option key={n} value={n}>{n} semanas</option>)}
          </select>
        </div>
        <div className="flex gap-3 overflow-x-auto">
          <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-2 min-w-[150px]">
            <div className="text-[10px] text-[#a3a3a3] uppercase tracking-wide">Pior ponto do caixa</div>
            <div className={`font-mono text-base font-semibold ${corValor(pior)}`}>{brl(pior)}</div>
          </div>
          <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-2 min-w-[150px]">
            <div className="text-[10px] text-[#a3a3a3] uppercase tracking-wide">Capital recomendado</div>
            <div className="font-mono text-base font-semibold text-[#f97316]">
              {capital ? brl(capital.capital_recomendado) : '—'}
            </div>
            {capital && (
              <div className="text-[10px] text-[#6b6b6b]">
                necessidade + {pct(capital.contingencia, 0)} de contingência
              </div>
            )}
          </div>
        </div>
      </div>

      {obras.map((obra) => {
        const linhas = porObra(obra.id)
        if (linhas.length === 0) return null
        const g = (f: (s: FcpSemana) => number) => linhas.map(f)
        return (
          <div key={obra.id} className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-[#525252]">
              <h3 className="text-sm font-bold text-[#f5f5f5] uppercase tracking-wide">{obra.nome}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={trCls}>
                    <th className={`${thCls} sticky left-0 bg-[#3d3d3d] z-10`}>Semana</th>
                    {linhas.map((s) => (
                      <th key={s.n_semana} className={`${thCls} text-right`}>
                        <div>S{s.n_semana}</div>
                        <div className="font-normal text-[10px] text-[#6b6b6b]">{dataBr(s.data_ini)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <LinhaGrade rotulo="Produção prevista (un)" valores={g((s) => s.producao_prevista)} formato="num" />
                  <LinhaGrade rotulo="Medição do período" valores={g((s) => s.medicao)} />
                  <LinhaGrade rotulo="(A) Recebimento bruto" valores={g((s) => s.recebimento)} destaque />
                  <LinhaGrade rotulo="(–) Imposto da nota" valores={g((s) => s.imposto)} />
                  <LinhaGrade rotulo="(–) Desconto do consórcio" valores={g((s) => s.desconto_consorcio)} />
                  <LinhaGrade rotulo="(–) Custos pagos pela WCR" valores={g((s) => s.custo_wcr)} />
                  <LinhaGrade rotulo="(–) Mobilização" valores={g((s) => s.mobilizacao)} />
                  <LinhaGrade rotulo="(B) Total de despesas" valores={g((s) => s.despesas)} destaque />
                  <LinhaGrade rotulo="Saldo do período (A–B)" valores={g((s) => s.saldo_periodo)} negativoVermelho />
                  <LinhaGrade rotulo="Saldo acumulado" valores={g((s) => s.saldo_acumulado)} destaque negativoVermelho />

                  <tr className={trCls}>
                    <td colSpan={linhas.length + 1} className="px-4 pt-4 pb-1 sticky left-0 bg-[#3d3d3d]">
                      <span className="text-[11px] font-bold text-[#f97316] uppercase tracking-wider">
                        Planejado × Realizado
                      </span>
                      <span className="ml-2 text-[10px] text-[#6b6b6b]">
                        lance a produção da semana — em branco usa o planejado
                      </span>
                    </td>
                  </tr>
                  <tr className={trCls}>
                    <td className="px-4 py-1.5 text-xs text-[#a3a3a3] sticky left-0 bg-[#3d3d3d] whitespace-nowrap">
                      Produção REALIZADA (un)
                    </td>
                    {linhas.map((s) => (
                      <td key={s.n_semana} className="px-3 py-1.5 text-right">
                        <CelulaRealizado obraId={obra.id} semana={s.n_semana}
                          valor={s.producao_realizada} travado={travado} onSalvar={lancarRealizado} />
                      </td>
                    ))}
                  </tr>
                  <tr className={trCls}>
                    <td className="px-4 py-1.5 text-xs text-[#a3a3a3] sticky left-0 bg-[#3d3d3d] whitespace-nowrap">
                      % do planejado
                    </td>
                    {linhas.map((s) => (
                      <td key={s.n_semana} className="px-3 py-1.5 text-right font-mono text-xs">
                        {s.pct_planejado === null
                          ? <span className="text-[#6b6b6b]">—</span>
                          : <span className={s.pct_planejado >= 1 ? 'text-green-400'
                                            : s.pct_planejado >= 0.8 ? 'text-amber-300' : 'text-red-400'}>
                              {pct(s.pct_planejado)}
                            </span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* consolidado das obras */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-[#525252]">
          <h3 className="text-sm font-bold text-[#f5f5f5] uppercase tracking-wide">Global — todas as obras</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={trCls}>
                <th className={`${thCls} sticky left-0 bg-[#3d3d3d] z-10`}>Semana</th>
                {idx.map((n) => <th key={n} className={`${thCls} text-right`}>S{n}</th>)}
              </tr>
            </thead>
            <tbody>
              <LinhaGrade rotulo="(A) Recebimento bruto" valores={global.map((x) => x.recebimento)} destaque />
              <LinhaGrade rotulo="(B) Total de despesas" valores={global.map((x) => x.despesas)} destaque />
              <LinhaGrade rotulo="Saldo do período" valores={global.map((x) => x.saldo)} negativoVermelho />
              <LinhaGrade rotulo="Saldo acumulado" valores={globalAcum} destaque negativoVermelho />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
