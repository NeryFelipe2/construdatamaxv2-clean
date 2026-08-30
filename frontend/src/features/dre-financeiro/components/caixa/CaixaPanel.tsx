/**
 * CaixaPanel — Controle de Caixa dentro de DRE & Resultado.
 *
 * Quatro abas: Lançamentos, Horas Extras, Conferência e Relatórios.
 *
 * O lançamento entra pela PLANILHA (botão Importar). O formulário da tela
 * existe só como correção pontual — é decisão de produto, não limitação: a
 * planilha é o que o pessoal de obra já preenche, e forçar a digitação na tela
 * criaria uma segunda fila de trabalho que ninguém faria.
 */
import { useMemo, useState } from 'react'
import {
  Wallet, CalendarClock, CheckSquare, BarChart3, Upload, Download, RefreshCw,
  AlertTriangle, Trash2, Check, Plus,
} from 'lucide-react'
import { useCaixa, type StatusLanc } from '@/hooks/useCaixa'
import { ImportarCaixaModal } from '../importador/ImportarCaixaModal'
import { baixarModeloCaixa } from '../importador/planilhaCaixa'
import { cardCls, inputCls, btnPrimario, btnNeutro, thCls, trCls, vazioCls, brl, dataBr, corValor } from '../fcp/ui'
import * as XLSX from 'xlsx'
import { SeloAutoria } from '@/components/shared/SeloAutoria'

type Aba = 'lancamentos' | 'he' | 'conferencia' | 'relatorios'

const ABAS: { key: Aba; label: string; icon: typeof Wallet }[] = [
  { key: 'lancamentos', label: 'Lançamentos', icon: Wallet },
  { key: 'he', label: 'Horas Extras', icon: CalendarClock },
  { key: 'conferencia', label: 'Conferência', icon: CheckSquare },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3 },
]

const COR_STATUS: Record<StatusLanc, string> = {
  pendente: 'bg-amber-500/15 text-amber-200',
  conferido: 'bg-blue-500/15 text-blue-300',
  pago: 'bg-green-500/15 text-green-300',
}

export function CaixaPanel() {
  const caixa = useCaixa()
  const [aba, setAba] = useState<Aba>('lancamentos')
  const [importar, setImportar] = useState(false)
  const [selecao, setSelecao] = useState<Set<string>>(new Set())

  const nomeCat = (id: string) => caixa.categorias.find((c) => c.id === id)?.nome ?? '—'

  // grade mensal de horas extras: pessoa nas linhas, dias nas colunas
  const gradeHe = useMemo(() => {
    const ano = Number(caixa.mes.slice(0, 4)), m = Number(caixa.mes.slice(5, 7))
    const dias = new Date(ano, m, 0).getDate()
    const pessoas = new Map<string, { nome: string; cargo: string | null; porDia: Record<number, typeof caixa.horasExtras[0]> }>()
    for (const h of caixa.horasExtras) {
      const p = pessoas.get(h.pessoa_id) ?? { nome: h.pessoa_nome ?? '—', cargo: h.pessoa_cargo ?? null, porDia: {} }
      p.porDia[Number(h.data.slice(8, 10))] = h
      pessoas.set(h.pessoa_id, p)
    }
    const totalDia: Record<number, number> = {}
    for (let d = 1; d <= dias; d++) {
      totalDia[d] = caixa.horasExtras
        .filter((h) => Number(h.data.slice(8, 10)) === d)
        .reduce((a, h) => a + h.valor, 0)
    }
    return { dias, ano, m, pessoas: [...pessoas.entries()], totalDia }
  }, [caixa.horasExtras, caixa.mes])

  function exportarRelatorio() {
    const wb = XLSX.utils.book_new()
    const linhas = (t: typeof caixa.porCategoria, rot: string) =>
      [[rot, 'Receita', 'Despesa', 'Saldo', 'Lançamentos'],
       ...t.map((x) => [x.rotulo, x.receita, x.despesa, x.saldo, x.qtd])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas(caixa.porCategoria, 'Categoria')), 'Por categoria')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas(caixa.porObra, 'Obra')), 'Por obra')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas(caixa.porSolicitante, 'Solicitante')), 'Por solicitante')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Obra', 'Valor', 'Status', 'Saldo acumulado'],
      ...caixa.comSaldoAcumulado.map((l) => [
        l.data_inicio, l.tipo, l.descricao, nomeCat(l.categoria_id), l.obra_texto ?? '', l.valor, l.status, l.acumulado,
      ]),
    ]), 'Lançamentos')
    XLSX.writeFile(wb, `CONTROLE_DE_CAIXA_${caixa.mes}.xlsx`)
  }

  if (caixa.tabelasAusentes) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">O Controle de Caixa ainda não está disponível.</p>
          <p className="text-amber-200/80 mt-1">As tabelas do caixa não existem no banco — a migration ainda não foi aplicada.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* barra de contexto */}
      <div className={`${cardCls} px-5 py-3 flex items-center gap-3 flex-wrap`}>
        <input type="month" value={caixa.mes} onChange={(e) => caixa.setMes(e.target.value)}
          className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />

        <div className="flex gap-3 overflow-x-auto">
          {([['Receita', caixa.totalReceita, 'text-green-300'],
             ['Despesa', caixa.totalDespesa, 'text-red-300'],
             ['Saldo', caixa.saldo, '']] as const).map(([rot, v, cor]) => (
            <div key={rot} className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-4 py-1.5 min-w-[130px]">
              <div className="text-[10px] text-[#a3a3a3] uppercase tracking-wide">{rot}</div>
              <div className={`font-mono text-sm font-semibold ${cor || corValor(v)}`}>{brl(v)}</div>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className={btnNeutro} onClick={() => void caixa.recarregar()} disabled={caixa.loading}>
            <RefreshCw size={14} className={caixa.loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button className={btnNeutro} onClick={() => baixarModeloCaixa(caixa.categorias.map((c) => c.nome), [], [],
              Number(caixa.mes.slice(0, 4)), Number(caixa.mes.slice(5, 7)))}>
            <Download size={14} /> Baixar modelo
          </button>
          <button className={btnPrimario} onClick={() => setImportar(true)}>
            <Upload size={14} /> Importar planilha
          </button>
        </div>
      </div>

      {caixa.erro && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{caixa.erro}</div>
      )}

      <div className="overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-lg bg-[#3d3d3d] border border-[#525252] min-w-max">
          {ABAS.map((a) => {
            const Icone = a.icon; const ativa = aba === a.key
            const badge = a.key === 'conferencia' && caixa.pendentes.length > 0 ? caixa.pendentes.length : null
            return (
              <button key={a.key} onClick={() => setAba(a.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors
                  ${ativa ? 'bg-[#f97316] text-[#ffffff]' : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#484848]'}`}>
                <Icone size={13} /> {a.label}
                {badge && <span className="ml-1 rounded-full bg-amber-500/25 text-amber-200 px-1.5 text-[10px]">{badge}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── LANÇAMENTOS ── */}
      {aba === 'lancamentos' && (
        caixa.comSaldoAcumulado.length === 0 ? (
          <div className={`${cardCls} p-8 text-center`}>
            <p className="text-sm text-[#f5f5f5] mb-1">Nenhum lançamento neste mês.</p>
            <p className="text-xs text-[#a3a3a3] mb-4">
              Baixe o modelo, preencha e importe — é a via principal de lançamento.
            </p>
            <button className={btnPrimario} onClick={() => setImportar(true)}>
              <Upload size={14} /> Importar planilha
            </button>
          </div>
        ) : (
          <div className={`${cardCls} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={trCls}>
                    <th className={thCls}>Data</th><th className={thCls}>Tipo</th>
                    <th className={thCls}>Descrição</th><th className={thCls}>Categoria</th>
                    <th className={thCls}>Obra</th><th className={thCls}>Solicitante</th>
                    <th className={`${thCls} text-right`}>Valor</th>
                    <th className={`${thCls} text-right`}>Acumulado</th>
                    <th className={thCls}>Status</th><th className={thCls}>Histórico</th><th className={thCls}></th>
                  </tr>
                </thead>
                <tbody>
                  {caixa.comSaldoAcumulado.map((l) => (
                    <tr key={l.id} className={`${trCls} hover:bg-[#484848]/40`}>
                      <td className="px-4 py-1.5 text-xs text-[#a3a3a3] whitespace-nowrap">
                        {dataBr(l.data_inicio)}
                        {l.data_fim && <span className="text-[#6b6b6b]"> a {dataBr(l.data_fim)}</span>}
                      </td>
                      <td className="px-4 py-1.5">
                        <span className={`text-[10px] font-semibold ${l.tipo === 'RECEITA' ? 'text-green-300' : 'text-red-300'}`}>
                          {l.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-1.5 text-[#f5f5f5]">{l.descricao}</td>
                      <td className="px-4 py-1.5 text-xs text-[#a3a3a3]">{nomeCat(l.categoria_id)}</td>
                      <td className="px-4 py-1.5 text-xs text-[#a3a3a3]">{l.obra_texto ?? '—'}</td>
                      <td className="px-4 py-1.5 text-xs text-[#a3a3a3]">
                        {l.solicitantes?.length ? l.solicitantes.map((s) => s.nome).join(', ') : '—'}
                      </td>
                      <td className={`px-4 py-1.5 text-right font-mono text-xs ${l.tipo === 'RECEITA' ? 'text-green-300' : 'text-[#f5f5f5]'}`}>
                        {l.tipo === 'DESPESA' ? '−' : ''}{brl(l.valor)}
                      </td>
                      <td className={`px-4 py-1.5 text-right font-mono text-xs ${corValor(l.acumulado)}`}>{brl(l.acumulado)}</td>
                      <td className="px-4 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${COR_STATUS[l.status]}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-1.5">
                        <SeloAutoria tabela="caixa_lancamento" registroId={l.id} compacto />
                      </td>
                      <td className="px-4 py-1.5">
                        <button onClick={() => void caixa.excluirLancamento(l.id)}
                          title="Excluir (o histórico fica no log de auditoria)"
                          className="text-[#6b6b6b] hover:text-red-400"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── HORAS EXTRAS: a grade que o pessoal conhece, sobre dado normalizado ── */}
      {aba === 'he' && (
        gradeHe.pessoas.length === 0 ? (
          <div className={vazioCls}>Nenhuma hora extra lançada neste mês.</div>
        ) : (
          <div className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-[#525252] flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-[#f5f5f5]">Grade mensal — clique no valor para marcar PG</h3>
              <span className="text-[11px] text-[#6b6b6b]">
                Marcar PG gera a despesa em Lançamentos, categoria "Hora extra"
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={trCls}>
                    <th className={`${thCls} sticky left-0 bg-[#3d3d3d] z-10`}>Funcionário</th>
                    {Array.from({ length: gradeHe.dias }, (_, i) => i + 1).map((d) => {
                      const dow = new Date(gradeHe.ano, gradeHe.m - 1, d).getDay()
                      const fds = dow === 0 || dow === 6
                      return (
                        <th key={d} className={`${thCls} text-center px-1.5 ${fds ? 'text-[#f97316]' : ''}`}>{d}</th>
                      )
                    })}
                    <th className={`${thCls} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeHe.pessoas.map(([pid, p]) => {
                    const total = Object.values(p.porDia).reduce((a, h) => a + h.valor, 0)
                    return (
                      <tr key={pid} className={`${trCls} hover:bg-[#484848]/40`}>
                        <td className="px-4 py-1.5 sticky left-0 bg-[#3d3d3d] whitespace-nowrap">
                          <div className="text-[#f5f5f5] text-xs">{p.nome}</div>
                          {p.cargo && <div className="text-[10px] text-[#6b6b6b]">{p.cargo}</div>}
                        </td>
                        {Array.from({ length: gradeHe.dias }, (_, i) => i + 1).map((d) => {
                          const h = p.porDia[d]
                          if (!h) return <td key={d} className="px-1.5 py-1.5 text-center text-[#525252]">·</td>
                          return (
                            <td key={d} className="px-1.5 py-1.5 text-center">
                              <button
                                onClick={() => void caixa.mudarStatusHe(h.id, h.status === 'PG' ? 'pendente' : 'PG')}
                                title={h.status === 'PG' ? 'Pago — clique para desfazer' : 'Pendente — clique para marcar PG'}
                                className={`font-mono text-[10px] rounded px-1 py-0.5 transition-colors
                                  ${h.status === 'PG' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'}`}>
                                {h.valor}
                              </button>
                            </td>
                          )
                        })}
                        <td className="px-4 py-1.5 text-right font-mono text-xs text-[#f5f5f5]">{brl(total)}</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t border-[#525252] bg-[#484848]/30">
                    <td className="px-4 py-2 sticky left-0 bg-[#3f3f3f] text-xs font-semibold text-[#f5f5f5]">Total do dia</td>
                    {Array.from({ length: gradeHe.dias }, (_, i) => i + 1).map((d) => (
                      <td key={d} className="px-1.5 py-2 text-center font-mono text-[10px] text-[#a3a3a3]">
                        {gradeHe.totalDia[d] ? gradeHe.totalDia[d] : ''}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-[#f97316]">
                      {brl(Object.values(gradeHe.totalDia).reduce((a, b) => a + b, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── CONFERÊNCIA ── */}
      {aba === 'conferencia' && (
        caixa.pendentes.length === 0 ? (
          <div className={`${cardCls} p-8 text-center`}>
            <Check size={28} className="mx-auto text-green-400 mb-2" />
            <p className="text-sm text-[#f5f5f5]">Nada pendente de conferência neste mês.</p>
          </div>
        ) : (
          <div className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-[#525252] flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-[#f5f5f5]">
                {caixa.pendentes.length} lançamento(s) pendente(s) · {selecao.size} selecionado(s)
              </span>
              <div className="flex gap-2">
                <button className={btnNeutro}
                  onClick={() => setSelecao(selecao.size === caixa.pendentes.length ? new Set() : new Set(caixa.pendentes.map((l) => l.id)))}>
                  {selecao.size === caixa.pendentes.length ? 'Limpar seleção' : 'Selecionar todos'}
                </button>
                <button className={btnPrimario} disabled={selecao.size === 0}
                  onClick={async () => { if (await caixa.conferirEmLote([...selecao])) setSelecao(new Set()) }}>
                  <Check size={14} /> Conferir {selecao.size > 0 && `(${selecao.size})`}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={trCls}>
                    <th className="px-4 py-2 w-8"></th>
                    <th className={thCls}>Data</th><th className={thCls}>Descrição</th>
                    <th className={thCls}>Categoria</th><th className={thCls}>Obra</th>
                    <th className={`${thCls} text-right`}>Valor</th><th className={thCls}>Comprovante</th>
                  </tr>
                </thead>
                <tbody>
                  {caixa.pendentes.map((l) => (
                    <tr key={l.id} className={`${trCls} hover:bg-[#484848]/40`}>
                      <td className="px-4 py-1.5">
                        <input type="checkbox" checked={selecao.has(l.id)} className="accent-[#f97316]"
                          onChange={(e) => setSelecao((s) => {
                            const n = new Set(s); e.target.checked ? n.add(l.id) : n.delete(l.id); return n
                          })} />
                      </td>
                      <td className="px-4 py-1.5 text-xs text-[#a3a3a3]">{dataBr(l.data_inicio)}</td>
                      <td className="px-4 py-1.5 text-[#f5f5f5]">{l.descricao}</td>
                      <td className="px-4 py-1.5 text-xs text-[#a3a3a3]">{nomeCat(l.categoria_id)}</td>
                      <td className="px-4 py-1.5 text-xs text-[#a3a3a3]">{l.obra_texto ?? '—'}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-xs text-[#f5f5f5]">{brl(l.valor)}</td>
                      <td className="px-4 py-1.5 text-xs">
                        {l.anexo_url
                          ? <a href={l.anexo_url} target="_blank" rel="noreferrer" className="text-[#f97316] hover:underline">ver</a>
                          : <span className="text-amber-300">sem comprovante</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── RELATÓRIOS ── */}
      {aba === 'relatorios' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className={btnNeutro} onClick={exportarRelatorio}>
              <Download size={14} /> Exportar para Excel
            </button>
          </div>
          {([['Por categoria', caixa.porCategoria], ['Por obra', caixa.porObra],
             ['Por solicitante', caixa.porSolicitante]] as const).map(([titulo, dados]) => (
            <div key={titulo} className={`${cardCls} overflow-hidden`}>
              <div className="px-5 py-3 border-b border-[#525252]">
                <h3 className="text-sm font-bold text-[#f5f5f5]">{titulo}</h3>
              </div>
              {dados.length === 0 ? <div className={vazioCls}>Sem dados no período.</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={trCls}>
                        <th className={thCls}>{titulo.replace('Por ', '')}</th>
                        <th className={`${thCls} text-right`}>Receita</th>
                        <th className={`${thCls} text-right`}>Despesa</th>
                        <th className={`${thCls} text-right`}>Saldo</th>
                        <th className={`${thCls} text-right`}>Lançamentos</th>
                        <th className={thCls}>Peso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.map((t) => (
                        <tr key={t.chave} className={`${trCls} hover:bg-[#484848]/40`}>
                          <td className="px-4 py-1.5 text-[#f5f5f5]">{t.rotulo}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs text-green-300">{t.receita ? brl(t.receita) : '—'}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs text-red-300">{t.despesa ? brl(t.despesa) : '—'}</td>
                          <td className={`px-4 py-1.5 text-right font-mono text-xs ${corValor(t.saldo)}`}>{brl(t.saldo)}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs text-[#a3a3a3]">{t.qtd}</td>
                          <td className="px-4 py-1.5">
                            <div className="h-1.5 rounded-full bg-[#2c2c2c] overflow-hidden w-28">
                              <div className="h-full bg-[#f97316]"
                                style={{ width: `${caixa.totalDespesa > 0 ? Math.min(100, (t.despesa / caixa.totalDespesa) * 100) : 0}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {importar && <ImportarCaixaModal caixa={caixa} onClose={() => setImportar(false)} />}
    </div>
  )
}
