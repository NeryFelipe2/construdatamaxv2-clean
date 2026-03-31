import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useShallow } from 'zustand/react/shallow'
import { Star, Search, X } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ─── SVG Bar chart — gastos mensais ──────────────────────────────────────────

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const CATEGORY_PALETTE: Record<string, string> = {
  'Cimento e Argamassa': '#f97316',
  'Aço / Vergalhão':     '#3b82f6',
  'Concreto Usinado':    '#eab308',
  'Tubulação e Saneamento': '#06b6d4',
  'Impermeabilização':   '#ec4899',
  'Outros':              '#6b7280',
}

interface MonthData {
  month: string
  total: number
  byCategory: Record<string, number>
}

function buildMonthlyData(pos: ReturnType<typeof useSuprimentosStore.getState>['purchaseOrders']): MonthData[] {
  const map: Record<number, MonthData> = {}
  for (let m = 0; m < 12; m++) {
    map[m] = { month: MONTHS[m], total: 0, byCategory: {} }
  }

  for (const po of pos) {
    const month = new Date(po.issuedDate).getMonth()
    const total = po.items.reduce((s, i) => s + i.totalPrice, 0)
    let cat = 'Outros'
    if (po.supplier.toLowerCase().includes('ciment') || po.supplier.toLowerCase().includes('argamassa')) cat = 'Cimento e Argamassa'
    else if (po.supplier.toLowerCase().includes('aço') || po.supplier.toLowerCase().includes('aco')) cat = 'Aço / Vergalhão'
    else if (po.supplier.toLowerCase().includes('concre')) cat = 'Concreto Usinado'
    else if (po.supplier.toLowerCase().includes('tubo')) cat = 'Tubulação e Saneamento'

    map[month].total += total
    map[month].byCategory[cat] = (map[month].byCategory[cat] ?? 0) + total
  }

  return Object.values(map)
}

function GastosChart({ data }: { data: MonthData[] }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1)
  const W = 520
  const H = 120
  const barW = Math.floor(W / 12) - 4
  const pad = 2

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-36">
      {data.map((d, i) => {
        const x = i * (W / 12) + pad
        const cats = Object.entries(d.byCategory)
        let stackY = H

        return (
          <g key={d.month}>
            {cats.length === 0 ? (
              <rect x={x} y={H - 2} width={barW} height={2} rx={1} fill="#374151" />
            ) : (
              cats.map(([cat, val]) => {
                const segH = (val / maxVal) * H
                stackY -= segH
                const color = CATEGORY_PALETTE[cat] ?? '#6b7280'
                return (
                  <rect
                    key={cat}
                    x={x}
                    y={stackY}
                    width={barW}
                    height={segH}
                    rx={i === 0 ? 2 : 0}
                    fill={color}
                    opacity={0.8}
                  />
                )
              })
            )}
            <text
              x={x + barW / 2}
              y={H + 14}
              textAnchor="middle"
              fontSize={8}
              fill="#6b7280"
            >
              {d.month}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Confidence stars ─────────────────────────────────────────────────────────

function ConfidenceStars({ score }: { score: number }) {
  const full  = Math.floor(score)
  const half  = score - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half

  const color =
    score >= 4.0 ? 'text-green-400' :
    score >= 3.0 ? 'text-amber-400' :
    'text-red-400'

  return (
    <span className={cn('flex items-center gap-0.5', color)}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={10} fill="currentColor" />
      ))}
      {half === 1 && (
        <span className="relative inline-block w-[10px] h-[10px]">
          <Star size={10} className="absolute text-gray-600" />
          <span className="absolute overflow-hidden w-[5px]">
            <Star size={10} fill="currentColor" />
          </span>
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={10} className="text-gray-600" />
      ))}
      <span className="ml-1 tabular-nums font-semibold">{score.toFixed(1)}</span>
    </span>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function MateriaisOverviewPanel() {
  const { purchaseOrders, frameworkAgreements } = useSuprimentosStore(
    useShallow((s) => ({
      purchaseOrders:      s.purchaseOrders,
      frameworkAgreements: s.frameworkAgreements,
    }))
  )

  const [period, setPeriod]       = useState<'anual' | 'trimestral' | 'mensal'>('anual')
  const [catFilter, setCatFilter] = useState('Todas')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')
  const [showFilter, setShowFilter] = useState(false)

  const monthlyData = useMemo(() => buildMonthlyData(purchaseOrders), [purchaseOrders])

  const totalAnual       = purchaseOrders.reduce((s, po) => s + po.items.reduce((a, i) => a + i.totalPrice, 0), 0)
  const totalTrimestral  = totalAnual / 4
  const totalMensal      = totalAnual / 12
  const totals = { anual: totalAnual, trimestral: totalTrimestral, mensal: totalMensal }

  const openOrders   = purchaseOrders.filter((p) => p.status === 'open' || p.status === 'partial').length
  const closedOrders = purchaseOrders.filter((p) => p.status === 'closed').length
  const onTimeRate   = closedOrders + openOrders > 0 ? Math.round((closedOrders / (closedOrders + openOrders)) * 100) : 0

  const allCategories = ['Todas', ...Array.from(new Set(frameworkAgreements.map((fa) => fa.category)))]

  const filteredFAs = useMemo(() => {
    let list = catFilter === 'Todas'
      ? frameworkAgreements
      : frameworkAgreements.filter((fa) => fa.category === catFilter)

    if (statusFilter !== 'all') list = list.filter((fa) => fa.status === statusFilter)

    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter((fa) =>
        fa.supplier.toLowerCase().includes(q) ||
        fa.category.toLowerCase().includes(q) ||
        fa.code.toLowerCase().includes(q)
      )
    }
    return list
  }, [frameworkAgreements, catFilter, statusFilter, searchText])

  // Vendor comparison — one row per FA
  const vendorRows = filteredFAs.map((fa) => ({
    supplier:    fa.supplier,
    category:    fa.category,
    price:       fa.agreedUnitPrice,
    unit:        fa.unit,
    leadTime:    fa.leadTimeDays,
    faCode:      fa.code,
    faStatus:    fa.status,
    confidence:  fa.confidenceScore,
  }))

  // PO compliance — filtered by search text
  const faSuppliers = new Set(frameworkAgreements.map((fa) => fa.supplier))
  const poCompliance = purchaseOrders
    .filter((po) => !searchText.trim() || po.supplier.toLowerCase().includes(searchText.toLowerCase()) || po.code.toLowerCase().includes(searchText.toLowerCase()))
    .map((po) => ({
      ...po,
      covered: faSuppliers.has(po.supplier),
    }))

  const hasFilters = searchText.trim() || statusFilter !== 'all'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-[#6b6b6b] text-xs">Total Gasto</p>
            <div className="flex gap-1">
              {(['anual', 'trimestral', 'mensal'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors',
                    period === p ? 'bg-[#2abfdc]/20 text-[#2abfdc]' : 'text-[#6b6b6b] hover:text-[#a3a3a3]',
                  )}
                >
                  {p === 'anual' ? 'Ano' : p === 'trimestral' ? 'Tri' : 'Mês'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xl font-bold text-[#f5f5f5] tabular-nums">{fmt(totals[period])}</p>
        </div>

        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 flex flex-col gap-1">
          <p className="text-[#6b6b6b] text-xs">Pedidos em Aberto</p>
          <p className="text-xl font-bold text-amber-400 tabular-nums">{openOrders}</p>
        </div>

        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 flex flex-col gap-1">
          <p className="text-[#6b6b6b] text-xs">Entregas no Prazo</p>
          <p className="text-xl font-bold text-green-400 tabular-nums">{onTimeRate}%</p>
        </div>

        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 flex flex-col gap-1">
          <p className="text-[#6b6b6b] text-xs">Lead Time Médio</p>
          <p className="text-xl font-bold text-[#2abfdc] tabular-nums">
            {frameworkAgreements.length > 0
              ? (frameworkAgreements.reduce((s, fa) => s + fa.leadTimeDays, 0) / frameworkAgreements.length).toFixed(1)
              : '—'} d
          </p>
        </div>
      </div>

      {/* ── Bar chart ── */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#a3a3a3] text-sm font-semibold">Gastos Mensais por Categoria</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_PALETTE).map(([cat, color]) => (
              <span key={cat} className="flex items-center gap-1 text-[10px] text-[#6b6b6b]">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: color }} />
                {cat}
              </span>
            ))}
          </div>
        </div>
        <GastosChart data={monthlyData} />
      </div>

      {/* ── Advanced filter bar ── */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg border transition-colors',
              showFilter || hasFilters
                ? 'bg-[#2abfdc]/20 border-[#2abfdc]/50 text-[#2abfdc]'
                : 'border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3]'
            )}
          >
            Filtros avançados {hasFilters ? '●' : ''}
          </button>
          {hasFilters && (
            <button
              onClick={() => { setSearchText(''); setStatusFilter('all') }}
              className="flex items-center gap-1 text-xs text-[#6b6b6b] hover:text-[#f87171] transition-colors"
            >
              <X size={12} /> Limpar
            </button>
          )}
        </div>

        {showFilter && (
          <div className="flex flex-wrap gap-3 bg-[#0d2040] border border-[#20406a] rounded-xl p-3 mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Search size={13} className="text-[#6b6b6b] shrink-0" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar fornecedor / material..."
                className="bg-transparent text-xs text-[#f5f5f5] placeholder:text-[#6b6b6b] outline-none w-full"
              />
            </div>
            <div className="w-px h-5 bg-[#20406a] self-center" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#6b6b6b]">Status:</span>
              {(['all', 'active', 'expiring', 'expired'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded font-medium transition-colors',
                    statusFilter === s ? 'bg-[#2abfdc] text-white' : 'text-[#6b6b6b] hover:text-[#a3a3a3]'
                  )}
                >
                  {s === 'all' ? 'Todos' : s === 'active' ? 'Ativo' : s === 'expiring' ? 'A vencer' : 'Expirado'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Vendor comparison ── */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#a3a3a3] text-sm font-semibold">Comparativo de Fornecedores</p>
          <div className="flex gap-1 flex-wrap">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                  catFilter === cat
                    ? 'bg-[#2abfdc]/20 border-[#2abfdc]/50 text-[#2abfdc]'
                    : 'border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3]',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b6b6b] border-b border-[#20406a]">
                <th className="text-left pb-2 font-medium">Fornecedor</th>
                <th className="text-left pb-2 font-medium">Categoria</th>
                <th className="text-right pb-2 font-medium">Preço Acordado</th>
                <th className="text-right pb-2 font-medium">Lead Time</th>
                <th className="text-center pb-2 font-medium">Acordo Marco</th>
                <th className="text-center pb-2 font-medium">Confiança</th>
              </tr>
            </thead>
            <tbody>
              {vendorRows.map((row) => {
                const faBadgeColor =
                  row.faStatus === 'active'   ? 'bg-green-900/40 text-green-300 border-green-700/40' :
                  row.faStatus === 'expiring' ? 'bg-amber-900/40 text-amber-300 border-amber-700/40' :
                  'bg-[#14294e] text-[#6b6b6b] border-[#20406a]'

                return (
                  <tr key={row.faCode} className="border-b border-[#20406a] hover:bg-[#1a3662]/40 transition-colors">
                    <td className="py-2 text-[#f5f5f5] font-medium">{row.supplier}</td>
                    <td className="py-2 text-[#a3a3a3]">{row.category}</td>
                    <td className="py-2 text-right tabular-nums text-[#f5f5f5]">
                      {row.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{row.unit}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[#a3a3a3]">{row.leadTime} dias</td>
                    <td className="py-2 text-center">
                      <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium', faBadgeColor)}>
                        {row.faCode}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex justify-center">
                        <ConfidenceStars score={row.confidence} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {vendorRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#6b6b6b]">
                    Nenhum acordo marco encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PO Compliance ── */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 shrink-0">
        <p className="text-[#a3a3a3] text-sm font-semibold mb-3">Conformidade com Acordos Marco</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b6b6b] border-b border-[#20406a]">
                <th className="text-left pb-2 font-medium">OC</th>
                <th className="text-left pb-2 font-medium">Fornecedor</th>
                <th className="text-right pb-2 font-medium">Valor</th>
                <th className="text-right pb-2 font-medium">Data</th>
                <th className="text-center pb-2 font-medium">Conformidade</th>
              </tr>
            </thead>
            <tbody>
              {poCompliance.map((po) => {
                const total = po.items.reduce((s, i) => s + i.totalPrice, 0)
                return (
                  <tr key={po.id} className="border-b border-[#20406a] hover:bg-[#1a3662]/40 transition-colors">
                    <td className="py-2 font-mono text-[#a3a3a3]">{po.code}</td>
                    <td className="py-2 text-[#f5f5f5]">{po.supplier}</td>
                    <td className="py-2 text-right tabular-nums text-[#f5f5f5]">{fmt(total)}</td>
                    <td className="py-2 text-right text-[#6b6b6b]">{po.issuedDate}</td>
                    <td className="py-2 text-center">
                      {po.covered ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-900/30 text-green-300 text-[10px] font-medium">
                          ✓ Coberto
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-red-900/30 text-red-300 text-[10px] font-medium">
                          ⚠ Sem AM
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
