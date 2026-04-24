/**
 * DRE & Resultado Financeiro — Módulo completo de análise econômica
 * Dados reais via Supabase (lancamentos_financeiros + trechos_custo)
 */
import { useState } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, ArrowUpRight,
  ArrowDownRight, PieChart, Wallet, Receipt, Calculator,
  CheckCircle2, AlertTriangle, Target, Layers, Clock,
  Users, Shield, RefreshCw,
} from 'lucide-react'
import { InfoTooltip, TOOLTIPS } from '@/components/ui/InfoTooltip'
import { InsightsPanel, generateDreInsights, generateFluxoCaixaInsights, generateCustoTrechoInsights } from '@/components/ui/InsightBanner'
import { TourButton } from '@/components/ui/GuidedTour'
import { useProjectContext } from '@/store/projectContext'
import { useSupabaseDre } from '@/lib/useSupabaseDre'

type TabId = 'dre' | 'fluxo' | 'eficiencia' | 'custos'

const CONTRATOS: Record<string, { numero: string; empresa: string; cliente: string; cidade: string; valorContrato: number; prazoMeses: number }> = {
    'abe7f66c-004b-4bb5-a245-6be67debd9f7': { numero: 'CT 11481051', empresa: 'ConstruDataMax Engenharia', cliente: 'SABESP', cidade: 'Santos / Osasco', valorContrato: 18_750_000, prazoMeses: 18 },
  'ec112c9a-1669-4287-8079-526d6940ce82': { numero: 'CT-PARDINHO-2026', empresa: 'Consórcio Itapetininga', cliente: 'Prefeitura Pardinho', cidade: 'Pardinho-SP', valorContrato: 32_000_000, prazoMeses: 21 },
  'f3c6645b-347f-4382-b9c5-d103c27ec511': { numero: 'CT-CLU-OSC-2026', empresa: 'Consórcio CLU Osasco', cliente: 'SABESP / Prefeitura Osasco', cidade: 'Osasco-SP', valorContrato: 28_000_000, prazoMeses: 24 },
  'c2bf8fda-b2e0-4bc1-9535-4891d596ea10': { numero: 'CT-TATUI-2026', empresa: 'RK', cliente: 'RK', cidade: 'Tatui-SP', valorContrato: 18_000_000, prazoMeses: 18 },
  '2a28beec-b1f8-4b0c-8416-d0710bb35d9d': { numero: 'CT-11481051', empresa: 'ConstruData Brasilia', cliente: 'ConstruData', cidade: 'Brasilia-DF', valorContrato: 12_000_000, prazoMeses: 12 },
  'd4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8': { numero: 'RK-SUB-2026', empresa: 'RK Subempreita', cliente: 'RK', cidade: 'Santos-SP', valorContrato: 9_500_000, prazoMeses: 12 },
}
const DEFAULT_CONTRATO = CONTRATOS['abe7f66c-004b-4bb5-a245-6be67debd9f7']

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
  const { activeProjectId } = useProjectContext()
  const CONTRATO = (activeProjectId && CONTRATOS[activeProjectId]) || DEFAULT_CONTRATO

  const { lancamentos, trechos, loading, connectionStatus, refresh } = useSupabaseDre(activeProjectId)

  // Dados reais ou fallback
  const receitasDB = lancamentos.filter(x => x.tipo === 'RECEITA').map(x => ({ desc: x.descricao, valor: Number(x.valor) }))
  const despesasDB = lancamentos.filter(x => x.tipo === 'DESPESA').map(x => ({ desc: x.descricao, valor: Number(x.valor) }))

  const receitasList = receitasDB.length > 0 ? receitasDB : DRE_FALLBACK.receitas
  const despesasList = despesasDB.length > 0 ? despesasDB : DRE_FALLBACK.custosDiretos
  const trechosView = trechos.length > 0 ? trechos : TRECHOS_FALLBACK

  const totalReceita = receitasList.reduce((a, r) => a + r.valor, 0)
  const totalCustoDir = despesasList.reduce((a, c) => a + c.valor, 0)
  const totalCustoInd = DRE_FALLBACK.custosIndiretos.reduce((a, c) => a + c.valor, 0)
  const totalImpostos = DRE_FALLBACK.impostos.reduce((a, i) => a + i.valor, 0)
  const lucroBruto = totalReceita - totalCustoDir
  const lucroOperacional = lucroBruto - totalCustoInd
  const lucroLiquido = lucroOperacional - totalImpostos
  const margemBruta = totalReceita > 0 ? (lucroBruto / totalReceita) * 100 : 0
  const margemLiquida = totalReceita > 0 ? (lucroLiquido / totalReceita) * 100 : 0
  const totalTrechosCusto = trechosView.reduce((a, t) => a + Number(t.custo_total), 0)
  const totalExt = trechosView.reduce((a, t) => a + Number(t.extensao), 0)

  const isRealData = lancamentos.length > 0 || trechos.length > 0

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
          <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {connectionStatus === 'connected' ? 'Canonico' : connectionStatus === 'partial' ? 'Parcial' : isRealData ? 'Dados Locais' : 'Local'}
          </button>
          <div className="text-right">
            <div className="text-[10px] text-[#5a8caa] uppercase">Valor Contrato</div>
            <div className="text-sm font-bold text-emerald-400">{fmt(CONTRATO.valorContrato)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#5a8caa] uppercase">Prazo</div>
            <div className="text-sm font-bold text-[#e4f2f8]">{CONTRATO.prazoMeses} meses</div>
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

        {/* ═══ DRE ═══ */}
        {tab === 'dre' && (
          <>
            <InsightsPanel insights={generateDreInsights({ margemBruta, margemLiquida, lucroLiquido, totalReceita })} title="Insights — O que os dados dizem?" />
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
                  {DRE_FALLBACK.custosIndiretos.map((c, i) => (
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
                  {DRE_FALLBACK.impostos.map((imp, i) => (
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
            <InsightsPanel
              insights={generateFluxoCaixaInsights({ saldoAtual: FLUXO_CAIXA[FLUXO_CAIXA.length-1].saldo, mesBreakeven: 'Fev/2026', totalRecebido: FLUXO_CAIXA.reduce((a,f)=>a+f.recebido,0), totalGasto: FLUXO_CAIXA.reduce((a,f)=>a+f.gasto,0) })}
              title="Insights — Fluxo de Caixa"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total Recebido" value={fmt(FLUXO_CAIXA.reduce((a, f) => a + f.recebido, 0))} icon={TrendingUp} color="text-emerald-400" trend="up" tooltip={TOOLTIPS.fluxoCaixa} />
              <KpiCard label="Total Gasto" value={fmt(FLUXO_CAIXA.reduce((a, f) => a + f.gasto, 0))} icon={TrendingDown} color="text-rose-400" trend="down" />
              <KpiCard label="Saldo Atual" value={fmt(FLUXO_CAIXA[FLUXO_CAIXA.length - 1].saldo)} icon={Wallet} color="text-cyan-400" trend="up" sub="Acumulado" />
              <KpiCard label="Breakeven" value="Fev/2026" icon={Target} color="text-yellow-400" sub="Mês 6 — projeto vira positivo" tooltip={TOOLTIPS.breakeven} dataTour="breakeven" />
            </div>

            <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#20406a]"><SectionTitle icon={Wallet}>Fluxo de Caixa Mensal</SectionTitle></div>
              <div className="px-5 py-4 border-b border-[#20406a]">
                <div className="flex items-end gap-2 h-40">
                  {FLUXO_CAIXA.map((f, i) => {
                    const maxVal = Math.max(...FLUXO_CAIXA.map(x => Math.max(x.recebido, x.gasto)))
                    const hReceita = (f.recebido / maxVal) * 100
                    const hGasto = (f.gasto / maxVal) * 100
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="flex gap-0.5 items-end h-32 w-full justify-center">
                          <div className="w-[45%] bg-emerald-500/60 rounded-t-sm transition-all" style={{ height: `${hReceita}%` }} />
                          <div className="w-[45%] bg-rose-500/60 rounded-t-sm transition-all" style={{ height: `${hGasto}%` }} />
                        </div>
                        <span className="text-[9px] text-[#5a8caa]">{f.mes}</span>
                        <span className={`text-[9px] font-bold ${f.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {f.saldo >= 0 ? '+' : ''}{(f.saldo / 1000).toFixed(0)}k
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 mt-3 justify-center text-[10px] text-[#5a8caa]">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/60" /> Recebido</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/60" /> Gasto</span>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-2.5">Mês</th>
                    <th className="text-right px-5 py-2.5">Recebido</th>
                    <th className="text-right px-5 py-2.5">Gasto</th>
                    <th className="text-right px-5 py-2.5">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {FLUXO_CAIXA.map((f, i) => (
                    <tr key={i} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                      <td className="px-5 py-2 font-medium text-[#e4f2f8]">{f.mes}</td>
                      <td className="px-5 py-2 text-right text-emerald-400 font-mono">{fmt(f.recebido)}</td>
                      <td className="px-5 py-2 text-right text-rose-400 font-mono">({fmt(f.gasto)})</td>
                      <td className={`px-5 py-2 text-right font-bold font-mono ${f.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(f.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ═══ CUSTO POR TRECHO ═══ */}
        {tab === 'custos' && (
          <>
            <InsightsPanel
              insights={generateCustoTrechoInsights({ variacaoMedia: -0.8, totalTrechos: trechosView.length, trechosAbaixo: trechosView.filter(t => t.variacao < 0).length })}
              title="Insights — Custo por Trecho"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total Trechos" value={String(trechosView.length)} icon={Layers} color="text-cyan-400" />
              <KpiCard label="Custo Total" value={fmt(totalTrechosCusto)} icon={DollarSign} color="text-emerald-400" />
              <KpiCard label="Custo Médio/m" value={fmt(totalExt > 0 ? totalTrechosCusto / totalExt : 0)} icon={Calculator} color="text-purple-400" sub="Média ponderada" tooltip={TOOLTIPS.custoUnitario} dataTour="custo-unitario" />
              <KpiCard label="Variação Média" value="-0.8%" icon={Shield} color="text-green-400" sub="Abaixo do orçamento" trend="up" tooltip={TOOLTIPS.variacaoCusto} dataTour="variacao" />
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
        {tab === 'eficiencia' && (
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
    </div>
  )
}

