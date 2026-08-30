/**
 * CurvaSRealPanel — Curva S / EVM com dado REAL (E7), painel novo ao lado do
 * mock (Dashboard). Não toca no `evmStore` nem no motor mock — plugado via
 * `useEvmReal` (produção real + despesas reais + baseline do cronograma).
 *
 * Modo Demo ON  → aviso pra usar o Dashboard (mock) normal.
 * Modo Demo OFF, sem dado real (produção/despesa) → aviso honesto.
 * Modo Demo OFF, com dado real → curva S real (3 séries: PV, EV, AC) + KPIs.
 */
import { AlertTriangle, BarChart3, Info } from 'lucide-react'
import { useProjectContext } from '@/store/projectContext'
import { useAppModeStore } from '@/store/appModeStore'
import { useEvmReal } from '@/hooks/useEvmReal'
import { formatCurrency } from '@/lib/utils'

const W = 900
const H = 360
const PAD = { left: 70, right: 30, top: 20, bottom: 40 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

/** Rótulo da fonte do BAC (Fase 5) — declarado na tela, nunca implícito. */
const BAC_FONTE_LABEL: Record<string, string> = {
  orcamento_total: 'projetos.orcamento_total',
  planejamento_custo_previsto: 'Σ planejamento_itens.custo_previsto',
  campanha_x_mapa: 'metas_producao × servico_codigo_map',
}

export function CurvaSRealPanel() {
  const { activeProjectId } = useProjectContext()
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const { serie, metrics, temProducaoReal, temDespesaReal, temDadosReais, baselineCount, bac, bacFonte, loading, error } =
    useEvmReal(isDemoMode ? null : activeProjectId)

  if (isDemoMode) {
    return (
      <div className="p-6">
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5 flex items-start gap-3">
          <Info size={18} className="text-sky-400 shrink-0 mt-0.5" />
          <p className="text-[#a3a3a3] text-sm leading-relaxed">
            Esta aba mostra a <b className="text-[#f5f5f5]">Curva S com dado real</b> do projeto ativo.
            No Modo Demonstração ela fica inativa — use a aba <b className="text-[#f5f5f5]">Dashboard</b>{' '}
            para ver a curva de exemplo. Desative o Modo Demo para ver dados reais aqui.
          </p>
        </div>
      </div>
    )
  }

  const n = serie.length
  function toX(i: number) {
    if (n <= 1) return PAD.left
    return PAD.left + (i / (n - 1)) * PLOT_W
  }
  const maxVal = Math.max(1, ...serie.map((m) => Math.max(m.pvAcum, m.evAcum, m.acAcum)))
  function toY(v: number) {
    return PAD.top + PLOT_H - (v / maxVal) * PLOT_H
  }
  const SERIES: { key: 'pvAcum' | 'evAcum' | 'acAcum'; color: string; label: string; dash?: string }[] = [
    { key: 'pvAcum', color: '#38bdf8', label: 'PV — Planejado (baseline)' },
    { key: 'evAcum', color: '#f97316', label: 'EV — Valor Agregado (produção real)' },
    { key: 'acAcum', color: '#ef4444', label: 'AC — Custo Real (despesas)', dash: '6 3' },
  ]

  return (
    <div className="p-6 space-y-6 bg-[#2c2c2c] min-h-full">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={16} className="text-[#a3a3a3]" />
          <h2 className="text-[#f5f5f5] text-sm font-semibold">Curva S Real — Dados Reais do Projeto</h2>
        </div>
        <p className="text-[#6b6b6b] text-xs">
          PV = baseline do cronograma mensalizado &middot; EV = produção real (`producao_diaria`) × preço/metro
          derivado do orçamento &middot; AC = despesas reais lançadas. BAC ={' '}
          {bac > 0
            ? `${formatCurrency(bac)} (fonte: ${BAC_FONTE_LABEL[bacFonte ?? ''] ?? '—'})`
            : '— (orcamento_total, planejamento valorado e campanha × preços do de-para vazios)'}.
        </p>
      </div>

      {!activeProjectId && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-200/90 text-xs leading-relaxed">Selecione um projeto ativo.</span>
        </div>
      )}

      {activeProjectId && !loading && baselineCount === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-200/90 text-xs leading-relaxed">
            <b className="text-amber-300">Sem baseline de cronograma para este projeto.</b> A Curva S real
            precisa de um plano semanal cadastrado (planejamento_itens) para calcular o PV. Cadastre o
            planejamento em Cronograma / Planejamento Mestre.
          </span>
        </div>
      )}

      {activeProjectId && !loading && baselineCount > 0 && !bac && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-200/90 text-xs leading-relaxed">
            <b className="text-amber-300">Sem BAC pra este projeto.</b> Tentados 3 caminhos, todos vazios:
            `orcamento_total`, soma de `planejamento_itens.custo_previsto` (valorada via de-para de preços)
            e campanha × preços do de-para (`servico_codigo_map`). Sem BAC não dá pra montar a curva em R$.
          </span>
        </div>
      )}

      {activeProjectId && !loading && baselineCount > 0 && bac > 0 && !temDadosReais && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-200/90 text-xs leading-relaxed">
            <b className="text-amber-300">Sem dados de execução para a curva real.</b> Lance produção
            diária (RDO → Produção) e/ou despesas (DRE → Lançamento) para este projeto, ou ative o{' '}
            <b className="text-amber-300">Modo Demonstração</b> para ver um exemplo ilustrativo no Dashboard.
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-xs">
          {error}
        </div>
      )}

      {temDadosReais && n > 0 && (
        <>
          {/* Fase 5 — CPI/AC só existem com despesa lançada; sem AC os cards
              mostram "—" com a razão (nunca 0.00 fingindo índice calculado). */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="CPI" value={temDespesaReal ? metrics.CPI : null} isIndex note="sem custo real lançado (0 despesas)" />
            <KpiCard label="SPI" value={metrics.SPI} isIndex />
            <KpiCard label="BAC (R$)" value={metrics.BAC} isCurrency />
            <KpiCard label="AC (R$)" value={temDespesaReal ? metrics.AC : null} isCurrency note="sem custo real lançado (0 despesas)" />
          </div>

          <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[900px] mx-auto" style={{ backgroundColor: '#0d1626' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <g key={f}>
                    <line x1={PAD.left} y1={toY(f * maxVal)} x2={W - PAD.right} y2={toY(f * maxVal)} stroke="#1e293b" strokeWidth={1} />
                    <text x={PAD.left - 8} y={toY(f * maxVal) + 4} fill="#64748b" fontSize={10} textAnchor="end" fontFamily="monospace">
                      {formatCurrency(f * maxVal).replace('R$', '').trim()}
                    </text>
                  </g>
                ))}
                {serie.map((pt, i) => {
                  const skip = n > 12 ? Math.ceil(n / 12) : 1
                  if (i % skip !== 0 && i !== n - 1) return null
                  return (
                    <text key={pt.mes} x={toX(i)} y={H - 8} fill="#64748b" fontSize={10} textAnchor="middle" fontFamily="monospace">
                      {pt.mesLabel}
                    </text>
                  )
                })}
                {SERIES.map((s) => (
                  <polyline
                    key={s.key}
                    points={serie.map((pt, i) => `${toX(i)},${toY(pt[s.key])}`).join(' ')}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={s.dash}
                  />
                ))}
                {SERIES.map((s) => serie.map((pt, i) => (
                  <circle key={`${s.key}-${i}`} cx={toX(i)} cy={toY(pt[s.key])} r={3} fill={s.color} />
                )))}
              </svg>
              <div className="flex items-center gap-6 justify-center mt-3 flex-wrap">
                {SERIES.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                    <span className="text-[#a3a3a3] text-xs">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[#2c2c2c] text-[#a3a3a3] uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Mês</th>
                  <th className="text-right px-4 py-2">PV acum.</th>
                  <th className="text-right px-4 py-2">EV acum.</th>
                  <th className="text-right px-4 py-2">AC acum.</th>
                </tr>
              </thead>
              <tbody>
                {serie.map((m) => (
                  <tr key={m.mes} className="border-t border-[#525252]/50">
                    <td className="px-4 py-2 text-[#f5f5f5]">{m.mesLabel}</td>
                    <td className="px-4 py-2 text-right text-sky-400 font-mono">{formatCurrency(m.pvAcum)}</td>
                    <td className="px-4 py-2 text-right text-orange-400 font-mono">{formatCurrency(m.evAcum)}</td>
                    <td className="px-4 py-2 text-right text-red-400 font-mono">{formatCurrency(m.acAcum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[#6b6b6b] text-[10px]">
            Produção real cadastrada: {temProducaoReal ? 'sim' : 'não'} &middot; Despesas reais cadastradas:{' '}
            {temDespesaReal ? 'sim' : 'não'}.
          </p>
        </>
      )}
    </div>
  )
}

/** `value: null` = insumo real ausente — mostra "—" cinza com a razão em `note`. */
function KpiCard({ label, value, isCurrency = false, isIndex = false, note }: { label: string; value: number | null; isCurrency?: boolean; isIndex?: boolean; note?: string }) {
  const formatted = value == null ? '—' : isCurrency ? formatCurrency(value) : value.toFixed(2)
  const color = value == null ? '#6b6b6b' : isIndex ? (value >= 1 ? '#22c55e' : '#ef4444') : '#f5f5f5'
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[140px]" title={value == null ? note : undefined}>
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      <p className="font-mono text-lg font-semibold" style={{ color }}>{formatted}</p>
      {value == null && note && <p className="text-[#6b6b6b] text-[9px] mt-0.5 leading-tight">{note}</p>}
    </div>
  )
}
