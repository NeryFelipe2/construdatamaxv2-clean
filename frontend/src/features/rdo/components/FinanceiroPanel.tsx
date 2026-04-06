/**
 * FinanceiroPanel — EVM analysis, S-curve (PV/EV/AC), and financial entries CRUD.
 * EVM formulas:
 *   EV  = BAC × (executedM / plannedM)
 *   PV  = BAC × (elapsed / total)
 *   AC  = Σ expense entries
 *   CPI = EV / AC   SPI = EV / PV
 *   EAC = BAC / CPI  ETC = EAC - AC  VAC = BAC - EAC  TCPI = (BAC-EV)/(BAC-AC)
 */
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { useRdoStore, computeEvm } from '@/store/rdoStore'
import type { RdoFinancialEntry } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, borderColor, textColor = 'text-gray-100',
}: {
  label: string; value: string; sub?: string; borderColor?: string; textColor?: string
}) {
  return (
    <div className={`bg-[#3d3d3d] rounded-xl p-4 border border-[#525252] ${borderColor ? `border-l-4 ${borderColor}` : ''}`}>
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
      {sub && <p className="text-[#6b6b6b] text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Financial entry row (inline editing) ─────────────────────────────────────

interface EntryRowProps {
  entry:    RdoFinancialEntry
  onUpdate: (id: string, u: Partial<Omit<RdoFinancialEntry, 'id'>>) => void
  onDelete: (id: string) => void
}

function EntryRow({ entry, onUpdate, onDelete }: EntryRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...entry })

  function save() {
    onUpdate(entry.id, {
      date:        draft.date,
      category:    draft.category,
      description: draft.description,
      valueBRL:    draft.valueBRL,
      type:        draft.type,
    })
    setEditing(false)
  }
  function cancel() {
    setDraft({ ...entry })
    setEditing(false)
  }

  const inputCls = 'bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50 w-full'

  if (editing) {
    return (
      <tr className="border-b border-[#525252]/50 bg-gray-750/30">
        <td className="px-3 py-2">
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={inputCls} />
        </td>
        <td className="px-3 py-2">
          <input type="text" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={inputCls} placeholder="Categoria" />
        </td>
        <td className="px-3 py-2">
          <input type="text" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inputCls} placeholder="Descrição" />
        </td>
        <td className="px-3 py-2">
          <input type="number" value={draft.valueBRL} onChange={(e) => setDraft({ ...draft, valueBRL: Number(e.target.value) })} className={`${inputCls} w-28`} min={0} />
        </td>
        <td className="px-3 py-2">
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as 'expense' | 'revenue' })} className={inputCls}>
            <option value="expense">Despesa</option>
            <option value="revenue">Receita</option>
          </select>
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button onClick={save} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
            <button onClick={cancel} className="p-1 text-[#a3a3a3] hover:text-[#f5f5f5]"><X size={14} /></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-[#525252]/50 hover:bg-gray-750/20">
      <td className="px-3 py-3 text-[#a3a3a3] text-sm">{fmtDate(entry.date)}</td>
      <td className="px-3 py-3 text-[#f5f5f5] text-sm">{entry.category}</td>
      <td className="px-3 py-3 text-[#f5f5f5] text-sm">{entry.description}</td>
      <td className="px-3 py-3 text-[#f5f5f5] text-sm font-medium">{fmtBRL(entry.valueBRL)}</td>
      <td className="px-3 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          entry.type === 'expense'
            ? 'bg-red-900/40 text-red-300'
            : 'bg-emerald-900/40 text-emerald-300'
        }`}>
          {entry.type === 'expense' ? 'Despesa' : 'Receita'}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="p-1 text-[#a3a3a3] hover:text-[#f97316] transition-colors"><Pencil size={13} /></button>
          <button onClick={() => onDelete(entry.id)} className="p-1 text-[#a3a3a3] hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

// ─── Add entry form ───────────────────────────────────────────────────────────

function AddEntryForm({ onAdd, onClose }: {
  onAdd: (e: Omit<RdoFinancialEntry, 'id'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    date: todayStr(), category: '', description: '', valueBRL: 0, type: 'expense' as 'expense' | 'revenue',
  })
  const [err, setErr] = useState('')

  function submit() {
    if (!form.category.trim()) { setErr('Categoria obrigatória'); return }
    if (!form.description.trim()) { setErr('Descrição obrigatória'); return }
    if (form.valueBRL <= 0) { setErr('Valor deve ser positivo'); return }
    onAdd({ ...form })
    onClose()
  }

  const inputCls = 'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50'

  return (
    <div className="bg-gray-750 border border-[#5e5e5e] rounded-xl p-5 space-y-3">
      <h4 className="text-[#f5f5f5] font-medium text-sm">Novo Lançamento</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[#a3a3a3] text-xs mb-1">Data</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-[#a3a3a3] text-xs mb-1">Categoria</label>
          <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="ex. Material" className={inputCls} />
        </div>
        <div>
          <label className="block text-[#a3a3a3] text-xs mb-1">Tipo</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'expense' | 'revenue' })} className={inputCls}>
            <option value="expense">Despesa</option>
            <option value="revenue">Receita</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[#a3a3a3] text-xs mb-1">Descrição</label>
          <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição do lançamento" className={inputCls} />
        </div>
        <div>
          <label className="block text-[#a3a3a3] text-xs mb-1">Valor (R$)</label>
          <input type="number" value={form.valueBRL} onChange={(e) => setForm({ ...form, valueBRL: Number(e.target.value) })} min={0} className={inputCls} />
        </div>
      </div>
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-[#484848] text-[#f5f5f5] text-sm hover:bg-[#525252] transition-colors">Cancelar</button>
        <button onClick={submit} className="px-4 py-1.5 rounded-lg text-sm text-white transition-colors" style={{ backgroundColor: '#0ea5e9' }}>Salvar</button>
      </div>
    </div>
  )
}

// ─── Category bar chart ───────────────────────────────────────────────────────

function CategoryChart({ entries }: { entries: RdoFinancialEntry[] }) {
  const expenses = entries.filter((e) => e.type === 'expense')
  if (expenses.length === 0) return null

  const grouped: Record<string, number> = {}
  expenses.forEach((e) => {
    grouped[e.category] = (grouped[e.category] ?? 0) + e.valueBRL
  })
  const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1])
  const max = sorted[0]?.[1] ?? 1

  return (
    <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-5">
      <h3 className="text-[#f5f5f5] font-medium text-sm mb-4">Custos por Categoria</h3>
      <div className="space-y-3">
        {sorted.map(([cat, val]) => (
          <div key={cat} className="flex items-center gap-3">
            <span className="text-[#a3a3a3] text-xs w-28 truncate text-right">{cat}</span>
            <div className="flex-1 h-5 bg-[#484848] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-500/70 transition-all"
                style={{ width: `${(val / max) * 100}%` }}
              />
            </div>
            <span className="text-[#f5f5f5] text-xs w-24 text-right">{fmtBRL(val)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── S-Curve (PV/EV/AC) ──────────────────────────────────────────────────────

function SCurve({
  entries, budgetBRL, planTotalMeters, planTotalWorkDays,
  rdoTrechos,
}: {
  entries: RdoFinancialEntry[]
  budgetBRL: number
  planTotalMeters: number
  planTotalWorkDays: number
  rdoTrechos: { date: string; executedMeters: number }[]
}) {
  const W = 680, H = 260, PL = 60, PR = 20, PT = 20, PB = 36

  if (entries.length === 0 && rdoTrechos.length === 0) return null

  const allDates = [...entries.map((e) => e.date), ...rdoTrechos.map((r) => r.date)].sort()
  const uniqueDates = [...new Set(allDates)]
  if (uniqueDates.length < 2) return null

  const workDays = planTotalWorkDays || uniqueDates.length

  const points = uniqueDates.map((date, i) => {
    const pvPct = Math.min(((i + 1) / workDays) * 100, 100)
    const cumExec = rdoTrechos.filter((r) => r.date <= date).reduce((s, r) => s + r.executedMeters, 0)
    const evPct = planTotalMeters > 0 ? Math.min((cumExec / planTotalMeters) * 100, 100) : 0
    const acBRL = entries.filter((e) => e.type === 'expense' && e.date <= date).reduce((s, e) => s + e.valueBRL, 0)
    return { pvPct, evPct, acBRL }
  })

  const maxAC = Math.max(...points.map((p) => p.acBRL), budgetBRL, 1)

  function xOf(i: number) { return PL + (i / (points.length - 1)) * (W - PL - PR) }
  function yOfPct(pct: number) { return PT + (1 - pct / 100) * (H - PT - PB) }
  function yOfBRL(brl: number) { return PT + (1 - brl / maxAC) * (H - PT - PB) }

  const pvStr = points.map((p, i) => `${xOf(i).toFixed(1)},${yOfPct(p.pvPct).toFixed(1)}`).join(' ')
  const evStr = points.map((p, i) => `${xOf(i).toFixed(1)},${yOfPct(p.evPct).toFixed(1)}`).join(' ')
  const acStr = points.map((p, i) => `${xOf(i).toFixed(1)},${yOfBRL(p.acBRL).toFixed(1)}`).join(' ')

  return (
    <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#525252]">
        <h3 className="text-[#f5f5f5] font-medium text-sm">Curva S — PV / EV / AC</h3>
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }}>
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = yOfPct(pct)
            return (
              <g key={pct}>
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#374151" strokeWidth="1" />
                <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">{pct}%</text>
              </g>
            )
          })}
          <polyline points={pvStr} fill="none" stroke="#3b82f6" strokeWidth="2" />
          <polyline points={evStr} fill="none" stroke="#10b981" strokeWidth="2" />
          <polyline points={acStr} fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="5 3" />
        </svg>
        <div className="flex items-center gap-5 justify-center mt-1 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-5 h-0.5 bg-blue-500" /><span className="text-[#a3a3a3] text-xs">PV</span></div>
          <div className="flex items-center gap-1.5"><div className="w-5 h-0.5 bg-emerald-500" /><span className="text-[#a3a3a3] text-xs">EV</span></div>
          <div className="flex items-center gap-1.5 opacity-70"><div className="w-5 h-0.5 bg-rose-500" /><span className="text-[#a3a3a3] text-xs">AC</span></div>
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function FinanceiroPanel() {
  const {
    rdos, financialEntries, budgetBRL,
    addFinancialEntry, updateFinancialEntry, removeFinancialEntry, setBudget,
  } = useRdoStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [planTotalMeters, setPlanTotalMeters] = useState(0)
  const [planTotalWorkDays, setPlanTotalWorkDays] = useState(0)
  const [elapsedWorkDays, setElapsedWorkDays] = useState(0)
  const [budgetInput, setBudgetInput] = useState(String(budgetBRL))

  useEffect(() => {
    import('@/store/planejamentoStore')
      .then(({ usePlanejamentoStore }) => {
        type RawState = { trechos: { lengthM: number }[]; workDays: string[] }
        const state = usePlanejamentoStore.getState() as unknown as RawState
        const total = (state.trechos ?? []).reduce((s, t) => s + t.lengthM, 0)
        const today = new Date().toISOString().slice(0, 10)
        const wd = state.workDays ?? []
        setPlanTotalMeters(total)
        setPlanTotalWorkDays(wd.length)
        setElapsedWorkDays(wd.filter((d) => d <= today).length)
      })
      .catch(() => {})
  }, [])

  // Flatten RDO trecho data for S-curve
  const rdoTrechoFlat = rdos.flatMap((r) =>
    r.trechos.map((t) => ({ date: r.date, executedMeters: t.executedMeters }))
  )
  const totalExecutedM = rdos.reduce((s, r) => s + r.trechos.reduce((ts, t) => ts + t.executedMeters, 0), 0)

  const evm = computeEvm(budgetBRL, planTotalMeters, totalExecutedM, elapsedWorkDays, planTotalWorkDays, financialEntries)

  function handleBudgetBlur() {
    const val = parseFloat(budgetInput)
    if (!isNaN(val) && val > 0) setBudget(val)
    else setBudgetInput(String(budgetBRL))
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    removeFinancialEntry(id)
  }

  const acBRL = financialEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.valueBRL, 0)
  const totalRevenue = financialEntries.filter((e) => e.type === 'revenue').reduce((s, e) => s + e.valueBRL, 0)

  function indexColor(val: number, goodAbove1 = true): string {
    if (isNaN(val) || !isFinite(val)) return 'text-[#a3a3a3]'
    if (goodAbove1) return val >= 1 ? 'text-emerald-400' : val >= 0.9 ? 'text-yellow-400' : 'text-rose-400'
    return val <= 1 ? 'text-emerald-400' : 'text-rose-400'
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-white font-semibold text-lg">Análise Financeira (EVM)</h2>
        {/* BAC Input */}
        <div className="flex items-center gap-2">
          <label className="text-[#a3a3a3] text-sm">Orçamento Total (BAC):</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b] text-sm">R$</span>
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={handleBudgetBlur}
              className="pl-8 pr-3 py-1.5 bg-[#3d3d3d] border border-[#5e5e5e] rounded-lg text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50 w-36"
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Row 1 EVM KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Orçamento Total (BAC)" value={fmtBRL(budgetBRL)} textColor="text-[#f97316]" />
        <KpiCard label="Valor Agregado (EV)" value={fmtBRL(evm.ev)} textColor="text-emerald-400" sub={`${budgetBRL > 0 ? ((evm.ev / budgetBRL) * 100).toFixed(1) : '0.0'}% do BAC`} />
        <KpiCard label="Custo Real (AC)" value={fmtBRL(evm.ac)} textColor="text-rose-400" />
        <KpiCard label="Valor Planejado (PV)" value={fmtBRL(evm.pv)} textColor="text-blue-400" sub={`${budgetBRL > 0 ? ((evm.pv / budgetBRL) * 100).toFixed(1) : '0.0'}% do BAC`} />
      </div>

      {/* Row 2 EVM Indices */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="CPI (Custo)"
          value={isFinite(evm.cpi) ? evm.cpi.toFixed(3) : '—'}
          sub="≥ 1 = eficiente"
          borderColor="border-l-sky-500"
          textColor={indexColor(evm.cpi)}
        />
        <KpiCard
          label="SPI (Prazo)"
          value={isFinite(evm.spi) ? evm.spi.toFixed(3) : '—'}
          sub="≥ 1 = no prazo"
          borderColor="border-l-violet-500"
          textColor={indexColor(evm.spi)}
        />
        <KpiCard
          label="CV (Variação Custo)"
          value={isFinite(evm.cv) ? fmtBRL(evm.cv) : '—'}
          sub="positivo = abaixo do orçamento"
          borderColor="border-l-emerald-500"
          textColor={evm.cv >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <KpiCard
          label="SV (Variação Prazo)"
          value={isFinite(evm.sv) ? fmtBRL(evm.sv) : '—'}
          sub="positivo = adiantado"
          borderColor="border-l-amber-500"
          textColor={evm.sv >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
      </div>

      {/* Row 3 Projections */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="EAC (Estimativa Final)" value={isFinite(evm.eac) ? fmtBRL(evm.eac) : '—'} textColor="text-[#f5f5f5]" />
        <KpiCard label="ETC (Custo para Concluir)" value={isFinite(evm.etc) ? fmtBRL(evm.etc) : '—'} textColor="text-[#f5f5f5]" />
        <KpiCard label="VAC (Variação ao Concluir)" value={isFinite(evm.vac) ? fmtBRL(evm.vac) : '—'} textColor={evm.vac >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
        <KpiCard label="TCPI" value={isFinite(evm.tcpi) ? evm.tcpi.toFixed(3) : '—'} sub="eficiência requerida" textColor={indexColor(evm.tcpi, false)} />
      </div>

      {/* S-Curve */}
      <SCurve
        entries={financialEntries}
        budgetBRL={budgetBRL}
        planTotalMeters={planTotalMeters}
        planTotalWorkDays={planTotalWorkDays}
        rdoTrechos={rdoTrechoFlat}
      />

      {/* Category chart */}
      <CategoryChart entries={financialEntries} />

      {/* Financial entries table */}
      <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#525252] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-[#f5f5f5] font-medium text-sm">Lançamentos Financeiros</h3>
            <p className="text-[#6b6b6b] text-xs mt-0.5">
              {financialEntries.length} lançamento{financialEntries.length !== 1 ? 's' : ''}
              &nbsp;· Despesas: {fmtBRL(acBRL)} · Receitas: {fmtBRL(totalRevenue)}
            </p>
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            <Plus size={14} />
            Novo Lançamento
          </button>
        </div>

        {showAddForm && (
          <div className="px-5 py-4 border-b border-[#525252]">
            <AddEntryForm
              onAdd={addFinancialEntry}
              onClose={() => setShowAddForm(false)}
            />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#6b6b6b] text-xs border-b border-[#525252]">
                <th className="text-left px-3 py-2.5 font-medium">Data</th>
                <th className="text-left px-3 py-2.5 font-medium">Categoria</th>
                <th className="text-left px-3 py-2.5 font-medium">Descrição</th>
                <th className="text-right px-3 py-2.5 font-medium">Valor</th>
                <th className="text-center px-3 py-2.5 font-medium">Tipo</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {financialEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-[#6b6b6b] py-10">
                    Nenhum lançamento financeiro. Clique em "Novo Lançamento" para começar.
                  </td>
                </tr>
              )}
              {financialEntries
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onUpdate={updateFinancialEntry}
                    onDelete={handleDelete}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
