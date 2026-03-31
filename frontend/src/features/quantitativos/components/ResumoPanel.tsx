/**
 * ResumoPanel — cost summary grouped by category with BDI breakdown and SVG chart.
 */
import { useState } from 'react'
import { Download, Printer, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { exportToCsv, exportToXlsx } from '../utils/exportEngine'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

interface BdiBreakdown {
  adminCentral: number
  iss: number
  pisCofins: number
  seguro: number
  lucro: number
}

const DEFAULT_BDI: BdiBreakdown = {
  adminCentral: 4.0,
  iss: 3.0,
  pisCofins: 3.65,
  seguro: 0.8,
  lucro: 7.5,
}

export function ResumoPanel() {
  const { currentItems, bdiGlobal, setBdiGlobal, updateItem } = useQuantitativosStore()
  const [bdi, setBdi] = useState<BdiBreakdown>(DEFAULT_BDI)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [budgetCap, setBudgetCap] = useState<number>(() => {
    try {
      const stored = sessionStorage.getItem('quant-budget-cap')
      return stored ? parseFloat(stored) : 0
    } catch { return 0 }
  })

  // Group by category
  const groups: Record<string, { items: typeof currentItems; subtotal: number; total: number }> = {}
  currentItems.forEach((i) => {
    if (!groups[i.category]) groups[i.category] = { items: [], subtotal: 0, total: 0 }
    groups[i.category].items.push(i)
    groups[i.category].subtotal += i.quantity * i.unitCost
    groups[i.category].total   += i.totalCost
  })
  const sorted = Object.entries(groups).sort((a, b) => b[1].total - a[1].total)
  const grandTotal = currentItems.reduce((s, i) => s + i.totalCost, 0)
  const grandSubtotal = currentItems.reduce((s, i) => s + i.quantity * i.unitCost, 0)
  const maxTotal = sorted[0]?.[1].total ?? 1

  const computedBdi = Object.values(bdi).reduce((s, v) => s + v, 0)

  const inputCls = 'w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-violet-500 text-right'

  function handleApplyBdiToAll() {
    const total = computedBdi
    currentItems.forEach((item) => updateItem(item.id, { bdi: total }))
    setBdiGlobal(total)
  }

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* BDI Config */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-gray-200 font-medium text-sm">Configuração do BDI</h3>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">BDI Total Calculado:</span>
            <span className="text-violet-400 font-bold text-sm">{computedBdi.toFixed(2)}%</span>
            <button
              onClick={handleApplyBdiToAll}
              className="px-3 py-1 rounded text-xs bg-violet-900/40 text-violet-300 hover:bg-violet-900/60 transition-colors"
            >
              Aplicar a todos os {currentItems.length} itens
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {(Object.entries(bdi) as [keyof BdiBreakdown, number][]).map(([key, val]) => {
            const labels: Record<keyof BdiBreakdown, string> = {
              adminCentral: 'Adm. Central', iss: 'ISS', pisCofins: 'PIS/COFINS', seguro: 'Seguro', lucro: 'Lucro',
            }
            return (
              <div key={key}>
                <label className="block text-gray-400 text-xs mb-1">{labels[key]} (%)</label>
                <input
                  type="number"
                  step={0.01}
                  value={val}
                  onChange={(e) => setBdi((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                  className={inputCls + ' w-full'}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* SVG Bar Chart */}
      {sorted.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-gray-200 font-medium text-sm mb-4">Distribuição por Categoria</h3>
          <div className="space-y-3">
            {sorted.slice(0, 10).map(([cat, data]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-gray-400 text-xs w-32 truncate text-right">{cat}</span>
                <div className="flex-1 h-6 bg-gray-700 rounded overflow-hidden">
                  <div
                    className="h-full rounded bg-violet-500/70 transition-all duration-500"
                    style={{ width: `${(data.total / maxTotal) * 100}%` }}
                  />
                </div>
                <span className="text-gray-300 text-xs w-28 text-right">{fmtBRL(data.total)}</span>
                <span className="text-gray-500 text-xs w-12 text-right">
                  {grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-gray-200 font-medium text-sm">Resumo por Categoria</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => exportToCsv(currentItems)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">
              <Download size={12} /> CSV
            </button>
            <button onClick={() => exportToXlsx(currentItems, bdiGlobal)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">
              <Download size={12} /> Excel
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">
              <Printer size={12} /> PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-700">
                <th className="text-left px-5 py-2.5 font-medium">Categoria</th>
                <th className="text-right px-3 py-2.5 font-medium">Qtd. Itens</th>
                <th className="text-right px-3 py-2.5 font-medium">Subtotal s/ BDI</th>
                <th className="text-right px-3 py-2.5 font-medium">BDI Médio (%)</th>
                <th className="text-right px-5 py-2.5 font-medium">Total c/ BDI</th>
                <th className="text-right px-3 py-2.5 font-medium">% do Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-500 py-10">Nenhum item na composição.</td></tr>
              )}
              {sorted.map(([cat, data]) => {
                const avgBdi = data.items.reduce((s, i) => s + i.bdi, 0) / data.items.length
                const pct = grandTotal > 0 ? (data.total / grandTotal) * 100 : 0
                const expanded = expandedCategories.has(cat)
                return (
                  <>
                    <tr key={cat} className="border-b border-gray-700/50 hover:bg-gray-750/20 cursor-pointer" onClick={() => toggleCategory(cat)}>
                      <td className="px-5 py-3 text-gray-200 flex items-center gap-2">
                        {expanded ? <ChevronUp size={13} className="text-gray-500 shrink-0" /> : <ChevronDown size={13} className="text-gray-500 shrink-0" />}
                        {cat}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-400">{data.items.length}</td>
                      <td className="px-3 py-3 text-right text-gray-300">{fmtBRL(data.subtotal)}</td>
                      <td className="px-3 py-3 text-right text-gray-400">{avgBdi.toFixed(1)}%</td>
                      <td className="px-5 py-3 text-right text-violet-300 font-medium">{fmtBRL(data.total)}</td>
                      <td className="px-3 py-3 text-right text-gray-400">{pct.toFixed(2)}%</td>
                    </tr>
                    {expanded && data.items.map((item) => (
                      <tr key={item.id} className="bg-gray-900/30 border-b border-gray-700/30">
                        <td className="pl-10 pr-3 py-2 text-gray-400 text-xs">{item.code}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{item.description}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{item.unit}</td>
                        <td className="px-3 py-2">
                          <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: +e.target.value })} className="w-20 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs text-gray-200" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={item.unitCost} onChange={(e) => updateItem(item.id, { unitCost: +e.target.value })} className="w-24 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs text-gray-200" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={item.bdi} onChange={(e) => updateItem(item.id, { bdi: +e.target.value })} className="w-16 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs text-gray-200" />
                        </td>
                        <td className="px-5 py-2 text-right text-gray-400 text-xs">{fmtBRL(item.totalCost)}</td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
            {sorted.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-600">
                  <td className="px-5 py-3 text-gray-200 font-semibold">TOTAL GERAL</td>
                  <td className="px-3 py-3 text-right text-gray-400 font-semibold">{currentItems.length}</td>
                  <td className="px-3 py-3 text-right text-gray-300 font-semibold">{fmtBRL(grandSubtotal)}</td>
                  <td className="px-3 py-3 text-right text-gray-400 font-semibold">{bdiGlobal.toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right text-violet-400 font-bold">{fmtBRL(grandTotal)}</td>
                  <td className="px-3 py-3 text-right text-gray-200 font-semibold">100.00%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Grand total card */}
      <div className="bg-violet-950/40 border border-violet-700/50 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs mb-1">TOTAL GERAL DO ORÇAMENTO</p>
            <p className="text-3xl font-bold text-violet-400">{fmtBRL(grandTotal)}</p>
            <p className="text-gray-500 text-xs mt-1">{currentItems.length} itens · BDI global: {bdiGlobal}%</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs mb-1">Subtotal s/ BDI</p>
            <p className="text-xl font-semibold text-gray-300">{fmtBRL(grandSubtotal)}</p>
            <p className="text-gray-500 text-xs mt-1">BDI: {fmtBRL(grandTotal - grandSubtotal)}</p>
          </div>
        </div>
        {/* Budget cap */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-violet-700/30 flex-wrap">
          <label className="text-xs text-gray-400">Meta (R$):</label>
          <input
            type="number"
            value={budgetCap || ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0
              setBudgetCap(v)
              try { sessionStorage.setItem('quant-budget-cap', String(v)) } catch { /* noop */ }
            }}
            className="w-36 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none"
            placeholder="Definir meta..."
          />
          {budgetCap > 0 && (() => {
            const delta = grandTotal - budgetCap
            const pct = (delta / budgetCap * 100).toFixed(1)
            return (
              <span className={`text-sm font-semibold ${delta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                Δ {fmtBRL(Math.abs(delta))} ({delta > 0 ? '+' : ''}{pct}%)
              </span>
            )
          })()}
        </div>
      </div>

      {/* Source distribution donut */}
      {currentItems.length > 0 && (() => {
        const SOURCE_LABELS: Record<string, string> = { sinapi: 'SINAPI', seinfra: 'SEINFRA', custom: 'Personalizada', manual: 'Manual' }
        const SOURCE_COLORS: Record<string, string> = { sinapi: '#38bdf8', seinfra: '#2abfdc', custom: '#a78bfa', manual: '#fb923c' }
        const sources = ['sinapi', 'seinfra', 'custom', 'manual'] as const
        const srcData = sources.map((src) => {
          const items = currentItems.filter((i) => i.source === src)
          const total = items.reduce((s, i) => s + i.totalCost, 0)
          return { src, label: SOURCE_LABELS[src], color: SOURCE_COLORS[src], count: items.length, total }
        }).filter((s) => s.count > 0)

        if (srcData.length === 0) return null

        const totalAll = srcData.reduce((s, d) => s + d.total, 0)
        // SVG donut
        const cx = 60, cy = 60, r = 44, strokeW = 20
        const circ = 2 * Math.PI * r
        let offset = 0
        const slices = srcData.map((d) => {
          const pct = totalAll > 0 ? d.total / totalAll : 0
          const dash = pct * circ
          const slice = { ...d, dash, offset, pct }
          offset += dash
          return slice
        })

        return (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h3 className="text-gray-200 font-medium text-sm mb-4">Distribuição por Fonte</h3>
            <div className="flex items-center gap-6 flex-wrap">
              <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0 -rotate-90">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#374151" strokeWidth={strokeW} />
                {slices.map((s) => (
                  <circle
                    key={s.src}
                    cx={cx} cy={cy} r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={strokeW}
                    strokeDasharray={`${s.dash} ${circ}`}
                    strokeDashoffset={-s.offset}
                  />
                ))}
              </svg>
              <div className="space-y-2 flex-1">
                {slices.map((s) => (
                  <div key={s.src} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-300 text-xs flex-1">{s.label}</span>
                    <span className="text-gray-500 text-xs">{s.count} itens</span>
                    <span className="text-gray-300 text-xs w-24 text-right">{fmtBRL(s.total)}</span>
                    <span className="text-gray-500 text-xs w-10 text-right">{(s.pct * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
