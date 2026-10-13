/**
 * PainelOperacional — as abas 13 RESUMO GERENCIAL e 14 DASHBOARD, calculadas.
 * Mostra o que está bom (acertos) ao lado do que precisa de atenção, e o que falta
 * informar — número não informado aparece como "—", nunca como zero.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Settings2, History } from 'lucide-react'
import type { ContextoCalculo } from '../dominio/calculos'
import {
  alertasEquipe, osCalc, planejadoRealizadoSemana, resumoMes, semanasComDados, servicoCalc, ataCalc, STATUS_BACKLOG,
} from '../dominio/calculos'
import { TELAS } from '../dominio/telas'
import { dataBR, hojeLocal, inicioDoMes } from '../dominio/datas'
import { TelaCrud } from './TelaCrud'
import { brl, cardCls, corSituacao, inputCls, num, pct, tdCls, thCls, trCls } from './ui'

function Kpi({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className={`${cardCls} px-4 py-3 min-w-[160px]`}>
      <div className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">{rotulo}</div>
      <div className={`font-mono text-xl font-semibold ${cor ?? 'text-[#f5f5f5]'}`}>{valor}</div>
      {sub && <div className="text-xs text-[#a3a3a3] mt-0.5">{sub}</div>}
    </div>
  )
}

function Secao({ titulo, children, aberta = false }: { titulo: string; children: ReactNode; aberta?: boolean }) {
  const [a, setA] = useState(aberta)
  return (
    <div className={cardCls}>
      <button className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#f5f5f5]" onClick={() => setA(!a)}>
        {a ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {titulo}
      </button>
      {a && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

const PARAMS_ESSENCIAIS: [string, string][] = [
  ['prazo_padrao_dias', 'prazo padrão SABESP'], ['alerta_prazo_dias', 'alerta de prazo'], ['dias_uteis_mes', 'dias úteis por mês'],
  ['margem_alvo', 'margem-alvo'], ['defasagem_recebimento', 'defasagem de recebimento'], ['fator_encargos', 'fator de encargos'],
  ['beneficios_pessoa', 'benefícios por pessoa'], ['inicio_operacao', 'início da operação'], ['desconto_consorcio', 'desconto do consórcio'],
]

export function PainelOperacional({ ctx, projetoId, recarregar, folhaIndisponivel }: {
  ctx: ContextoCalculo; projetoId: string; recarregar: () => Promise<void>; folhaIndisponivel: string | null
}) {
  const [mes, setMes] = useState(() => (ctx.p?.mes_referencia ?? hojeLocal()).slice(0, 7))
  const r = useMemo(() => resumoMes(`${mes}-01`, ctx), [mes, ctx])

  const atencao = useMemo(() => {
    const servicos = ctx.idx.servicos
      .map((s) => ({ s, c: servicoCalc(s, ctx.idx, ctx.p, ctx.hoje) }))
      .filter(({ c }) => (c.situacao_prazo === 'VENCIDO' || c.situacao_prazo === 'VENCE EM BREVE') && STATUS_BACKLOG.has(c.status))
      .sort((a, b) => (a.c.data_limite ?? '').localeCompare(b.c.data_limite ?? ''))
    const atas = ctx.dados.atas.filter((a) => !a.deleted_at)
      .map((a) => ({ a, c: ataCalc(a, ctx.hoje) })).filter(({ c }) => c.dias_em_aberto !== null)
      .sort((x, y) => (x.a.prazo ?? '9999').localeCompare(y.a.prazo ?? '9999'))
    const docs = alertasEquipe(ctx.dados.membros, ctx.dados.vencimentos, ctx.hoje)
    const faltando = PARAMS_ESSENCIAIS.filter(([k]) => {
      const v = (ctx.p as unknown as Record<string, unknown> | null)?.[k]
      return v === null || v === undefined
    }).map(([, rot]) => rot)
    return { servicos, atas, docs, faltando }
  }, [ctx])

  const acertos = useMemo(() => {
    const prontas = ctx.idx.ordens.map((o) => osCalc(o, ctx.idx)).filter((c) => c.pronta_para_medir && c.status !== 'MEDIDA').length
    const semanas = semanasComDados(ctx.dados).map((s) => planejadoRealizadoSemana(s, ctx))
    return {
      prontas,
      semanasBoas: semanas.filter((s) => s.ppc !== null && s.ppc >= 0.85).length,
      semanasComPlano: semanas.filter((s) => s.ppc !== null).length,
    }
  }, [ctx])

  const temParametros = !!ctx.dados.parametros

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-[#a3a3a3]">Mês de referência</label>
        <input type="month" className={`${inputCls} !w-auto`} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
        <span className="text-xs text-[#6b6b6b]">hoje: {dataBR(ctx.hoje)}</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        <Kpi rotulo="Recebidos no mês" valor={String(r.recebidos)} sub={`${r.programados} programados`} />
        <Kpi rotulo="Executados" valor={String(r.executados)} sub={`${pct(r.pct_no_prazo)} no prazo · aderência ${pct(r.aderencia)}`} />
        <Kpi rotulo="Backlog" valor={String(r.backlog)} sub={`${r.vencidos} vencido(s)`} cor={r.vencidos > 0 ? 'text-red-300' : undefined} />
        <Kpi rotulo="R$ medido" valor={brl(r.rs_medido)} sub={`meta ${brl(r.meta_mes)} · ${pct(r.atingimento)}`} />
        <Kpi rotulo="Resultado" valor={brl(r.resultado)} sub={`margem ${pct(r.margem, 1)}`} cor={r.resultado !== null && r.resultado < 0 ? 'text-red-300' : undefined} />
        <Kpi rotulo="HH no mês" valor={num(r.hh, 0)} sub={`R$/HH ${brl(r.rs_por_hh)}`} />
        <Kpi rotulo="Ocorrências abertas" valor={String(r.ocorrencias_abertas)} sub={`${r.retrabalhos} retrabalho(s) no mês`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardCls} p-4 space-y-2`}>
          <div className="flex items-center gap-2 text-sm font-medium text-green-300"><CheckCircle2 size={15} /> O que está certo</div>
          <ul className="text-sm text-[#f5f5f5] space-y-1">
            <li>{r.executados_no_prazo} serviço(s) executado(s) dentro do prazo SABESP no mês</li>
            <li>{acertos.prontas} OS concluída(s) com fotos e pavimento — prontas para medir</li>
            <li>{acertos.semanasBoas} de {acertos.semanasComPlano} semana(s) com plano cumpriram PPC ≥ 85%</li>
            <li>{ctx.idx.servicos.length} serviço(s) no cadastro · {ctx.dados.precos.filter((p) => !p.deleted_at).length} preço(s) na tabela</li>
            {ctx.imposto !== null && <li>imposto sobre a medição: {pct(ctx.imposto, 2)} ({ctx.dados.tributos.filter((t) => !t.deleted_at).length} tributos)</li>}
            {ctx.custo.total !== null && <li>custo mensal do contrato: {brl(ctx.custo.total)} (folha {brl(ctx.custo.folha)})</li>}
          </ul>
        </div>

        <div className={`${cardCls} p-4 space-y-2`}>
          <div className="flex items-center gap-2 text-sm font-medium text-amber-200"><AlertTriangle size={15} /> Precisa de atenção</div>
          <ul className="text-sm text-[#f5f5f5] space-y-1">
            {!temParametros && <li className="text-amber-200">parâmetros do contrato não cadastrados — importe a planilha ou preencha em "Configuração do contrato"</li>}
            {atencao.faltando.length > 0 && temParametros && <li className="text-amber-200">não informado: {atencao.faltando.join(', ')}</li>}
            {folhaIndisponivel && <li className="text-amber-200">folha da equipe indisponível: {folhaIndisponivel}</li>}
            {ctx.custo.pendencias.map((p) => <li key={p} className="text-amber-200">custo: {p}</li>)}
            <li>{atencao.servicos.length} serviço(s) vencido(s) ou vencendo sem execução</li>
            <li>{atencao.atas.length} pendência(s) de ata em aberto</li>
            <li>{atencao.docs.length} documento(s) de equipe vencido(s) ou vencendo em 30 dias</li>
          </ul>
        </div>
      </div>

      {atencao.servicos.length > 0 && (
        <Secao titulo={`Serviços vencidos ou vencendo (${atencao.servicos.length})`} aberta>
          <table className="w-full"><thead><tr className={trCls}>
            <th className={thCls}>ID</th><th className={thCls}>Endereço</th><th className={thCls}>Tipo</th><th className={thCls}>Limite</th><th className={thCls}>Situação</th><th className={thCls}>Status</th>
          </tr></thead><tbody>
            {atencao.servicos.slice(0, 20).map(({ s, c }) => (
              <tr key={s.id} className={trCls}>
                <td className={tdCls}>{s.codigo}</td><td className={tdCls}>{s.endereco ?? '—'}{s.numero ? `, ${s.numero}` : ''}</td>
                <td className={tdCls}>{s.tipo ?? '—'}</td><td className={tdCls}>{dataBR(c.data_limite)}</td>
                <td className={`${tdCls} ${corSituacao(c.situacao_prazo)}`}>{c.situacao_prazo}</td><td className={tdCls}>{c.status}</td>
              </tr>
            ))}
          </tbody></table>
        </Secao>
      )}

      {atencao.docs.length > 0 && (
        <Secao titulo={`Documentos de equipe (${atencao.docs.length})`}>
          <table className="w-full"><tbody>
            {atencao.docs.slice(0, 20).map((a) => (
              <tr key={`${a.pessoa_id}-${a.documento}`} className={trCls}>
                <td className={tdCls}>{a.pessoa}</td><td className={tdCls}>{a.equipe ?? '—'}</td><td className={tdCls}>{a.documento}</td>
                <td className={tdCls}>{dataBR(a.vence)}</td>
                <td className={`${tdCls} ${a.dias < 0 ? 'text-red-300' : 'text-amber-200'}`}>{a.dias < 0 ? `vencido há ${-a.dias} dia(s)` : `vence em ${a.dias} dia(s)`}</td>
              </tr>
            ))}
          </tbody></table>
        </Secao>
      )}

      {atencao.atas.length > 0 && (
        <Secao titulo={`Pendências de atas (${atencao.atas.length})`}>
          <table className="w-full"><tbody>
            {atencao.atas.slice(0, 20).map(({ a, c }) => (
              <tr key={a.id} className={trCls}>
                <td className={tdCls}>{c.n_ata}</td><td className={`${tdCls} max-w-[360px] truncate`} title={a.pendencia ?? ''}>{a.pendencia}</td>
                <td className={tdCls}>{a.responsavel ?? '—'}</td><td className={tdCls}>{dataBR(a.prazo)}</td>
                <td className={`${tdCls} ${a.prazo && a.prazo < ctx.hoje ? 'text-red-300' : ''}`}>{c.dias_em_aberto} dia(s) em aberto</td>
              </tr>
            ))}
          </tbody></table>
        </Secao>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Secao titulo="Por que não executou (mês)">
          {r.motivos_nao_execucao.length === 0 ? <p className="text-xs text-[#6b6b6b]">nenhum motivo lançado no mês</p> : (
            <table className="w-full"><tbody>{r.motivos_nao_execucao.map((m) => (
              <tr key={m.motivo} className={trCls}><td className={tdCls}>{m.motivo}</td><td className={`${tdCls} text-right`}>{m.n}</td><td className={`${tdCls} text-right`}>{pct(m.pct)}</td></tr>
            ))}</tbody></table>
          )}
        </Secao>
        <Secao titulo="Por tipo de serviço (mês)">
          {r.por_tipo.length === 0 ? <p className="text-xs text-[#6b6b6b]">nada executado no mês</p> : (
            <table className="w-full"><tbody>{r.por_tipo.map((t) => (
              <tr key={t.tipo} className={trCls}><td className={`${tdCls} max-w-[180px] truncate`}>{t.tipo}</td><td className={`${tdCls} text-right`}>{t.executados}</td><td className={`${tdCls} text-right`}>{brl(t.valor)}</td></tr>
            ))}</tbody></table>
          )}
        </Secao>
        <Secao titulo="Por equipe (mês)">
          {r.por_equipe.length === 0 ? <p className="text-xs text-[#6b6b6b]">nenhuma equipe identificada no mês (EQUIPE em branco nos lançamentos?)</p> : (
            <table className="w-full"><tbody>{r.por_equipe.map((e) => (
              <tr key={e.equipe} className={trCls}><td className={tdCls}>{e.equipe}</td><td className={`${tdCls} text-right`}>{e.dias} dia(s)</td><td className={`${tdCls} text-right`}>{e.executados}/{e.programados}</td><td className={`${tdCls} text-right`}>{brl(e.valor)}</td></tr>
            ))}</tbody></table>
          )}
        </Secao>
      </div>

      <Secao titulo="Configuração do contrato (abas 01, 01A e 02)">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-[#a3a3a3]"><Settings2 size={13} /> Estes números alimentam metas, custo e faturamento.</div>
          <TelaCrud tela={TELAS.parametros} ctx={ctx} projetoId={projetoId} recarregar={recarregar} podeCriar={!temParametros} podeExcluir={false} />
          <TelaCrud tela={TELAS.custos} ctx={ctx} projetoId={projetoId} recarregar={recarregar} />
          <TelaCrud tela={TELAS.tributos} ctx={ctx} projetoId={projetoId} recarregar={recarregar} />
          <TelaCrud tela={TELAS.precos} ctx={ctx} projetoId={projetoId} recarregar={recarregar} />
        </div>
      </Secao>

      <Secao titulo={`Importações desta obra (${ctx.dados.importacoes.length})`}>
        {ctx.dados.importacoes.length === 0 ? <p className="text-xs text-[#6b6b6b]">nenhuma planilha importada ainda</p> : (
          <table className="w-full"><tbody>{ctx.dados.importacoes.map((i) => (
            <tr key={i.id} className={trCls}>
              <td className={tdCls}><History size={12} className="inline mr-1" />{String(i.created_at ?? '').slice(0, 16).replace('T', ' ')}</td>
              <td className={`${tdCls} max-w-[420px] truncate`} title={i.arquivo}>{i.arquivo}</td>
              <td className={`${tdCls} font-mono text-xs text-[#6b6b6b]`}>{(i.sha256 ?? '').slice(0, 12)}</td>
            </tr>
          ))}</tbody></table>
        )}
      </Secao>

      <p className="text-xs text-[#6b6b6b]">Mês exibido: {dataBR(inicioDoMes(`${mes}-01`))}. Todos os números são recalculados a partir do que foi digitado — nada calculado é gravado.</p>
    </div>
  )
}
