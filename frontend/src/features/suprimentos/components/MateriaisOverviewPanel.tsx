import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useShallow } from 'zustand/react/shallow'
import { Star, Search, X, Pencil, Plus, Check } from 'lucide-react'
import type { FrameworkAgreement } from '@/types'

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

// ─── FA Edit / Create Modal ───────────────────────────────────────────────────

const FA_CATEGORIES = [
  'Cimento e Argamassa', 'Aço / Vergalhão', 'Concreto Usinado',
  'Tubulação e Saneamento', 'Impermeabilização', 'Outros',
]

const EMPTY_FA: Omit<FrameworkAgreement, 'id'> = {
  code: '', supplier: '', category: 'Cimento e Argamassa',
  validFrom: '', validTo: '', agreedUnitPrice: 0, maxQuantity: 0,
  unit: 'un', leadTimeDays: 7, confidenceScore: 3.0,
  status: 'active', terms: '',
}

interface FaModalProps {
  initial: FrameworkAgreement | null   // null = create new
  onSave: (fa: FrameworkAgreement | Omit<FrameworkAgreement, 'id'>) => void
  onClose: () => void
}

function FaModal({ initial, onSave, onClose }: FaModalProps) {
  const [f, setF] = useState<Omit<FrameworkAgreement, 'id'>>(
    initial ? { ...initial } : { ...EMPTY_FA }
  )

  const set = (k: keyof typeof f, v: unknown) => setF((prev) => ({ ...prev, [k]: v }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.supplier.trim() || !f.code.trim()) return
    if (initial) {
      onSave({ ...initial, ...f })
    } else {
      onSave(f)
    }
    onClose()
  }

  const inp = 'bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-[#f5f5f5] text-xs w-full outline-none focus:border-[#f97316]'
  const sel = 'bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-[#f5f5f5] text-xs w-full outline-none focus:border-[#f97316]'
  const lbl = 'text-[#a3a3a3] text-[10px] uppercase tracking-wide mb-1 block'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#525252] shrink-0">
          <h4 className="text-[#f5f5f5] font-semibold text-sm">
            {initial ? 'Editar Acordo Marco' : 'Novo Acordo Marco'}
          </h4>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Código AM</label>
              <input className={inp} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="FA-001" required />
            </div>
            <div>
              <label className={lbl}>Fornecedor</label>
              <input className={inp} value={f.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="Nome do fornecedor" required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Categoria</label>
              <select className={sel} value={f.category} onChange={(e) => set('category', e.target.value)}>
                {FA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={sel} value={f.status} onChange={(e) => set('status', e.target.value as FrameworkAgreement['status'])}>
                <option value="active">Ativo</option>
                <option value="expiring">A vencer</option>
                <option value="expired">Expirado</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Preço Unitário (R$)</label>
              <input className={inp} type="number" min="0" step="0.01" value={f.agreedUnitPrice} onChange={(e) => set('agreedUnitPrice', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={lbl}>Unidade</label>
              <input className={inp} value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="m³, ton, sc…" />
            </div>
            <div>
              <label className={lbl}>Lead Time (dias)</label>
              <input className={inp} type="number" min="0" value={f.leadTimeDays} onChange={(e) => set('leadTimeDays', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Válido De</label>
              <input className={inp} type="date" value={f.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Válido Até</label>
              <input className={inp} type="date" value={f.validTo} onChange={(e) => set('validTo', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Qtd Máxima</label>
              <input className={inp} type="number" min="0" value={f.maxQuantity} onChange={(e) => set('maxQuantity', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Confiança (1–5)</label>
            <input className={inp} type="number" min="1" max="5" step="0.1" value={f.confidenceScore} onChange={(e) => set('confidenceScore', parseFloat(e.target.value) || 3)} />
          </div>
          <div>
            <label className={lbl}>Termos (resumo)</label>
            <textarea className={cn(inp, 'resize-none')} rows={2} value={f.terms} onChange={(e) => set('terms', e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex-1 flex items-center justify-center gap-1.5 bg-[#f97316] hover:bg-[#22a8c4] text-white rounded-lg px-3 py-2 text-xs font-semibold transition-colors">
              <Check size={13} /> Salvar
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs hover:border-[#6b6b6b] transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function MateriaisOverviewPanel() {
  const { purchaseOrders, frameworkAgreements, updateFrameworkAgreement, addFrameworkAgreement } = useSuprimentosStore(
    useShallow((s) => ({
      purchaseOrders:           s.purchaseOrders,
      frameworkAgreements:      s.frameworkAgreements,
      updateFrameworkAgreement: s.updateFrameworkAgreement,
      addFrameworkAgreement:    s.addFrameworkAgreement,
    }))
  )

  const [faModal, setFaModal] = useState<{ fa: FrameworkAgreement | null } | null>(null)
  const [period, setPeriod]   = useState<'anual' | 'trimestral' | 'mensal'>('anual')
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

  // PO compliance — filtered by search text
  const faSuppliers = new Set(frameworkAgreements.map((fa) => fa.supplier))
  const poCompliance = purchaseOrders
    .filter((po) => !searchText.trim() || po.supplier.toLowerCase().includes(searchText.toLowerCase()) || po.code.toLowerCase().includes(searchText.toLowerCase()))
    .map((po) => ({
      ...po,
      covered: faSuppliers.has(po.supplier),
    }))

  const hasFilters = searchText.trim() || statusFilter !== 'all'

  function handleFaSave(fa: FrameworkAgreement | Omit<FrameworkAgreement, 'id'>) {
    if ('id' in fa) {
      updateFrameworkAgreement(fa.id, fa)
    } else {
      addFrameworkAgreement(fa)
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
      {/* FA edit/create modal */}
      {faModal !== null && (
        <FaModal
          initial={faModal.fa}
          onSave={handleFaSave}
          onClose={() => setFaModal(null)}
        />
      )}
      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-[#6b6b6b] text-xs">Total Gasto</p>
            <div className="flex gap-1">
              {(['anual', 'trimestral', 'mensal'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors',
                    period === p ? 'bg-[#f97316]/20 text-[#f97316]' : 'text-[#6b6b6b] hover:text-[#a3a3a3]',
                  )}
                >
                  {p === 'anual' ? 'Ano' : p === 'trimestral' ? 'Tri' : 'Mês'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xl font-bold text-[#f5f5f5] tabular-nums">{fmt(totals[period])}</p>
        </div>

        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-1">
          <p className="text-[#6b6b6b] text-xs">Pedidos em Aberto</p>
          <p className="text-xl font-bold text-amber-400 tabular-nums">{openOrders}</p>
        </div>

        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-1">
          <p className="text-[#6b6b6b] text-xs">Entregas no Prazo</p>
          <p className="text-xl font-bold text-green-400 tabular-nums">{onTimeRate}%</p>
        </div>

        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-1">
          <p className="text-[#6b6b6b] text-xs">Lead Time Médio</p>
          <p className="text-xl font-bold text-[#f97316] tabular-nums">
            {frameworkAgreements.length > 0
              ? (frameworkAgreements.reduce((s, fa) => s + fa.leadTimeDays, 0) / frameworkAgreements.length).toFixed(1)
              : '—'} d
          </p>
        </div>
      </div>

      {/* ── Bar chart ── */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 shrink-0">
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
                ? 'bg-[#f97316]/20 border-[#f97316]/50 text-[#f97316]'
                : 'border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3]'
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
          <div className="flex flex-wrap gap-3 bg-[#2c2c2c] border border-[#525252] rounded-xl p-3 mb-3">
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
            <div className="w-px h-5 bg-[#525252] self-center" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#6b6b6b]">Status:</span>
              {(['all', 'active', 'expiring', 'expired'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded font-medium transition-colors',
                    statusFilter === s ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#a3a3a3]'
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
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#a3a3a3] text-sm font-semibold">Comparativo de Fornecedores</p>
          <div className="flex items-center gap-1 flex-wrap">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                  catFilter === cat
                    ? 'bg-[#f97316]/20 border-[#f97316]/50 text-[#f97316]'
                    : 'border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3]',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={() => setFaModal({ fa: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30 text-[#f97316] text-xs font-semibold hover:bg-[#f97316]/25 transition-colors shrink-0"
          >
            <Plus size={12} /> Novo Fornecedor
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b6b6b] border-b border-[#525252]">
                <th className="text-left pb-2 font-medium">Fornecedor</th>
                <th className="text-left pb-2 font-medium">Categoria</th>
                <th className="text-right pb-2 font-medium">Preço Acordado</th>
                <th className="text-right pb-2 font-medium">Lead Time</th>
                <th className="text-center pb-2 font-medium">Acordo Marco</th>
                <th className="text-center pb-2 font-medium">Confiança</th>
                <th className="text-center pb-2 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filteredFAs.map((fa) => {
                const faBadgeColor =
                  fa.status === 'active'   ? 'bg-green-900/40 text-green-300 border-green-700/40' :
                  fa.status === 'expiring' ? 'bg-amber-900/40 text-amber-300 border-amber-700/40' :
                  'bg-[#3d3d3d] text-[#6b6b6b] border-[#525252]'

                return (
                  <tr key={fa.id} className="border-b border-[#525252] hover:bg-[#484848]/40 transition-colors">
                    <td className="py-2 text-[#f5f5f5] font-medium">{fa.supplier}</td>
                    <td className="py-2 text-[#a3a3a3]">{fa.category}</td>
                    <td className="py-2 text-right tabular-nums text-[#f5f5f5]">
                      {fa.agreedUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{fa.unit}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[#a3a3a3]">{fa.leadTimeDays} dias</td>
                    <td className="py-2 text-center">
                      <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium', faBadgeColor)}>
                        {fa.code}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex justify-center">
                        <ConfidenceStars score={fa.confidenceScore} />
                      </div>
                    </td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => setFaModal({ fa })}
                        className="p-1 rounded text-[#6b6b6b] hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
                        title="Editar acordo marco"
                      >
                        <Pencil size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredFAs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#6b6b6b]">
                    Nenhum acordo marco encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PO Compliance ── */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 shrink-0">
        <p className="text-[#a3a3a3] text-sm font-semibold mb-3">Conformidade com Acordos Marco</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b6b6b] border-b border-[#525252]">
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
                  <tr key={po.id} className="border-b border-[#525252] hover:bg-[#484848]/40 transition-colors">
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
