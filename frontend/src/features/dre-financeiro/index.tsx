/**
 * DRE & Resultado Financeiro — Módulo completo de análise econômica
 * Dados reais via Supabase (lancamentos_financeiros + trechos_custo)
 *
 * Dialeto grafite: header/abas em DreHeader (espelho do EvmHeader),
 * aba ativa no dreStore, mocks de demonstração em @/data/mockDre.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, Wallet,
  Receipt, Calculator, CheckCircle2, AlertTriangle, Target, Layers,
  Clock, Users, Shield, Upload, Trash2, Wand2,
} from 'lucide-react'
import { TOOLTIPS } from '@/components/ui/InfoTooltip'
import { InsightsPanel, generateDreInsights, generateFluxoCaixaInsights, generateCustoTrechoInsights } from '@/components/ui/InsightBanner'
import { useProjectContext, selectActiveProjeto } from '@/store/projectContext'
import { useSupabaseDre } from '@/lib/useSupabaseDre'
import { useAppModeStore } from '@/store/appModeStore'
import { useDreStore } from '@/store/dreStore'
import { FcpPanel } from './components/fcp/FcpPanel'
import { CaixaPanel } from './components/caixa/CaixaPanel'
import { DRE_FALLBACK, FLUXO_CAIXA, TRECHOS_FALLBACK, EFICIENCIA } from '@/data/mockDre'
import { DreHeader, DreKpiCard } from './components/DreHeader'
import { LancamentoManualModal } from './components/LancamentoManualModal'
import { ImportarCsvModal } from './components/ImportarCsvModal'
import { ImportarCsvFluxoModal } from './components/ImportarCsvFluxoModal'
import { computeFluxoCaixa, type OrigemMes } from './utils/computeFluxoCaixa'
import { parseValorBR } from './utils/parseCsvLancamentos'
import { useFluxoProjecao } from '@/hooks/useFluxoProjecao'

// Sem projeto ativo: cabeçalho honesto (nunca um contrato fabricado).
const CONTRATO_VAZIO = { numero: '—', empresa: '—', cliente: '—', cidade: '—', valorContrato: 0, prazoMeses: 0 }

// Deriva o prazo (em meses) a partir de data_inicio/data_fim quando o contrato
// não tem prazoMeses cadastrado explicitamente (ex: 24/06 → 15/08 ≈ 2 meses).
function mesesEntre(inicio: string, fim: string): number {
  const d1 = new Date(inicio)
  const d2 = new Date(fim)
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0
  const dias = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.round(dias / 30))
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}
function fmtPct(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` }

function ProgressBar({ value, max, color = 'bg-[#f97316]', height = 'h-2' }: { value: number; max: number; color?: string; height?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 ${height} bg-[#2c2c2c] rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-[#a3a3a3] w-10 text-right">{pct}%</span>
    </div>
  )
}

function SectionTitle({ children, icon: Icon }: { children: string; icon: any }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-[#f97316]" />
      <h3 className="text-sm font-bold text-[#a3a3a3] uppercase tracking-wider">{children}</h3>
    </div>
  )
}

export function DreFinanceiroPage() {
  const tab = useDreStore((s) => s.activeTab)
  const setTab = useDreStore((s) => s.setActiveTab)
  const [showLancamentoModal, setShowLancamentoModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showFluxoCsvModal, setShowFluxoCsvModal] = useState(false)
  const navigate = useNavigate()
  const { activeProjectId } = useProjectContext()
  const projetoAtivo = useProjectContext(selectActiveProjeto)
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)

  const { lancamentos, trechos, loading, connectionStatus, refresh } = useSupabaseDre(activeProjectId)
  const { projecoes, gerarMesesAteFim, salvarProjecao, excluirProjecao, reload: reloadProjecoes } = useFluxoProjecao(activeProjectId)
  const podeLancar = !!activeProjectId && !isDemoMode
  const motivoBloqueio = isDemoMode
    ? 'Desative o Modo Demonstração para lançar dados reais'
    : !activeProjectId
      ? 'Selecione um projeto ativo'
      : undefined
  const isRealData = lancamentos.length > 0 || trechos.length > 0
  // Só mostra números de exemplo no Modo Demonstração. Fora dele, sem dado real = zerado + aviso honesto.
  const usarFallback = isDemoMode
  const semDadoReal = !isRealData && !usarFallback
  // Carregando sem dado na tela (e fora do demo): KPIs viram "—" com note
  // "carregando…" e o corpo mostra o aviso de carregamento — nunca DRE zerada.
  const carregando = loading && !isRealData && !usarFallback

  // Cabeçalho: sempre o projeto REAL ativo (Boi Malhado/Sakura/Retorno) — sem projeto, aviso honesto.
  const CONTRATO = projetoAtivo ? {
    numero: projetoAtivo.contrato ? `CT ${projetoAtivo.contrato}` : '—',
    empresa: 'WCR',
    cliente: (projetoAtivo as any).cliente || 'SABESP',
    cidade: projetoAtivo.cidade || '—',
    valorContrato: Number((projetoAtivo as any).orcamento_total) || 0,
    prazoMeses: projetoAtivo.data_inicio && projetoAtivo.data_fim
      ? mesesEntre(projetoAtivo.data_inicio, projetoAtivo.data_fim)
      : 0,
  } : CONTRATO_VAZIO

  // Dados reais ou fallback (fallback só no Modo Demo)
  const receitasDB = lancamentos.filter(x => x.tipo === 'RECEITA').map(x => ({ desc: x.descricao, valor: Number(x.valor) }))
  const despesasDB = lancamentos.filter(x => x.tipo === 'DESPESA').map(x => ({ desc: x.descricao, valor: Number(x.valor) }))

  const receitasList = receitasDB.length > 0 ? receitasDB : (usarFallback ? DRE_FALLBACK.receitas : [])
  const despesasList = despesasDB.length > 0 ? despesasDB : (usarFallback ? DRE_FALLBACK.custosDiretos : [])
  const custosIndiretosList = usarFallback ? DRE_FALLBACK.custosIndiretos : []
  const impostosList = usarFallback ? DRE_FALLBACK.impostos : []
  const trechosView = trechos.length > 0 ? trechos : (usarFallback ? TRECHOS_FALLBACK : [])

  // ── Fluxo de caixa ──
  // Demo ON  → const antiga FLUXO_CAIXA (mock, intacto).
  // Demo OFF → motor puro computeFluxoCaixa (realizado dos lançamentos + projeções).
  const fluxoDataFim = (projetoAtivo as any)?.data_fim ?? null
  const fluxoReal = usarFallback
    ? null
    : computeFluxoCaixa(
        lancamentos.map((l) => ({ data: l.data, tipo: (l.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA') as 'RECEITA' | 'DESPESA', valor: Number(l.valor) })),
        projecoes.map((p) => ({ mes: p.mes, recebimento_prev: Number(p.recebimento_prev), despesa_prev: Number(p.despesa_prev) })),
        fluxoDataFim,
      )
  const fluxoView: Array<{ mes: string; recebido: number; gasto: number; saldoAcumulado: number; origem?: OrigemMes }> = usarFallback
    ? FLUXO_CAIXA.map((f) => ({ mes: f.mes, recebido: f.recebido, gasto: f.gasto, saldoAcumulado: f.saldo }))
    : (fluxoReal?.serie ?? []).map((m) => ({ mes: m.mesLabel, recebido: m.recebido, gasto: m.gasto, saldoAcumulado: m.saldoAcumulado, origem: m.origem }))
  // Breakeven: demo mantém o rótulo antigo; real é DERIVADO (nunca hardcoded).
  const breakevenLabel = usarFallback
    ? 'Fev/2026'
    : fluxoReal?.breakevenMes
      ? (fluxoReal.serie.find((m) => m.mes === fluxoReal.breakevenMes)?.mesLabel ?? '—')
      : '—'
  const semFluxoReal = !usarFallback && fluxoView.length === 0

  const totalReceita = receitasList.reduce((a, r) => a + r.valor, 0)
  const totalCustoDir = despesasList.reduce((a, c) => a + c.valor, 0)
  const totalCustoInd = custosIndiretosList.reduce((a, c) => a + c.valor, 0)
  const totalImpostos = impostosList.reduce((a, i) => a + i.valor, 0)
  const lucroBruto = totalReceita - totalCustoDir
  const lucroOperacional = lucroBruto - totalCustoInd
  const lucroLiquido = lucroOperacional - totalImpostos
  const margemBruta = totalReceita > 0 ? (lucroBruto / totalReceita) * 100 : 0
  const margemLiquida = totalReceita > 0 ? (lucroLiquido / totalReceita) * 100 : 0
  const totalTrechosCusto = trechosView.reduce((a, t) => a + Number(t.custo_total), 0)
  const totalExt = trechosView.reduce((a, t) => a + Number(t.extensao), 0)
  // variacao=0 significa "sem variação apurada" (trecho ainda planejado) — exclui do cálculo da média,
  // senão trechos não-executados puxariam a média pra perto de zero de forma artificial.
  const trechosComVariacao = trechosView.filter((t) => Number(t.variacao) !== 0)
  const temVariacaoReal = trechosComVariacao.length > 0
  const variacaoMedia = temVariacaoReal
    ? trechosComVariacao.reduce((a, t) => a + Number(t.variacao), 0) / trechosComVariacao.length
    : 0

  // KPI "carregando…": valor null + note honesto enquanto busca sem dado na tela.
  const notaCarregando = 'carregando…'
  const kv = (v: number | string) => (carregando ? null : v)
  const kn = (nota?: string) => (carregando ? notaCarregando : nota)

  const avisoCarregando = (
    <div className="text-[#6b6b6b] text-sm text-center py-10">Carregando lançamentos financeiros…</div>
  )

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <DreHeader
        contrato={CONTRATO}
        connectionStatus={connectionStatus}
        isRealData={isRealData}
        loading={loading}
        carregando={carregando}
        podeLancar={podeLancar}
        motivoBloqueio={motivoBloqueio}
        valorContrato={CONTRATO.valorContrato > 0 ? CONTRATO.valorContrato : null}
        prazoMeses={CONTRATO.prazoMeses > 0 ? CONTRATO.prazoMeses : null}
        receitaBruta={carregando || semDadoReal ? null : totalReceita}
        custoTotal={carregando || semDadoReal ? null : totalCustoDir + totalCustoInd}
        margemLiquida={carregando || semDadoReal || totalReceita <= 0 ? null : margemLiquida}
        onNovoLancamento={() => setShowLancamentoModal(true)}
        onImportarCsv={() => setShowImportModal(true)}
        onRefresh={refresh}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-5">

        {semDadoReal && !loading && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="text-xs text-amber-200/90 leading-relaxed">
              <b className="text-amber-300">Sem lançamentos financeiros cadastrados para esta obra.</b> Os valores de receita, custo e resultado só aparecem quando houver medições e custos reais lançados no sistema. Nada aqui é estimado ou de exemplo. (Ative o <b>Modo Demonstração</b> na barra lateral se quiser ver um exemplo ilustrativo.)
            </span>
          </div>
        )}

        {/* ═══ DRE ═══ */}
        {tab === 'dre' && (
          <>
            {!semDadoReal && <InsightsPanel insights={generateDreInsights({
              margemBruta, margemLiquida, lucroLiquido, totalReceita,
              onVerCustoPorTrecho: () => setTab('custos'),
              onVerEficiencia: () => setTab('eficiencia'),
              onVerComposicaoCustos: () => setTab('custos'),
            })} title="Insights — O que os dados dizem?" />}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <DreKpiCard label="Receita Bruta" value={kv(totalReceita)} isCurrency note={kn()} icon={TrendingUp} color="#34d399" trend="up" sub="Acumulado" tooltip={TOOLTIPS.receitaBruta} dataTour="receita-bruta" />
              <DreKpiCard label="Custo Direto" value={kv(totalCustoDir)} isCurrency note={kn()} icon={TrendingDown} color="#fb7185" trend="down" tooltip={TOOLTIPS.custoDirecto} dataTour="custo-direto" />
              <DreKpiCard label="Lucro Bruto" value={kv(lucroBruto)} isCurrency note={kn()} icon={BarChart3} color="#f97316" trend="up" sub={`Margem: ${margemBruta.toFixed(1)}%`} tooltip={TOOLTIPS.lucroBruto} dataTour="lucro-bruto" />
              <DreKpiCard label="Lucro Operacional" value={kv(lucroOperacional)} isCurrency note={kn()} icon={PieChart} color="#c084fc" trend="up" />
              <DreKpiCard label="Impostos" value={kv(totalImpostos)} isCurrency note={kn()} icon={Receipt} color="#facc15" trend="down" />
              <DreKpiCard label="Lucro Líquido" value={kv(lucroLiquido)} isCurrency note={kn()} icon={DollarSign} color="#34d399" trend="up" sub={`Margem: ${margemLiquida.toFixed(1)}%`} tooltip={TOOLTIPS.lucroLiquido} dataTour="lucro-liquido" />
            </div>

            {carregando ? avisoCarregando : (
            <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#525252]">
                <SectionTitle icon={Receipt}>Demonstrativo de Resultado do Exercício</SectionTitle>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#525252]/50">
                    <th className="text-left text-[#a3a3a3] text-xs font-medium px-5 py-2">Descrição</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Valor (R$)</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">% s/ Receita</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-emerald-500/5"><td className="px-5 py-2 font-bold text-emerald-400" colSpan={3}>RECEITAS</td></tr>
                  {receitasList.map((r, i) => (
                    <tr key={`r-${i}`} className="border-b border-[#525252]/50 hover:bg-[#484848]/40">
                      <td className="px-5 py-2 text-[#f5f5f5] pl-8">{r.desc}</td>
                      <td className="px-5 py-2 text-right text-emerald-400 font-mono">{fmt(r.valor)}</td>
                      <td className="px-5 py-2 text-right text-[#a3a3a3] font-mono">{totalReceita > 0 ? ((r.valor / totalReceita) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-emerald-500/30 bg-emerald-500/10">
                    <td className="px-5 py-2 font-bold text-emerald-400">TOTAL RECEITAS</td>
                    <td className="px-5 py-2 text-right font-bold text-emerald-400 font-mono">{fmt(totalReceita)}</td>
                    <td className="px-5 py-2 text-right font-bold text-emerald-400 font-mono">100.0%</td>
                  </tr>

                  <tr className="bg-rose-500/5 mt-2"><td className="px-5 py-2 font-bold text-rose-400 pt-4" colSpan={3}>(-) CUSTOS DIRETOS</td></tr>
                  {despesasList.map((c, i) => (
                    <tr key={`c-${i}`} className="border-b border-[#525252]/50 hover:bg-[#484848]/40">
                      <td className="px-5 py-2 text-[#f5f5f5] pl-8">{c.desc}</td>
                      <td className="px-5 py-2 text-right text-rose-400 font-mono">({fmt(c.valor)})</td>
                      <td className="px-5 py-2 text-right text-[#a3a3a3] font-mono">{totalReceita > 0 ? ((c.valor / totalReceita) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-rose-500/30 bg-rose-500/10">
                    <td className="px-5 py-2 font-bold text-rose-400">TOTAL CUSTOS DIRETOS</td>
                    <td className="px-5 py-2 text-right font-bold text-rose-400 font-mono">({fmt(totalCustoDir)})</td>
                    <td className="px-5 py-2 text-right font-bold text-rose-400 font-mono">{totalReceita > 0 ? ((totalCustoDir / totalReceita) * 100).toFixed(1) : 0}%</td>
                  </tr>

                  <tr className="border-t-2 border-[#f97316]/30 bg-[#f97316]/10">
                    <td className="px-5 py-3 font-bold text-[#f97316] text-sm">= LUCRO BRUTO</td>
                    <td className="px-5 py-3 text-right font-bold text-[#f97316] text-sm font-mono">{fmt(lucroBruto)}</td>
                    <td className="px-5 py-3 text-right font-bold text-[#f97316] font-mono">{margemBruta.toFixed(1)}%</td>
                  </tr>

                  <tr className="bg-yellow-500/5"><td className="px-5 py-2 font-bold text-yellow-400 pt-4" colSpan={3}>(-) CUSTOS INDIRETOS</td></tr>
                  {custosIndiretosList.map((c, i) => (
                    <tr key={`ci-${i}`} className="border-b border-[#525252]/50 hover:bg-[#484848]/40">
                      <td className="px-5 py-2 text-[#f5f5f5] pl-8">{c.desc}</td>
                      <td className="px-5 py-2 text-right text-yellow-400 font-mono">({fmt(c.valor)})</td>
                      <td className="px-5 py-2 text-right text-[#a3a3a3] font-mono">{totalReceita > 0 ? ((c.valor / totalReceita) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}

                  <tr className="border-t-2 border-purple-500/30 bg-purple-500/10">
                    <td className="px-5 py-3 font-bold text-purple-400 text-sm">= LUCRO OPERACIONAL (EBITDA)</td>
                    <td className="px-5 py-3 text-right font-bold text-purple-400 text-sm font-mono">{fmt(lucroOperacional)}</td>
                    <td className="px-5 py-3 text-right font-bold text-purple-400 font-mono">{totalReceita > 0 ? ((lucroOperacional / totalReceita) * 100).toFixed(1) : 0}%</td>
                  </tr>

                  <tr className="bg-orange-500/5"><td className="px-5 py-2 font-bold text-orange-400 pt-4" colSpan={3}>(-) IMPOSTOS E TRIBUTOS</td></tr>
                  {impostosList.map((imp, i) => (
                    <tr key={`imp-${i}`} className="border-b border-[#525252]/50 hover:bg-[#484848]/40">
                      <td className="px-5 py-2 text-[#f5f5f5] pl-8">{imp.desc}</td>
                      <td className="px-5 py-2 text-right text-orange-400 font-mono">({fmt(imp.valor)})</td>
                      <td className="px-5 py-2 text-right text-[#a3a3a3] font-mono">{totalReceita > 0 ? ((imp.valor / totalReceita) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}

                  <tr className="border-t-2 border-emerald-500/50 bg-emerald-500/15">
                    <td className="px-5 py-4 font-bold text-emerald-400 text-base">= LUCRO LÍQUIDO</td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-400 text-base font-mono">{fmt(lucroLiquido)}</td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-400 text-base font-mono">{margemLiquida.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            )}
          </>
        )}

        {/* ═══ FLUXO DE CAIXA ═══ */}
        {tab === 'fluxo' && (
          <>
            {fluxoView.length > 0 && <InsightsPanel
              insights={generateFluxoCaixaInsights({
                saldoAtual: fluxoView[fluxoView.length-1].saldoAcumulado, mesBreakeven: breakevenLabel,
                totalRecebido: fluxoView.reduce((a,f)=>a+f.recebido,0), totalGasto: fluxoView.reduce((a,f)=>a+f.gasto,0),
                onVerCronogramaFinanceiro: () => navigate('/app/planejamento-mestre'),
              })}
              title="Insights — Fluxo de Caixa"
            />}

            {carregando && avisoCarregando}

            {semFluxoReal && !loading && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-200/90 leading-relaxed">
                  <b className="text-amber-300">Sem fluxo de caixa para esta obra.</b> A série mensal aparece quando houver lançamentos financeiros (meses passados/corrente) ou projeções cadastradas (meses futuros). Use <b>Gerar meses até o fim da obra</b> ou <b>Importar CSV</b> abaixo para começar a projeção — nada aqui é estimado ou de exemplo.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DreKpiCard label="Total Recebido" value={kv(fluxoView.reduce((a, f) => a + f.recebido, 0))} isCurrency note={kn()} icon={TrendingUp} color="#34d399" trend="up" tooltip={TOOLTIPS.fluxoCaixa} />
              <DreKpiCard label="Total Gasto" value={kv(fluxoView.reduce((a, f) => a + f.gasto, 0))} isCurrency note={kn()} icon={TrendingDown} color="#fb7185" trend="down" />
              <DreKpiCard label="Saldo Atual" value={kv(fluxoView.length ? fluxoView[fluxoView.length - 1].saldoAcumulado : 0)} isCurrency note={kn()} icon={Wallet} color="#f97316" trend="up" sub="Acumulado" />
              <DreKpiCard label="Breakeven" value={carregando ? null : (fluxoView.length ? breakevenLabel : null)} note={kn('sem dados de fluxo')} icon={Target} color="#facc15" sub={fluxoView.length ? (breakevenLabel !== '—' ? `Saldo acumulado vira positivo em ${breakevenLabel}` : 'Não vira positivo no horizonte projetado') : undefined} tooltip={TOOLTIPS.breakeven} dataTour="breakeven" />
            </div>

            {fluxoView.length > 0 && (
            <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#525252]"><SectionTitle icon={Wallet}>Fluxo de Caixa Mensal</SectionTitle></div>
              <div className="px-5 py-4 border-b border-[#525252]">
                <div className="flex items-end gap-2 h-40">
                  {fluxoView.map((f, i) => {
                    const maxVal = Math.max(1, ...fluxoView.map(x => Math.max(x.recebido, x.gasto)))
                    const hReceita = (f.recebido / maxVal) * 100
                    const hGasto = (f.gasto / maxVal) * 100
                    const projetado = f.origem === 'projetado' || f.origem === 'misto'
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="flex gap-0.5 items-end h-32 w-full justify-center">
                          <div className={`w-[45%] rounded-t-sm transition-all ${projetado ? 'bg-emerald-500/30 border border-dashed border-emerald-400/50' : 'bg-emerald-500/60'}`} style={{ height: `${hReceita}%` }} />
                          <div className={`w-[45%] rounded-t-sm transition-all ${projetado ? 'bg-rose-500/30 border border-dashed border-rose-400/50' : 'bg-rose-500/60'}`} style={{ height: `${hGasto}%` }} />
                        </div>
                        <span className="text-[9px] text-[#6b6b6b]">{f.mes}{projetado ? '*' : ''}</span>
                        <span className={`text-[9px] font-bold ${f.saldoAcumulado >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {f.saldoAcumulado >= 0 ? '+' : ''}{(f.saldoAcumulado / 1000).toFixed(0)}k
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 mt-3 justify-center text-[10px] text-[#6b6b6b]">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/60" /> Recebido</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/60" /> Gasto</span>
                  {!usarFallback && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-[#6b6b6b]" /> * = mês projetado</span>}
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#525252]/50">
                    <th className="text-left text-[#a3a3a3] text-xs font-medium px-5 py-2">Mês</th>
                    {!usarFallback && <th className="text-left text-[#a3a3a3] text-xs font-medium px-5 py-2">Origem</th>}
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Recebido</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Gasto</th>
                    <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {fluxoView.map((f, i) => (
                    <tr key={i} className="border-b border-[#525252]/50 hover:bg-[#484848]/40">
                      <td className="px-5 py-2 font-medium text-[#f5f5f5]">{f.mes}</td>
                      {!usarFallback && (
                        <td className="px-5 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            f.origem === 'real' ? 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20'
                            : f.origem === 'misto' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {f.origem === 'real' ? 'REALIZADO' : f.origem === 'misto' ? 'REAL+PROJ' : 'PROJEÇÃO'}
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-2 text-right text-emerald-400 font-mono">{fmt(f.recebido)}</td>
                      <td className="px-5 py-2 text-right text-rose-400 font-mono">({fmt(f.gasto)})</td>
                      <td className={`px-5 py-2 text-right font-bold font-mono ${f.saldoAcumulado >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(f.saldoAcumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            {/* Editor de projeções — só fora do Modo Demo, com projeto ativo */}
            {!usarFallback && activeProjectId && (
              <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#525252] flex items-center justify-between flex-wrap gap-2">
                  <SectionTitle icon={Wand2}>Projeção dos meses futuros</SectionTitle>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => { if (fluxoDataFim) await gerarMesesAteFim(fluxoDataFim) }}
                      disabled={!fluxoDataFim}
                      title={fluxoDataFim ? `Gera meses zerados até ${fluxoDataFim}` : 'Projeto sem data de fim cadastrada'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#484848] text-[#f5f5f5] rounded-lg text-xs font-semibold hover:bg-[#525252] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Wand2 size={12} /> Gerar meses até o fim da obra
                    </button>
                    <button
                      onClick={() => setShowFluxoCsvModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#484848] text-[#f5f5f5] rounded-lg text-xs font-semibold hover:bg-[#525252] transition-colors"
                    >
                      <Upload size={12} /> Importar CSV
                    </button>
                  </div>
                </div>
                {projecoes.length === 0 ? (
                  <div className="px-5 py-6 text-center text-xs text-[#6b6b6b]">
                    Nenhuma projeção cadastrada. Clique em <b className="text-[#f97316]">Gerar meses até o fim da obra</b> para criar as linhas dos meses futuros e depois preencha os valores previstos, ou <b className="text-[#f97316]">Importar CSV</b>.
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#525252]/50">
                        <th className="text-left text-[#a3a3a3] text-xs font-medium px-5 py-2">Mês</th>
                        <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Recebimento Prev. (R$)</th>
                        <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Mão de Obra (R$)</th>
                        <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Material (R$)</th>
                        <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Locação/Frota (R$)</th>
                        <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Outros (R$)</th>
                        <th className="text-right text-[#a3a3a3] text-xs font-medium px-5 py-2">Despesa Total (R$)</th>
                        <th className="text-left text-[#a3a3a3] text-xs font-medium px-5 py-2">Obs</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {projecoes.map((p) => {
                        const [y, m] = p.mes.split('-')
                        const mesLabel = `${m}/${y}`
                        const inputCategoria = (
                          campo: 'despesa_mao_obra' | 'despesa_material' | 'despesa_locacao_frota' | 'despesa_outros',
                        ) => (
                          <input
                            key={`${campo}-${p.id}-${p[campo]}`}
                            type="text"
                            inputMode="decimal"
                            defaultValue={p[campo] || ''}
                            placeholder="0"
                            onBlur={(e) => {
                              const v = parseValorBR(e.target.value) ?? 0
                              if (v !== p[campo]) void salvarProjecao(p.mes, { [campo]: v })
                            }}
                            className="w-24 rounded-lg px-2 py-1 text-xs text-right bg-[#2c2c2c] border border-[#525252] text-rose-300 outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]/40"
                          />
                        )
                        return (
                          <tr key={p.id} className="border-b border-[#525252]/50 hover:bg-[#484848]/40">
                            <td className="px-5 py-2 font-medium text-[#f5f5f5] whitespace-nowrap">{mesLabel}</td>
                            <td className="px-5 py-1.5 text-right">
                              <input
                                key={`r-${p.id}-${p.recebimento_prev}`}
                                type="text"
                                inputMode="decimal"
                                defaultValue={p.recebimento_prev || ''}
                                placeholder="0"
                                onBlur={(e) => {
                                  const v = parseValorBR(e.target.value) ?? 0
                                  if (v !== p.recebimento_prev) void salvarProjecao(p.mes, { recebimento_prev: v })
                                }}
                                className="w-32 rounded-lg px-2 py-1 text-xs text-right bg-[#2c2c2c] border border-[#525252] text-emerald-300 outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]/40"
                              />
                            </td>
                            <td className="px-5 py-1.5 text-right">{inputCategoria('despesa_mao_obra')}</td>
                            <td className="px-5 py-1.5 text-right">{inputCategoria('despesa_material')}</td>
                            <td className="px-5 py-1.5 text-right">{inputCategoria('despesa_locacao_frota')}</td>
                            <td className="px-5 py-1.5 text-right">{inputCategoria('despesa_outros')}</td>
                            <td className="px-5 py-1.5 text-right text-rose-400 font-mono font-bold">{fmt(p.despesa_prev)}</td>
                            <td className="px-5 py-1.5">
                              <input
                                key={`o-${p.id}-${p.obs ?? ''}`}
                                type="text"
                                defaultValue={p.obs ?? ''}
                                placeholder="—"
                                onBlur={(e) => {
                                  const v = e.target.value.trim() || null
                                  if (v !== (p.obs ?? null)) void salvarProjecao(p.mes, { obs: v })
                                }}
                                className="w-full rounded-lg px-2 py-1 text-xs bg-[#2c2c2c] border border-[#525252] text-[#f5f5f5] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]/40"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <button
                                onClick={() => void excluirProjecao(p.id)}
                                title="Excluir mês da projeção"
                                className="text-[#6b6b6b] hover:text-rose-400 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                <div className="px-5 py-2.5 border-t border-[#525252] text-[10px] text-[#6b6b6b]">
                  Meses passados e o mês corrente usam sempre o <b>realizado</b> dos lançamentos — a projeção vale só para meses futuros. Editar um campo salva automaticamente ao sair.
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ CUSTO POR TRECHO ═══ */}
        {tab === 'fcp' && <FcpPanel />}

        {tab === 'caixa' && <CaixaPanel />}

        {tab === 'custos' && (
          <>
            {trechosView.length > 0 && <InsightsPanel
              insights={generateCustoTrechoInsights({ variacaoMedia, totalTrechos: trechosView.length, trechosAbaixo: trechosView.filter(t => t.variacao < 0).length })}
              title="Insights — Custo por Trecho"
            />}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DreKpiCard label="Total Trechos" value={kv(trechosView.length)} note={kn()} icon={Layers} color="#f97316" />
              <DreKpiCard label="Custo Total" value={kv(totalTrechosCusto)} isCurrency note={kn()} icon={DollarSign} color="#34d399" />
              <DreKpiCard label="Custo Médio/m" value={kv(totalExt > 0 ? totalTrechosCusto / totalExt : 0)} isCurrency note={kn()} icon={Calculator} color="#c084fc" sub="Média ponderada" tooltip={TOOLTIPS.custoUnitario} dataTour="custo-unitario" />
              <DreKpiCard
                label="Variação Média"
                value={carregando ? null : (temVariacaoReal ? fmtPct(variacaoMedia) : '—')}
                note={kn()}
                icon={Shield}
                color={!temVariacaoReal ? '#9ca3af' : variacaoMedia > 0 ? '#fb923c' : '#4ade80'}
                sub={temVariacaoReal ? (variacaoMedia < 0 ? 'Abaixo do orçamento' : variacaoMedia > 0 ? 'Acima do orçamento' : 'Dentro do orçamento') : 'sem trechos executados com variação apurada'}
                trend={temVariacaoReal ? (variacaoMedia > 0 ? 'down' : 'up') : 'neutral'}
                tooltip={TOOLTIPS.variacaoCusto}
                dataTour="variacao"
              />
            </div>

            {carregando ? avisoCarregando : (
            <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#525252] flex items-center justify-between">
                <SectionTitle icon={Calculator}>Garantia de Custo por Trecho — Planejado vs Real</SectionTitle>
                <span className="text-[10px] text-[#a3a3a3] bg-[#2c2c2c] px-3 py-1 rounded-full border border-[#525252]">
                  {connectionStatus === 'connected' ? 'Canonico' : connectionStatus === 'partial' ? 'Parcial' : isRealData ? 'Dados Locais' : 'Local'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#525252]/50">
                      <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2">Trecho</th>
                      <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Ext. (m)</th>
                      <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">DN</th>
                      <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Prof. (m)</th>
                      <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">R$/m</th>
                      <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Custo Total</th>
                      <th className="text-center text-[#a3a3a3] text-xs font-medium px-4 py-2">Status</th>
                      <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trechosView.map((t, i) => (
                      <tr key={i} className="border-b border-[#525252]/50 hover:bg-[#484848]/40">
                        <td className="px-4 py-2.5 font-mono text-[#f97316] font-medium">{t.trecho}</td>
                        <td className="px-4 py-2.5 text-right text-[#f5f5f5]">{t.extensao}</td>
                        <td className="px-4 py-2.5 text-right text-[#a3a3a3]">DN{t.dn}</td>
                        <td className="px-4 py-2.5 text-right text-[#a3a3a3]">{Number(t.profundidade).toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-right text-[#f5f5f5] font-mono">{fmt(Number(t.custo_unitario))}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-400 font-mono">{fmt(Number(t.custo_total))}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            t.status === 'executado' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            t.status === 'em execução' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>{String(t.status).toUpperCase()}</span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold font-mono ${
                          t.variacao < 0 ? 'text-green-400' : t.variacao > 0 ? 'text-orange-400' : 'text-[#6b6b6b]'
                        }`}>
                          {t.variacao !== 0 ? fmtPct(t.variacao) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#f97316]/30 bg-[#f97316]/10">
                      <td className="px-4 py-3 font-bold text-[#f97316]">TOTAL</td>
                      <td className="px-4 py-3 text-right font-bold text-[#f5f5f5]">{totalExt}m</td>
                      <td colSpan={3} />
                      <td className="px-4 py-3 text-right font-bold text-emerald-400 font-mono text-sm">{fmt(totalTrechosCusto)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            )}
          </>
        )}

        {/* ═══ EFICIÊNCIA ═══ */}
        {/* Comparativo manual × ConstruDataMax é uma estimativa de mercado (argumento comercial),
            não uma medição feita nesta obra — nenhuma tabela do banco rastreia "horas economizadas
            por usar a plataforma" por projeto. Por isso só aparece no Modo Demonstração; fora dele
            mostramos o aviso honesto em vez de fingir que é dado real do WCR. */}
        {tab === 'eficiencia' && !usarFallback && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="text-xs text-amber-200/90 leading-relaxed">
              <b className="text-amber-300">Este comparativo é uma estimativa de mercado, não uma medição desta obra.</b> Nenhuma tabela do sistema (lançamentos, medição, fluxo de caixa) registra quantas horas a equipe economiza por usar a plataforma — não existe hoje como calcular esse número real por projeto. Ative o <b>Modo Demonstração</b> na barra lateral para ver o exemplo ilustrativo completo.
            </span>
          </div>
        )}
        {tab === 'eficiencia' && usarFallback && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DreKpiCard label="Economia Mensal" value={EFICIENCIA.impactoFinanceiro.economiaMensal} isCurrency icon={DollarSign} color="#34d399" trend="up" sub="vs. processo manual" tooltip={TOOLTIPS.eficiencia} dataTour="economia-mensal" />
              <DreKpiCard label="Economia Anual" value={EFICIENCIA.impactoFinanceiro.economiaAnual} isCurrency icon={TrendingUp} color="#f97316" trend="up" />
              <DreKpiCard label="ROI" value={`${EFICIENCIA.impactoFinanceiro.roi}%`} icon={Target} color="#c084fc" trend="up" sub="Retorno sobre investimento" tooltip={TOOLTIPS.roi} />
              <DreKpiCard label="Payback" value={`${EFICIENCIA.impactoFinanceiro.paybackDias} dias`} icon={Clock} color="#facc15" trend="up" sub="Tempo para se pagar" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#525252]"><SectionTitle icon={Target}>O que você ganha de eficiência?</SectionTitle></div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#525252]/50">
                      <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-2">Processo</th>
                      <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Manual</th>
                      <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">ConstruData</th>
                      <th className="text-right text-[#a3a3a3] text-xs font-medium px-4 py-2">Economia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EFICIENCIA.economia.map((e, i) => (
                      <tr key={i} className="border-b border-[#525252]/50 hover:bg-[#484848]/40">
                        <td className="px-4 py-2.5 text-[#f5f5f5]">{e.item}</td>
                        <td className="px-4 py-2.5 text-right text-rose-400 font-mono">{e.semPlataforma} {e.unidade.split('/')[0]}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-400 font-mono font-bold">{e.comPlataforma} {e.unidade.split('/')[0]}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
                            {e.economia.toFixed(0)}% ↓
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-5">
                <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
                  <SectionTitle icon={Users}>Impacto Financeiro Mensal</SectionTitle>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center">
                      <div className="text-[10px] text-rose-300 uppercase font-bold mb-1">Sem Plataforma</div>
                      <div className="text-2xl font-bold text-rose-400">{fmt(EFICIENCIA.impactoFinanceiro.custoEquipeTradicional)}</div>
                      <div className="text-[10px] text-rose-300/60 mt-1">5 engenheiros + 3 cadistas</div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                      <div className="text-[10px] text-emerald-300 uppercase font-bold mb-1">Com ConstruDataMax</div>
                      <div className="text-2xl font-bold text-emerald-400">{fmt(EFICIENCIA.impactoFinanceiro.custoComPlataforma)}</div>
                      <div className="text-[10px] text-emerald-300/60 mt-1">1 operador + licença</div>
                    </div>
                  </div>
                  <div className="mt-4 bg-[#f97316]/10 border border-[#f97316]/20 rounded-xl p-4 text-center">
                    <div className="text-[10px] text-orange-300 uppercase font-bold mb-1">Economia Líquida</div>
                    <div className="text-3xl font-bold text-[#f97316]">{fmt(EFICIENCIA.impactoFinanceiro.economiaMensal)}/mês</div>
                    <div className="text-xs text-orange-300/60 mt-1">= {fmt(EFICIENCIA.impactoFinanceiro.economiaAnual)}/ano · ROI {EFICIENCIA.impactoFinanceiro.roi}%</div>
                  </div>
                </div>

                <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
                  <SectionTitle icon={Shield}>Garantias da Plataforma</SectionTitle>
                  <div className="space-y-3">
                    {[
                      'Custo de cada trecho calculado por algoritmo — rastreável e auditável',
                      'Medição automática conferida contra contrato — zero supramedição',
                      'NS gerada em 5 minutos vs 4 horas manual — 98% de redução',
                      'Topografia interpolada automaticamente do GSI para o cadastro',
                      'DRE e fluxo de caixa em tempo real — decisão instantânea',
                    ].map((g, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-[#f5f5f5] leading-relaxed">{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {showLancamentoModal && activeProjectId && (
        <LancamentoManualModal
          projectId={activeProjectId}
          onClose={() => setShowLancamentoModal(false)}
          onSaved={refresh}
        />
      )}
      {showImportModal && activeProjectId && (
        <ImportarCsvModal
          projectId={activeProjectId}
          onClose={() => setShowImportModal(false)}
          onSaved={refresh}
        />
      )}
      {showFluxoCsvModal && activeProjectId && (
        <ImportarCsvFluxoModal
          projectId={activeProjectId}
          onClose={() => setShowFluxoCsvModal(false)}
          onSaved={reloadProjecoes}
        />
      )}
    </div>
  )
}
