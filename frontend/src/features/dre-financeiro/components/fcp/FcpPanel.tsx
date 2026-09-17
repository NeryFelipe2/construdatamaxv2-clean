/**
 * FcpPanel — o Fluxo de Caixa Projetado dentro do módulo DRE & Resultado.
 *
 * Sete abas internas espelhando a planilha do engenheiro, mais o fluxo de
 * aprovação (rascunho → enviado → aprovado | devolvido). A trava de edição do
 * FCP aprovado é do BANCO (trigger fcp_trava_aprovado); aqui a tela só desabilita
 * antes para o usuário não esbarrar no erro.
 */
import { useState } from 'react'
import {
  SlidersHorizontal, Wallet, CalendarRange, Receipt, Target, Coins, Tags,
  Send, CheckCircle2, Undo2, Lock, RefreshCw, AlertTriangle, GitBranch, Plus, Upload,
} from 'lucide-react'
import { useFcp, type FcpStatus } from '@/hooks/useFcp'
import { useProjectContext, selectActiveProjeto } from '@/store/projectContext'
import { useAuthStore } from '@/store/authStore'
import { PremissasPanel } from './PremissasPanel'
import { CustosPanel } from './CustosPanel'
import { SemanalPanel } from './SemanalPanel'
import { ViabilidadePanel } from './ViabilidadePanel'
import { PrecosPanel } from './PrecosPanel'
import { ImportarFcpModal } from '../ImportarFcpModal'
import { cardCls, btnNeutro, btnPrimario, thCls, trCls, vazioCls, brl, pct, dataBr, corValor } from './ui'
import { CapitalLegado } from './CapitalLegado'

type Aba = 'premissas' | 'custos' | 'semanal' | 'mensal' | 'economico' | 'viabilidade' | 'precos'

const ABAS: { key: Aba; label: string; icon: typeof Wallet }[] = [
  { key: 'premissas', label: 'Premissas', icon: SlidersHorizontal },
  { key: 'custos', label: 'Custos', icon: Coins },
  { key: 'semanal', label: 'FCP Semanal', icon: Wallet },
  { key: 'mensal', label: 'FCP Mensal', icon: CalendarRange },
  { key: 'economico', label: 'Econômico', icon: Receipt },
  { key: 'viabilidade', label: 'Viabilidade', icon: Target },
  { key: 'precos', label: 'Preços do Contrato', icon: Tags },
]

const STATUS_META: Record<FcpStatus, { rotulo: string; cor: string }> = {
  rascunho:  { rotulo: 'Rascunho',  cor: 'bg-[#484848] text-[#a3a3a3]' },
  enviado:   { rotulo: 'Enviado à diretoria', cor: 'bg-blue-500/15 text-blue-300' },
  aprovado:  { rotulo: 'Aprovado',  cor: 'bg-green-500/15 text-green-300' },
  devolvido: { rotulo: 'Devolvido', cor: 'bg-amber-500/15 text-amber-200' },
}

// FCP Mensal e Econômico vêm do motor (fcp.mensal / fcp.economico). Antes eram somados aqui a
// partir da grade semanal, pondo a semana inteira no mês em que ela começa — o mensal da planilha
// rateia por dia, e o capital sai do MENSAL, então as duas contas precisam ser a mesma.

const mesBr = (m: string) =>
  new Date(m.slice(0, 7) + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

export function FcpPanel() {
  const { activeProjectId } = useProjectContext()
  const projetoAtivo = useProjectContext(selectActiveProjeto)
  const fcp = useFcp(activeProjectId)
  const [criando, setCriando] = useState(false)
  const [importar, setImportar] = useState(false)
  const [aba, setAba] = useState<Aba>('semanal')
  const [obsDevolucao, setObsDevolucao] = useState('')
  const [mostrarDevolver, setMostrarDevolver] = useState(false)
  const ehAdmin = useAuthStore((s) => s.profile?.is_global_admin === true)

  const meses = fcp.mensal

  if (fcp.tabelasAusentes) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">O Fluxo de Caixa Projetado ainda não está disponível.</p>
          <p className="text-amber-200/80 mt-1">
            As tabelas do FCP não existem no banco — a migration <code>20260826_026_fcp_schema.sql</code> ainda não foi aplicada.
          </p>
        </div>
      </div>
    )
  }

  if (fcp.loading && fcp.fcps.length === 0) {
    return <div className={vazioCls}>Carregando fluxo de caixa projetado…</div>
  }

  if (!activeProjectId) {
    return (
      <div className={`${cardCls} p-6 max-w-2xl`}>
        <h3 className="text-sm font-semibold text-[#f5f5f5] mb-2">Selecione uma obra</h3>
        <p className="text-xs text-[#a3a3a3] leading-relaxed">
          O Fluxo de Caixa Projetado é por obra — escolha uma no seletor do topo.
        </p>
      </div>
    )
  }

  if (fcp.fcps.length === 0) {
    const criar = async () => {
      setCriando(true)
      // segunda-feira da semana corrente
      const hoje = new Date(); const dow = (hoje.getDay() + 6) % 7
      hoje.setDate(hoje.getDate() - dow)
      // data LOCAL: toISOString() é UTC e depois das 21h a semana "pulava" um dia
      const seg = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
      await fcp.criarFcp(projetoAtivo?.nome ?? 'FCP', seg)
      setCriando(false)
    }
    return (
      <div className={`${cardCls} p-6 max-w-2xl`}>
        <h3 className="text-sm font-semibold text-[#f5f5f5] mb-2">
          {projetoAtivo?.nome ?? 'Esta obra'} ainda não tem FCP
        </h3>
        <p className="text-xs text-[#a3a3a3] leading-relaxed mb-4">
          O Fluxo de Caixa Projetado é semanal e pertence à obra. Crie o desta obra e
          preencha as premissas, o ticket e os custos — a grade calcula sozinha.
        </p>
        {fcp.erro && <p className="text-xs text-red-300 mb-3">{fcp.erro}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimario} disabled={criando} onClick={() => void criar()}>
            <Plus size={14} /> {criando ? 'Criando…' : `Criar FCP em branco`}
          </button>
          <button className={btnNeutro} onClick={() => setImportar(true)}>
            <Upload size={14} /> Importar planilha
          </button>
        </div>
        {importar && (
          <ImportarFcpModal onClose={() => setImportar(false)} onSaved={(id) => { setImportar(false); void fcp.recarregar(); fcp.setFcpId(id) }} />
        )}
      </div>
    )
  }

  const status = fcp.fcp?.status ?? 'rascunho'
  const meta = STATUS_META[status]

  return (
    <div className="space-y-4">
      {/* barra do documento: qual semana, status e as ações de aprovação */}
      <div className={`${cardCls} px-5 py-3 flex items-center gap-3 flex-wrap`}>
        <select value={fcp.fcpId ?? ''} onChange={(e) => fcp.setFcpId(e.target.value)}
          className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]">
          {fcp.fcps.map((f) => (
            <option key={f.id} value={f.id}>{f.nome} — semana de {dataBr(f.semana_ref)}</option>
          ))}
        </select>

        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.cor}`}>
          {status === 'aprovado' && <Lock size={11} />}
          {meta.rotulo}
        </span>
        {(fcp.fcp?.versao ?? 1) > 1 && (
          <span className="text-[11px] text-[#6b6b6b]">versão {fcp.fcp?.versao}</span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button className={btnNeutro} onClick={() => void fcp.recarregar()} disabled={fcp.loading}>
            <RefreshCw size={14} className={fcp.loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          {status !== 'aprovado' && (
            <button className={btnNeutro} onClick={() => setImportar(true)}>
              <Upload size={14} /> Importar planilha
            </button>
          )}
          {(status === 'rascunho' || status === 'devolvido') && (
            <button className={btnPrimario} onClick={() => void fcp.mudarStatus('enviado')}>
              <Send size={14} /> Enviar à diretoria
            </button>
          )}
          {status === 'enviado' && (
            <>
              <button className={btnNeutro} onClick={() => setMostrarDevolver((v) => !v)}>
                <Undo2 size={14} /> Devolver
              </button>
              <button className={btnPrimario}
                title="Ao aprovar, as tarefas da semana nascem no LPS com a meta de produção deste FCP"
                onClick={() => void fcp.mudarStatus('aprovado')}>
                <CheckCircle2 size={14} /> Aprovar
              </button>
            </>
          )}
          {status === 'aprovado' && ehAdmin && (
            <button className={btnNeutro} onClick={() => void fcp.mudarStatus('rascunho')}
              title="Reabre para edição e registra no histórico de auditoria">
              <Undo2 size={14} /> Reabrir
            </button>
          )}
        </div>

        {mostrarDevolver && status === 'enviado' && (
          <div className="w-full flex items-center gap-2 pt-2 border-t border-[#525252]/50">
            <input value={obsDevolucao} onChange={(e) => setObsDevolucao(e.target.value)}
              placeholder="Motivo da devolução (o engenheiro vai ler isto)"
              className="flex-1 bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
            <button className={btnPrimario} disabled={!obsDevolucao.trim()}
              onClick={async () => {
                if (await fcp.mudarStatus('devolvido', obsDevolucao.trim())) {
                  setObsDevolucao(''); setMostrarDevolver(false)
                }
              }}>Confirmar devolução</button>
          </div>
        )}
      </div>

      {status === 'aprovado' && (
        <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          <GitBranch size={15} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Integrado ao LPS.</span>{' '}
            As tarefas da semana nasceram no LPS com a meta de produção deste FCP. O realizado
            lançado lá volta sozinho para o Planejado × Realizado aqui — mão dupla, sem digitar duas vezes.
          </div>
        </div>
      )}

      {status === 'devolvido' && fcp.fcp?.observacao && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <Undo2 size={15} className="mt-0.5 shrink-0" />
          <div><span className="font-semibold">Devolvido pela diretoria:</span> {fcp.fcp.observacao}</div>
        </div>
      )}

      {fcp.erro && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {fcp.erro}
        </div>
      )}

      {fcp.pendencias.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-semibold">O cálculo está incompleto enquanto isto não for resolvido:</p>
            {fcp.pendencias.map((p, i) => <p key={i} className="text-amber-200/90">· {p.mensagem}</p>)}
          </div>
        </div>
      )}

      {/* abas internas */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-lg bg-[#3d3d3d] border border-[#525252] min-w-max">
          {ABAS.map((a) => {
            const Icone = a.icon
            const ativa = aba === a.key
            return (
              <button key={a.key} onClick={() => setAba(a.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors
                  ${ativa ? 'bg-[#f97316] text-[#ffffff]' : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#484848]'}`}>
                <Icone size={13} /> {a.label}
              </button>
            )
          })}
        </div>
      </div>

      {aba === 'premissas' && <PremissasPanel fcp={fcp} />}
      {aba === 'custos' && <CustosPanel fcp={fcp} />}
      {aba === 'semanal' && <SemanalPanel fcp={fcp} />}
      {aba === 'viabilidade' && <ViabilidadePanel fcp={fcp} />}
      {aba === 'precos' && <PrecosPanel fcp={fcp} />}

      {aba === 'mensal' && (
        meses.length === 0 ? <div className={vazioCls}>Sem meses calculados.</div> : (
          <div className="space-y-4">
            <div className="flex gap-3 overflow-x-auto">
              {fcp.capital && ([
                ['Pior ponto do caixa', fcp.capital.pior_saldo, true],
                ['Necessidade máxima', fcp.capital.necessidade, false],
                [`Contingência (${pct(fcp.capital.contingencia, 0)})`, fcp.capital.contingencia_valor, false],
                ['Capital recomendado', fcp.capital.capital_recomendado, false],
              ] as const).map(([rotulo, valor, vermelho]) => (
                <div key={rotulo} className={`${cardCls} px-4 py-3 min-w-[170px]`}>
                  <div className="text-[10px] text-[#a3a3a3] uppercase tracking-wide">{rotulo}</div>
                  <div className={`font-mono text-lg font-semibold ${vermelho ? corValor(valor) : 'text-[#f97316]'}`}>
                    {brl(valor)}
                  </div>
                </div>
              ))}
            </div>
            {fcp.capital?.mes_pior_ponto && (
              <p className="text-xs text-[#a3a3a3]">
                O pior ponto é em <span className="text-[#f5f5f5] font-semibold">{mesBr(fcp.capital.mes_pior_ponto)}</span>,
                antes de a medição daquele mês cair — é o dinheiro que precisa estar disponível no dia em que a folha vence.
              </p>
            )}
            {fcp.capitalLegado && <CapitalLegado legado={fcp.capitalLegado} novo={fcp.capital?.capital_recomendado ?? 0} />}

            <div className={`${cardCls} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className={trCls}>
                    <th className={thCls}>Mês</th>
                    <th className={`${thCls} text-right`}>Medição do mês</th>
                    <th className={`${thCls} text-right`}>Recebimento</th>
                    <th className={`${thCls} text-right`}>(–) Desconto consórcio</th>
                    <th className={`${thCls} text-right`}>(–) Imposto</th>
                    <th className={`${thCls} text-right`}>Sai do caixa</th>
                    <th className={`${thCls} text-right`}>Acumulado antes do recebimento</th>
                    <th className={`${thCls} text-right`}>Acumulado depois</th>
                  </tr></thead>
                  <tbody>
                    {meses.map((m) => (
                      <tr key={m.mes.mes} className={`${trCls} hover:bg-[#484848]/40 ${m.mes.mes === fcp.capital?.mes_pior_ponto ? 'bg-red-500/5' : ''}`}>
                        <td className="px-4 py-2 text-[#f5f5f5] whitespace-nowrap">
                          {mesBr(m.mes.mes)}
                          <div className="text-[10px] text-[#6b6b6b]">paga em {dataBr(m.mes.dataPagamento)}</div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{brl(m.medicaoBruta)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{brl(m.recebimento)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{brl(m.descontoConsorcio)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{brl(m.imposto)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{brl(m.saiDoCaixa)}</td>
                        <td className={`px-4 py-2 text-right font-mono text-xs ${corValor(m.acumuladoAntesDoRecebimento)}`}>{brl(m.acumuladoAntesDoRecebimento)}</td>
                        <td className={`px-4 py-2 text-right font-mono ${corValor(m.acumuladoDepois)}`}>{brl(m.acumuladoDepois)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {fcp.sensibilidade.length > 0 && (
              <div className={`${cardCls} overflow-hidden`}>
                <div className="px-5 py-3 border-b border-[#525252]">
                  <h3 className="text-sm font-bold text-[#f5f5f5] uppercase tracking-wide">Sensibilidade — o mesmo contrato nos 4 cenários</h3>
                  <p className="text-[11px] text-[#6b6b6b] mt-0.5">Usa a produção PREVISTA de cada cenário (o realizado lançado não entra aqui).</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className={trCls}>
                      <th className={thCls}>Cenário</th>
                      <th className={`${thCls} text-right`}>Margem</th>
                      <th className={`${thCls} text-right`}>Capital recomendado</th>
                      <th className={`${thCls} text-right`}>Pior mês</th>
                      <th className={`${thCls} text-right`}>Resultado no fim do contrato</th>
                    </tr></thead>
                    <tbody>
                      {fcp.sensibilidade.map((s) => (
                        <tr key={s.cenario} className={`${trCls} ${s.adotado ? 'bg-[#f97316]/10' : ''}`}>
                          <td className={`px-4 py-2 ${s.adotado ? 'text-[#f97316] font-semibold' : 'text-[#f5f5f5]'}`}>{s.cenario}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{pct(s.margem, 0)}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs text-[#f5f5f5]">{brl(s.capital.capitalRecomendado)}</td>
                          <td className="px-4 py-2 text-right text-xs text-[#a3a3a3]">{s.capital.mesDoPiorPonto ? mesBr(s.capital.mesDoPiorPonto) : '—'}</td>
                          <td className={`px-4 py-2 text-right font-mono text-xs ${corValor(s.resultadoFinal)}`}>{brl(s.resultadoFinal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {aba === 'economico' && (
        fcp.economico.length === 0 ? <div className={vazioCls}>Sem competências calculadas.</div> : (
          <div className="space-y-3">
            <p className="text-xs text-[#6b6b6b] max-w-3xl leading-relaxed">
              Resultado por COMPETÊNCIA: a margem real da operação, mês a mês, com todos os custos —
              inclusive os que o consórcio banca. É diferente do resultado de CAIXA do FCP Mensal:
              os dois só se encontram no fim do contrato. No 1º mês o resultado pode sair negativo:
              é saldo devido ao consórcio, compensado em seguida.
            </p>
            <div className={`${cardCls} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className={trCls}>
                    <th className={thCls}>Mês</th>
                    <th className={`${thCls} text-right`}>Medição bruta</th>
                    <th className={`${thCls} text-right`}>(–) Imposto</th>
                    <th className={`${thCls} text-right`}>(–) Folha</th>
                    <th className={`${thCls} text-right`}>(–) Engenheiro</th>
                    <th className={`${thCls} text-right`}>(–) Estrutura</th>
                    <th className={`${thCls} text-right`}>(–) Indiretos</th>
                    <th className={`${thCls} text-right`}>(–) Mobilização</th>
                    <th className={`${thCls} text-right`}>(=) Resultado</th>
                    <th className={`${thCls} text-right`}>Acumulado</th>
                    <th className={`${thCls} text-right`}>Margem</th>
                  </tr></thead>
                  <tbody>
                    {fcp.economico.map((m) => (
                      <tr key={m.mes.mes} className={`${trCls} hover:bg-[#484848]/40`}>
                        <td className="px-4 py-2 text-[#f5f5f5]">{mesBr(m.mes.mes)}</td>
                        {[m.medicaoBruta, m.imposto, m.folha, m.engenheiro, m.estrutura, m.indiretos, m.mobilizacao].map((v, i) => (
                          <td key={i} className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">{brl(v)}</td>
                        ))}
                        <td className={`px-4 py-2 text-right font-mono text-xs ${corValor(m.resultado)}`}>{brl(m.resultado)}</td>
                        <td className={`px-4 py-2 text-right font-mono ${corValor(m.resultadoAcumulado)}`}>{brl(m.resultadoAcumulado)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[#a3a3a3]">
                          {m.medicaoBruta > 0 ? pct(m.margem) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {importar && (
        <ImportarFcpModal onClose={() => setImportar(false)} onSaved={(id) => { setImportar(false); void fcp.recarregar(); fcp.setFcpId(id) }} />
      )}
    </div>
  )
}
