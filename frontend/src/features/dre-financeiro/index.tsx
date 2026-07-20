/**
 * DRE & Resultado Financeiro — Módulo completo de análise econômica
 * Dados reais via Supabase (lancamentos_financeiros + trechos_custo)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, ArrowUpRight,
  ArrowDownRight, PieChart, Wallet, Receipt, Calculator,
  CheckCircle2, AlertTriangle, Target, Layers, Clock,
  Users, Shield, RefreshCw, Plus, Upload, Trash2, Wand2,
} from 'lucide-react'
import { InfoTooltip, TOOLTIPS } from '@/components/ui/InfoTooltip'
import { InsightsPanel, generateDreInsights, generateFluxoCaixaInsights, generateCustoTrechoInsights } from '@/components/ui/InsightBanner'
import { TourButton } from '@/components/ui/GuidedTour'
import { useProjectContext, selectActiveProjeto } from '@/store/projectContext'
import { useSupabaseDre } from '@/lib/useSupabaseDre'
import { useAppModeStore } from '@/store/appModeStore'
import { LancamentoManualModal } from './components/LancamentoManualModal'
import { ImportarCsvModal } from './components/ImportarCsvModal'
import { ImportarCsvFluxoModal } from './components/ImportarCsvFluxoModal'
import { computeFluxoCaixa, type OrigemMes } from './utils/computeFluxoCaixa'
import { parseValorBR } from './utils/parseCsvLancamentos'
import { useFluxoProjecao } from '@/hooks/useFluxoProjecao'

type TabId = 'dre' | 'fluxo' | 'eficiencia' | 'custos'

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

// Fallbacks enquanto tabelas não têm dados reais
const DRE_FALLBACK = {
  receitas: [
    { desc: 'Medição Rede Coletora (Jan-Mar)', valor: 2_845_000 },
    { desc: 'Medição Ligações Prediais', valor: 892_000 },
    { desc: 'Medição Poços de Visita', valor: 1_234_000 },
    { desc: 'Reajustamento Contratual', valor: 187_500 },
    { desc: 'Serviços Extras Aprovados (CO)', valor: 345_000 },
  ],
  custosDiretos: [
    { desc: 'Mão de Obra Direta (120 colaboradores)', valor: 1_890_000 },
    { desc: 'Materiais (Tubos PVC, PEAD, CAP)', valor: 1_245_000 },
    { desc: 'Equipamentos e Maquinário', valor: 678_000 },
    { desc: 'Transporte e Logística', valor: 234_000 },
    { desc: 'Subempreiteiros (Pavimentação, etc.)', valor: 567_000 },
  ],
  custosIndiretos: [
    { desc: 'Administração Local (Staff técnico)', valor: 345_000 },
    { desc: 'Canteiro e Instalações', valor: 89_000 },
    { desc: 'Seguros e Garantias', valor: 56_000 },
    { desc: 'Mobilização/Desmobilização', valor: 123_000 },
  ],
  impostos: [
    { desc: 'ISS (5%)', valor: 267_400 },
    { desc: 'PIS/COFINS (3.65%)', valor: 195_000 },
    { desc: 'IR/CSLL estimado', valor: 312_000 },
  ],
}

const FLUXO_CAIXA = [
  { mes: 'Out/25', recebido: 450_000, gasto: 1_200_000, saldo: -750_000 },
  { mes: 'Nov/25', recebido: 1_100_000, gasto: 1_450_000, saldo: -1_100_000 },
  { mes: 'Dez/25', recebido: 1_800_000, gasto: 1_380_000, saldo: -680_000 },
  { mes: 'Jan/26', recebido: 2_100_000, gasto: 1_520_000, saldo: -100_000 },
  { mes: 'Fev/26', recebido: 2_400_000, gasto: 1_480_000, saldo: 820_000 },
  { mes: 'Mar/26', recebido: 2_650_000, gasto: 1_560_000, saldo: 1_910_000 },
]

const TRECHOS_FALLBACK = [
  { trecho: 'PV-001 → PV-008', extensao: 245, dn: 200, profundidade: 2.8, custo_unitario: 485.30, custo_total: 118_898, status: 'executado', variacao: -3.2 },
  { trecho: 'PV-008 → PV-015', extensao: 312, dn: 250, profundidade: 3.2, custo_unitario: 612.45, custo_total: 191_084, status: 'executado', variacao: 1.8 },
  { trecho: 'PV-015 → PV-022', extensao: 189, dn: 200, profundidade: 2.5, custo_unitario: 445.20, custo_total: 84_142, status: 'executado', variacao: -5.1 },
  { trecho: 'PV-022 → PV-030', extensao: 278, dn: 300, profundidade: 3.8, custo_unitario: 789.90, custo_total: 219_592, status: 'em execução', variacao: 2.3 },
  { trecho: 'PV-030 → PV-038', extensao: 356, dn: 300, profundidade: 4.1, custo_unitario: 845.00, custo_total: 300_820, status: 'planejado', variacao: 0.0 },
]

const EFICIENCIA = {
  economia: [
    { item: 'Redução de retrabalho em cadastro', semPlataforma: 180, comPlataforma: 24, unidade: 'horas/mês', economia: 86.7 },
    { item: 'Tempo de geração de NS', semPlataforma: 4, comPlataforma: 0.08, unidade: 'horas/NS', economia: 98.0 },
    { item: 'Conferência de medição', semPlataforma: 40, comPlataforma: 2, unidade: 'horas/medição', economia: 95.0 },
    { item: 'Geração de RDO em campo', semPlataforma: 2.5, comPlataforma: 0.3, unidade: 'horas/RDO', economia: 88.0 },
    { item: 'Planejamento semanal (LPS)', semPlataforma: 16, comPlataforma: 1.5, unidade: 'horas/semana', economia: 90.6 },
    { item: 'Relatório para fiscalização', semPlataforma: 24, comPlataforma: 0.5, unidade: 'horas/relatório', economia: 97.9 },
  ],
  impactoFinanceiro: { custoEquipeTradicional: 47_500, custoComPlataforma: 8_200, economiaMensal: 39_300, economiaAnual: 471_600, roi: 1250, paybackDias: 15 },
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}
function fmtPct(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` }

function KpiCard({ label, value, sub, icon: Icon, color, trend, tooltip, dataTour }: {
  label: string; value: string; sub?: string; icon: any; color: string; trend?: 'up' | 'down' | 'neutral'
  tooltip?: any; dataTour?: string
}) {
  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4 hover:border-[#2abfdc]/30 transition-colors" data-tour={dataTour}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider flex items-center gap-1">
          {label}
          {tooltip && <InfoTooltip content={tooltip} position="bottom" size={11} />}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').replace('400', '500/15')}`}>
          <Icon size={16} className={color} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-[#e4f2f8]">{value}</span>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold pb-0.5 ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-rose-400' : 'text-[#5a8caa]'}`}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : trend === 'down' ? <ArrowDownRight size={12} /> : null}
          </span>
        )}
      </div>
      {sub && <span className="text-[10px] text-[#5a8caa] mt-1 block">{sub}</span>}
    </div>
  )
}

function ProgressBar({ value, max, color = 'bg-cyan-500', height = 'h-2' }: { value: number; max: number; color?: string; height?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 ${height} bg-[#0d2040] rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-[#8fb3c8] w-10 text-right">{pct}%</span>
    </div>
  )
}

function SectionTitle({ children, icon: Icon }: { children: string; icon: any }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-cyan-400" />
      <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">{children}</h3>
    </div>
  )
}

export function DreFinanceiroPage() {
  const [tab, setTab] = useState<TabId>('dre')
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

  const TABS = [
    { id: 'dre' as TabId, label: 'DRE', icon: Receipt },
    { id: 'fluxo' as TabId, label: 'Fluxo de Caixa', icon: Wallet },
    { id: 'custos' as TabId, label: 'Custo por Trecho', icon: Calculator },
    { id: 'eficiencia' as TabId, label: 'Eficiência da Plataforma', icon: Target },
  ]

  return (
    <div className="flex flex-col h-full bg-[#0a1628]">
      {/* Header */}
      <header className="shrink-0 border-b border-[#20406a] bg-[#0d2040] px-6 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <DollarSign size={22} className="text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[#e4f2f8]">Resultado Econômico & DRE</h1>
          <p className="text-xs text-[#5a8caa]">{CONTRATO.numero} — {CONTRATO.cliente} — {CONTRATO.cidade}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowLancamentoModal(true)}
            disabled={!podeLancar}
            title={motivoBloqueio}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10"
          >
            <Plus size={12} /> Lançamento
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            disabled={!podeLancar}
            title={motivoBloqueio}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs font-semibold hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-500/10"
          >
            <Upload size={12} /> Importar CSV
          </button>
          <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {connectionStatus === 'connected' ? 'Canonico' : connectionStatus === 'partial' ? 'Parcial' : isRealData ? 'Dados Locais' : 'Local'}
          </button>
          <div className="text-right">
            <div className="text-[10px] text-[#5a8caa] uppercase">Valor Contrato</div>
            <div className="text-sm font-bold text-emerald-400">{CONTRATO.valorContrato > 0 ? fmt(CONTRATO.valorContrato) : '—'}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#5a8caa] uppercase">Prazo</div>
            <div className="text-sm font-bold text-[#e4f2f8]">{CONTRATO.prazoMeses > 0 ? `${CONTRATO.prazoMeses} meses` : '—'}</div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="shrink-0 border-b border-[#20406a] bg-[#0a1628] px-6 flex gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              tab === t.id ? 'text-emerald-400 border-emerald-400' : 'text-[#6b6b6b] border-transparent hover:text-[#8fb3c8]'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto p-6 space-y-5">

        {semDadoReal && (
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
              <KpiCard label="Receita Bruta" value={fmt(totalReceita)} icon={TrendingUp} color="text-emerald-400" trend="up" sub="Acumulado" tooltip={TOOLTIPS.receitaBruta} dataTour="receita-bruta" />
              <KpiCard label="Custo Direto" value={fmt(totalCustoDir)} icon={TrendingDown} color="text-rose-400" trend="down" tooltip={TOOLTIPS.custoDirecto} dataTour="custo-direto" />
              <KpiCard label="Lucro Bruto" value={fmt(lucroBruto)} icon={BarChart3} color="text-cyan-400" trend="up" sub={`Margem: ${margemBruta.toFixed(1)}%`} tooltip={TOOLTIPS.lucroBruto} dataTour="lucro-bruto" />
              <KpiCard label="Lucro Operacional" value={fmt(lucroOperacional)} icon={PieChart} color="text-purple-400" trend="up" />
              <KpiCard label="Impostos" value={fmt(totalImpostos)} icon={Receipt} color="text-yellow-400" trend="down" />
              <KpiCard label="Lucro Líquido" value={fmt(lucroLiquido)} icon={DollarSign} color="text-emerald-400" trend="up" sub={`Margem: ${margemLiquida.toFixed(1)}%`} tooltip={TOOLTIPS.lucroLiquido} dataTour="lucro-liquido" />
            </div>

            <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#20406a]">
                <SectionTitle icon={Receipt}>Demonstrativo de Resultado do Exercício</SectionTitle>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-2.5">Descrição</th>
                    <th className="text-right px-5 py-2.5">Valor (R$)</th>
                    <th className="text-right px-5 py-2.5">% s/ Receita</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-emerald-500/5"><td className="px-5 py-2 font-bold text-emerald-400" colSpan={3}>RECEITAS</td></tr>
                  {receitasList.map((r, i) => (
                    <tr key={`r-${i}`} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                      <td className="px-5 py-2 text-[#e4f2f8] pl-8">{r.desc}</td>
                      <td className="px-5 py-2 text-right text-emerald-400 font-mono">{fmt(r.valor)}</td>
                      <td className="px-5 py-2 text-right text-[#8fb3c8] font-mono">{totalReceita > 0 ? ((r.valor / totalReceita) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-emerald-500/30 bg-emerald-500/10">
                    <td className="px-5 py-2 font-bold text-emerald-400">TOTAL RECEITAS</td>
                    <td className="px-5 py-2 text-right font-bold text-emerald-400 font-mono">{fmt(totalReceita)}</td>
                    <td className="px-5 py-2 text-right font-bold text-emerald-400 font-mono">100.0%</td>
                  </tr>

                  <tr className="bg-rose-500/5 mt-2"><td className="px-5 py-2 font-bold text-rose-400 pt-4" colSpan={3}>(-) CUSTOS DIRETOS</td></tr>
                  {despesasList.map((c, i) => (
                    <tr key={`c-${i}`} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                      <td className="px-5 py-2 text-[#e4f2f8] pl-8">{c.desc}</td>
                      <td className="px-5 py-2 text-right text-rose-400 font-mono">({fmt(c.valor)})</td>
                      <td className="px-5 py-2 text-right text-[#8fb3c8] font-mono">{totalReceita > 0 ? ((c.valor / totalReceita) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-rose-500/30 bg-rose-500/10">
                    <td className="px-5 py-2 font-bold text-rose-400">TOTAL CUSTOS DIRETOS</td>
                    <td className="px-5 py-2 text-right font-bold text-rose-400 font-mono">({fmt(totalCustoDir)})</td>
                    <td className="px-5 py-2 text-right font-bold text-rose-400 font-mono">{totalReceita > 0 ? ((totalCustoDir / totalReceita) * 100).toFixed(1) : 0}%</td>
                  </tr>

                  <tr className="border-t-2 border-cyan-500/30 bg-cyan-500/10">
                    <td className="px-5 py-3 font-bold text-cyan-400 text-sm">= LUCRO BRUTO</td>
                    <td className="px-5 py-3 text-right font-bold text-cyan-400 text-sm font-mono">{fmt(lucroBruto)}</td>
                    <td className="px-5 py-3 text-right font-bold text-cyan-400 font-mono">{margemBruta.toFixed(1)}%</td>
                  </tr>

                  <tr className="bg-yellow-500/5"><td className="px-5 py-2 font-bold text-yellow-400 pt-4" colSpan={3}>(-) CUSTOS INDIRETOS</td></tr>
                  {custosIndiretosList.map((c, i) => (
                    <tr key={`ci-${i}`} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                      <td className="px-5 py-2 text-[#e4f2f8] pl-8">{c.desc}</td>
                      <td className="px-5 py-2 text-right text-yellow-400 font-mono">({fmt(c.valor)})</td>
                      <td className="px-5 py-2 text-right text-[#8fb3c8] font-mono">{totalReceita > 0 ? ((c.valor / totalReceita) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}

                  <tr className="border-t-2 border-purple-500/30 bg-purple-500/10">
                    <td className="px-5 py-3 font-bold text-purple-400 text-sm">= LUCRO OPERACIONAL (EBITDA)</td>
                    <td className="px-5 py-3 text-right font-bold text-purple-400 text-sm font-mono">{fmt(lucroOperacional)}</td>
                    <td className="px-5 py-3 text-right font-bold text-purple-400 font-mono">{totalReceita > 0 ? ((lucroOperacional / totalReceita) * 100).toFixed(1) : 0}%</td>
                  </tr>

                  <tr className="bg-orange-500/5"><td className="px-5 py-2 font-bold text-orange-400 pt-4" colSpan={3}>(-) IMPOSTOS E TRIBUTOS</td></tr>
                  {impostosList.map((imp, i) => (
                    <tr key={`imp-${i}`} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                      <td className="px-5 py-2 text-[#e4f2f8] pl-8">{imp.desc}</td>
                      <td className="px-5 py-2 text-right text-orange-400 font-mono">({fmt(imp.valor)})</td>
                      <td className="px-5 py-2 text-right text-[#8fb3c8] font-mono">{totalReceita > 0 ? ((imp.valor / totalReceita) * 100).toFixed(1) : 0}%</td>
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

            {semFluxoReal && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-200/90 leading-relaxed">
                  <b className="text-amber-300">Sem fluxo de caixa para esta obra.</b> A série mensal aparece quando houver lançamentos financeiros (meses passados/corrente) ou projeções cadastradas (meses futuros). Use <b>Gerar meses até o fim da obra</b> ou <b>Importar CSV</b> abaixo para começar a projeção — nada aqui é estimado ou de exemplo.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total Recebido" value={fmt(fluxoView.reduce((a, f) => a + f.recebido, 0))} icon={TrendingUp} color="text-emerald-400" trend="up" tooltip={TOOLTIPS.fluxoCaixa} />
              <KpiCard label="Total Gasto" value={fmt(fluxoView.reduce((a, f) => a + f.gasto, 0))} icon={TrendingDown} color="text-rose-400" trend="down" />
              <KpiCard label="Saldo Atual" value={fmt(fluxoView.length ? fluxoView[fluxoView.length - 1].saldoAcumulado : 0)} icon={Wallet} color="text-cyan-400" trend="up" sub="Acumulado" />
              <KpiCard label="Breakeven" value={fluxoView.length ? breakevenLabel : '—'} icon={Target} color="text-yellow-400" sub={fluxoView.length ? (breakevenLabel !== '—' ? `Saldo acumulado vira positivo em ${breakevenLabel}` : 'Não vira positivo no horizonte projetado') : 'sem dados de fluxo'} tooltip={TOOLTIPS.breakeven} dataTour="breakeven" />
            </div>

            {fluxoView.length > 0 && (
            <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#20406a]"><SectionTitle icon={Wallet}>Fluxo de Caixa Mensal</SectionTitle></div>
              <div className="px-5 py-4 border-b border-[#20406a]">
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
                        <span className="text-[9px] text-[#5a8caa]">{f.mes}{projetado ? '*' : ''}</span>
                        <span className={`text-[9px] font-bold ${f.saldoAcumulado >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {f.saldoAcumulado >= 0 ? '+' : ''}{(f.saldoAcumulado / 1000).toFixed(0)}k
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 mt-3 justify-center text-[10px] text-[#5a8caa]">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/60" /> Recebido</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/60" /> Gasto</span>
                  {!usarFallback && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-[#5a8caa]" /> * = mês projetado</span>}
                </div>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-2.5">Mês</th>
                    {!usarFallback && <th className="text-left px-5 py-2.5">Origem</th>}
                    <th className="text-right px-5 py-2.5">Recebido</th>
                    <th className="text-right px-5 py-2.5">Gasto</th>
                    <th className="text-right px-5 py-2.5">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {fluxoView.map((f, i) => (
                    <tr key={i} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                      <td className="px-5 py-2 font-medium text-[#e4f2f8]">{f.mes}</td>
                      {!usarFallback && (
                        <td className="px-5 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            f.origem === 'real' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
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
              <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#20406a] flex items-center justify-between flex-wrap gap-2">
                  <SectionTitle icon={Wand2}>Projeção dos meses futuros</SectionTitle>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => { if (fluxoDataFim) await gerarMesesAteFim(fluxoDataFim) }}
                      disabled={!fluxoDataFim}
                      title={fluxoDataFim ? `Gera meses zerados até ${fluxoDataFim}` : 'Projeto sem data de fim cadastrada'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs font-semibold hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Wand2 size={12} /> Gerar meses até o fim da obra
                    </button>
                    <button
                      onClick={() => setShowFluxoCsvModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs font-semibold hover:bg-cyan-500/20 transition-colors"
                    >
                      <Upload size={12} /> Importar CSV
                    </button>
                  </div>
                </div>
                {projecoes.length === 0 ? (
                  <div className="px-5 py-6 text-center text-xs text-[#5a8caa]">
                    Nenhuma projeção cadastrada. Clique em <b className="text-cyan-400">Gerar meses até o fim da obra</b> para criar as linhas dos meses futuros e depois preencha os valores previstos, ou <b className="text-cyan-400">Importar CSV</b>.
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-5 py-2.5">Mês</th>
                        <th className="text-right px-5 py-2.5">Recebimento Prev. (R$)</th>
                        <th className="text-right px-5 py-2.5">Mão de Obra (R$)</th>
                        <th className="text-right px-5 py-2.5">Material (R$)</th>
                        <th className="text-right px-5 py-2.5">Locação/Frota (R$)</th>
                        <th className="text-right px-5 py-2.5">Outros (R$)</th>
                        <th className="text-right px-5 py-2.5">Despesa Total (R$)</th>
                        <th className="text-left px-5 py-2.5">Obs</th>
                        <th className="px-3 py-2.5" />
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
                            className="w-24 rounded-lg px-2 py-1 text-xs text-right bg-[#0d2040] border border-[#20406a] text-rose-300 outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40"
                          />
                        )
                        return (
                          <tr key={p.id} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                            <td className="px-5 py-2 font-medium text-[#e4f2f8] whitespace-nowrap">{mesLabel}</td>
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
                                className="w-32 rounded-lg px-2 py-1 text-xs text-right bg-[#0d2040] border border-[#20406a] text-emerald-300 outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40"
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
                                className="w-full rounded-lg px-2 py-1 text-xs bg-[#0d2040] border border-[#20406a] text-[#e4f2f8] outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <button
                                onClick={() => void excluirProjecao(p.id)}
                                title="Excluir mês da projeção"
                                className="text-[#5a8caa] hover:text-rose-400 transition-colors"
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
                <div className="px-5 py-2.5 border-t border-[#20406a] text-[10px] text-[#5a8caa]">
                  Meses passados e o mês corrente usam sempre o <b>realizado</b> dos lançamentos — a projeção vale só para meses futuros. Editar um campo salva automaticamente ao sair.
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ CUSTO POR TRECHO ═══ */}
        {tab === 'custos' && (
          <>
            {trechosView.length > 0 && <InsightsPanel
              insights={generateCustoTrechoInsights({ variacaoMedia, totalTrechos: trechosView.length, trechosAbaixo: trechosView.filter(t => t.variacao < 0).length })}
              title="Insights — Custo por Trecho"
            />}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total Trechos" value={String(trechosView.length)} icon={Layers} color="text-cyan-400" />
              <KpiCard label="Custo Total" value={fmt(totalTrechosCusto)} icon={DollarSign} color="text-emerald-400" />
              <KpiCard label="Custo Médio/m" value={fmt(totalExt > 0 ? totalTrechosCusto / totalExt : 0)} icon={Calculator} color="text-purple-400" sub="Média ponderada" tooltip={TOOLTIPS.custoUnitario} dataTour="custo-unitario" />
              <KpiCard
                label="Variação Média"
                value={temVariacaoReal ? fmtPct(variacaoMedia) : '—'}
                icon={Shield}
                color={!temVariacaoReal ? 'text-gray-400' : variacaoMedia > 0 ? 'text-orange-400' : 'text-green-400'}
                sub={temVariacaoReal ? (variacaoMedia < 0 ? 'Abaixo do orçamento' : variacaoMedia > 0 ? 'Acima do orçamento' : 'Dentro do orçamento') : 'sem trechos executados com variação apurada'}
                trend={temVariacaoReal ? (variacaoMedia > 0 ? 'down' : 'up') : 'neutral'}
                tooltip={TOOLTIPS.variacaoCusto}
                dataTour="variacao"
              />
            </div>

            <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#20406a] flex items-center justify-between">
                <SectionTitle icon={Calculator}>Garantia de Custo por Trecho — Planejado vs Real</SectionTitle>
                <span className="text-[10px] text-[#5a8caa] bg-[#0d2040] px-3 py-1 rounded-full border border-[#20406a]">
                  {connectionStatus === 'connected' ? 'Canonico' : connectionStatus === 'partial' ? 'Parcial' : isRealData ? 'Dados Locais' : 'Local'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-2.5">Trecho</th>
                      <th className="text-right px-4 py-2.5">Ext. (m)</th>
                      <th className="text-right px-4 py-2.5">DN</th>
                      <th className="text-right px-4 py-2.5">Prof. (m)</th>
                      <th className="text-right px-4 py-2.5">R$/m</th>
                      <th className="text-right px-4 py-2.5">Custo Total</th>
                      <th className="text-center px-4 py-2.5">Status</th>
                      <th className="text-right px-4 py-2.5">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trechosView.map((t, i) => (
                      <tr key={i} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                        <td className="px-4 py-2.5 font-mono text-cyan-400 font-medium">{t.trecho}</td>
                        <td className="px-4 py-2.5 text-right text-[#e4f2f8]">{t.extensao}</td>
                        <td className="px-4 py-2.5 text-right text-[#8fb3c8]">DN{t.dn}</td>
                        <td className="px-4 py-2.5 text-right text-[#8fb3c8]">{Number(t.profundidade).toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-right text-[#e4f2f8] font-mono">{fmt(Number(t.custo_unitario))}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-400 font-mono">{fmt(Number(t.custo_total))}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            t.status === 'executado' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            t.status === 'em execução' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>{String(t.status).toUpperCase()}</span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold font-mono ${
                          t.variacao < 0 ? 'text-green-400' : t.variacao > 0 ? 'text-orange-400' : 'text-[#5a8caa]'
                        }`}>
                          {t.variacao !== 0 ? fmtPct(t.variacao) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-cyan-500/30 bg-cyan-500/10">
                      <td className="px-4 py-3 font-bold text-cyan-400">TOTAL</td>
                      <td className="px-4 py-3 text-right font-bold text-[#e4f2f8]">{totalExt}m</td>
                      <td colSpan={3} />
                      <td className="px-4 py-3 text-right font-bold text-emerald-400 font-mono text-sm">{fmt(totalTrechosCusto)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
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
              <KpiCard label="Economia Mensal" value={fmt(EFICIENCIA.impactoFinanceiro.economiaMensal)} icon={DollarSign} color="text-emerald-400" trend="up" sub="vs. processo manual" tooltip={TOOLTIPS.eficiencia} dataTour="economia-mensal" />
              <KpiCard label="Economia Anual" value={fmt(EFICIENCIA.impactoFinanceiro.economiaAnual)} icon={TrendingUp} color="text-cyan-400" trend="up" />
              <KpiCard label="ROI" value={`${EFICIENCIA.impactoFinanceiro.roi}%`} icon={Target} color="text-purple-400" trend="up" sub="Retorno sobre investimento" tooltip={TOOLTIPS.roi} />
              <KpiCard label="Payback" value={`${EFICIENCIA.impactoFinanceiro.paybackDias} dias`} icon={Clock} color="text-yellow-400" trend="up" sub="Tempo para se pagar" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#20406a]"><SectionTitle icon={Target}>O que você ganha de eficiência?</SectionTitle></div>
                <table className="w-full text-xs">
                  <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-2.5">Processo</th>
                      <th className="text-right px-4 py-2.5">Manual</th>
                      <th className="text-right px-4 py-2.5">ConstruData</th>
                      <th className="text-right px-4 py-2.5">Economia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EFICIENCIA.economia.map((e, i) => (
                      <tr key={i} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                        <td className="px-4 py-2.5 text-[#e4f2f8]">{e.item}</td>
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
                <div className="bg-[#112645] border border-[#20406a] rounded-xl p-5">
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
                  <div className="mt-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-center">
                    <div className="text-[10px] text-cyan-300 uppercase font-bold mb-1">Economia Líquida</div>
                    <div className="text-3xl font-bold text-cyan-400">{fmt(EFICIENCIA.impactoFinanceiro.economiaMensal)}/mês</div>
                    <div className="text-xs text-cyan-300/60 mt-1">= {fmt(EFICIENCIA.impactoFinanceiro.economiaAnual)}/ano · ROI {EFICIENCIA.impactoFinanceiro.roi}%</div>
                  </div>
                </div>

                <div className="bg-[#112645] border border-[#20406a] rounded-xl p-5">
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
                        <span className="text-xs text-[#e4f2f8] leading-relaxed">{g}</span>
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

