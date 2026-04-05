import { useEffect, useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { usePreConstrucaoStore } from '@/store/preConstrucaoStore'
import { mockSinapi } from '@/data/mockSinapi'
import { mockSeinfra } from '@/data/mockSeinfra'
import type { CostMatch, SinapiEntry, TakeoffItem, CostSource } from '@/types'

// ─── Matching algorithm ──────────────────────────────────────────────────────

function scoreMatch(itemDesc: string, entryDesc: string): number {
  const aWords = itemDesc.toLowerCase().split(/\s+/).filter(Boolean)
  const bWords = entryDesc.toLowerCase().split(/\s+/).filter(Boolean)
  const aSet = new Set(aWords)
  const bSet = new Set(bWords)
  let matching = 0
  for (const w of aSet) if (bSet.has(w)) matching++
  const maxWords = Math.max(aSet.size, bSet.size)
  if (maxWords === 0) return 0
  return Math.round((matching / maxWords) * 100)
}

function findTopMatches(
  item: TakeoffItem,
  database: SinapiEntry[],
  source: CostSource,
  topN = 3,
  minScore = 20,
): CostMatch[] {
  const scored = database
    .map((entry) => ({
      entry,
      score: scoreMatch(item.description, entry.description),
    }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)

  return scored.map(({ entry, score }, idx) => ({
    takeoffItemId:  item.id,
    source,
    code:           entry.code,
    description:    entry.description,
    unit:           entry.unit,
    unitCost:       entry.unitCost,
    score,
    selected:       idx === 0,
  }))
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 70 ? 'bg-[#16a34a]/20 text-[#4ade80]' :
    score >= 50 ? 'bg-[#ca8a04]/20 text-[#fbbf24]' :
                  'bg-[#dc2626]/20 text-[#f87171]'
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', cls)}>
      {score}%
    </span>
  )
}

interface MatchTableProps {
  items:        TakeoffItem[]
  matches:      CostMatch[]
  source:       CostSource
  onToggle:     (takeoffItemId: string, code: string, source: string) => void
  onOverride:   (takeoffItemId: string, code: string, source: string, price: number) => void
}

function MatchTable({ items, matches, source, onToggle, onOverride }: MatchTableProps) {
  const sourceMatches = matches.filter((m) => m.source === source)

  if (items.length === 0) {
    return (
      <div className="text-[#6b6b6b] text-sm text-center py-10">
        Nenhum item para matching
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const itemMatches = sourceMatches.filter((m) => m.takeoffItemId === item.id)

        return (
          <div key={item.id} className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-x-auto overflow-hidden">
            {/* Item header */}
            <div className="px-4 py-2.5 bg-[#484848] border-b border-[#525252] flex items-center gap-3">
              <span className="text-[#f5f5f5] text-sm font-medium flex-1">{item.description}</span>
              <span className="text-[#6b6b6b] text-xs tabular-nums">
                {item.quantity.toLocaleString('pt-BR')} {item.unit}
              </span>
            </div>

            {/* Matches table */}
            {itemMatches.length === 0 ? (
              <p className="text-[#6b6b6b] text-xs px-4 py-3">Sem correspondências encontradas</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#2c2c2c]">
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-8">Sel.</th>
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-24">Código</th>
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2">Descrição</th>
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-10">Un</th>
                    <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-28">Custo Unit.</th>
                    <th className="text-center text-[#6b6b6b] font-medium px-3 py-2 w-14">Score</th>
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-32">Override R$</th>
                  </tr>
                </thead>
                <tbody>
                  {itemMatches.map((m) => (
                    <tr
                      key={`${m.code}-${m.source}`}
                      className={cn(
                        'border-t border-[#525252] transition-colors',
                        m.selected ? 'bg-[#f97316]/5' : 'hover:bg-[#484848]',
                      )}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="radio"
                          name={`match-${item.id}-${source}`}
                          checked={m.selected}
                          onChange={() => onToggle(item.id, m.code, source)}
                          className="accent-[#f97316] cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 text-[#a3a3a3] font-mono">{m.code}</td>
                      <td className="px-3 py-2 text-[#f5f5f5]">{m.description}</td>
                      <td className="px-3 py-2 text-[#a3a3a3]">{m.unit}</td>
                      <td className="px-3 py-2 text-right text-[#f5f5f5] tabular-nums">
                        {(m.overrideUnitCost ?? m.unitCost).toLocaleString('pt-BR', {
                          style: 'currency', currency: 'BRL',
                        })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <ScoreBadge score={m.score} />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          defaultValue={m.overrideUnitCost ?? m.unitCost}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v >= 0) onOverride(item.id, m.code, source, v)
                          }}
                          className="w-full bg-[#333333] border border-[#1f3c5e] rounded px-2 py-1 text-[#f5f5f5] text-xs focus:outline-none focus:border-[#f97316]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Custom base tab ─────────────────────────────────────────────────────────

interface CustomBaseTabProps {
  customBase:      SinapiEntry[]
  onAdd:           (entry: Omit<SinapiEntry, 'referenceDate' | 'state'>) => void
  onRemove:        (code: string) => void
}

function CustomBaseTab({ customBase, onAdd, onRemove }: CustomBaseTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', description: '', unit: '', unitCost: '', category: '' })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cost = parseFloat(form.unitCost.replace(',', '.'))
    if (!form.code || !form.description || !form.unit || isNaN(cost)) return
    onAdd({
      code:        form.code,
      description: form.description,
      unit:        form.unit,
      unitCost:    cost,
      category:    form.category || 'Personalizado',
    })
    setForm({ code: '', description: '', unit: '', unitCost: '', category: '' })
    setShowForm(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[#a3a3a3] text-xs">
          {customBase.length} {customBase.length === 1 ? 'entrada' : 'entradas'} na base própria
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-xs font-semibold transition-colors"
        >
          <Plus size={12} />
          Adicionar
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#3d3d3d] border border-[#f97316]/30 rounded-xl p-4 flex flex-col gap-3"
        >
          <p className="text-[#f5f5f5] text-xs font-semibold">Nova entrada</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Código"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="bg-[#333333] border border-[#1f3c5e] rounded px-3 py-1.5 text-[#f5f5f5] text-xs placeholder:text-[#555] focus:outline-none focus:border-[#f97316]"
              required
            />
            <input
              placeholder="Unidade"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className="bg-[#333333] border border-[#1f3c5e] rounded px-3 py-1.5 text-[#f5f5f5] text-xs placeholder:text-[#555] focus:outline-none focus:border-[#f97316]"
              required
            />
            <input
              placeholder="Descrição"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="col-span-2 bg-[#333333] border border-[#1f3c5e] rounded px-3 py-1.5 text-[#f5f5f5] text-xs placeholder:text-[#555] focus:outline-none focus:border-[#f97316]"
              required
            />
            <input
              placeholder="Custo unitário (R$)"
              value={form.unitCost}
              onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
              className="bg-[#333333] border border-[#1f3c5e] rounded px-3 py-1.5 text-[#f5f5f5] text-xs placeholder:text-[#555] focus:outline-none focus:border-[#f97316]"
              required
            />
            <input
              placeholder="Categoria"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="bg-[#333333] border border-[#1f3c5e] rounded px-3 py-1.5 text-[#f5f5f5] text-xs placeholder:text-[#555] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded text-xs text-[#a3a3a3] hover:text-[#f5f5f5] border border-[#1f3c5e] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-[#f97316] hover:bg-[#ea6c0a] text-white text-xs font-semibold transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      )}

      {customBase.length === 0 ? (
        <div className="text-[#6b6b6b] text-sm text-center py-10">
          Nenhuma entrada na base própria
        </div>
      ) : (
        <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-x-auto overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#484848]">
                <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-24">Código</th>
                <th className="text-left text-[#6b6b6b] font-medium px-3 py-2">Descrição</th>
                <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-16">Un</th>
                <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-28">Custo Unit.</th>
                <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-24">Categoria</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {customBase.map((entry) => (
                <tr key={entry.code} className="border-t border-[#525252] hover:bg-[#484848] transition-colors">
                  <td className="px-3 py-2 text-[#a3a3a3] font-mono">{entry.code}</td>
                  <td className="px-3 py-2 text-[#f5f5f5]">{entry.description}</td>
                  <td className="px-3 py-2 text-[#a3a3a3]">{entry.unit}</td>
                  <td className="px-3 py-2 text-right text-[#f5f5f5] tabular-nums">
                    {entry.unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-3 py-2 text-[#6b6b6b]">{entry.category}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onRemove(entry.code)}
                      className="text-[#6b6b6b] hover:text-[#ef4444] transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'sinapi' | 'seinfra' | 'custom'

export function CostMatchingView() {
  const [activeTab, setActiveTab] = useState<Tab>('sinapi')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const {
    takeoffItems,
    costMatches,
    customBase,
    sinapiLastRefresh,
    setCostMatches,
    toggleMatch,
    overridePrice,
    addCustomEntry,
    removeCustomEntry,
    setStep,
    saveSession,
    setSinapiLastRefresh,
    uploadedFiles,
  } = usePreConstrucaoStore(useShallow((s) => ({
    takeoffItems:         s.takeoffItems,
    costMatches:          s.costMatches,
    customBase:           s.customBase,
    sinapiLastRefresh:    s.sinapiLastRefresh,
    setCostMatches:       s.setCostMatches,
    toggleMatch:          s.toggleMatch,
    overridePrice:        s.overridePrice,
    addCustomEntry:       s.addCustomEntry,
    removeCustomEntry:    s.removeCustomEntry,
    setStep:              s.setStep,
    saveSession:          s.saveSession,
    setSinapiLastRefresh: s.setSinapiLastRefresh,
    uploadedFiles:        s.uploadedFiles,
  })))

  function handleRefreshSinapi() {
    setIsRefreshing(true)
    setTimeout(() => {
      setSinapiLastRefresh(new Date().toISOString().slice(0, 10))
      setIsRefreshing(false)
    }, 1500)
  }

  // Run matching once on mount if no matches yet
  useEffect(() => {
    if (costMatches.length > 0 || takeoffItems.length === 0) return

    const allMatches: CostMatch[] = []
    for (const item of takeoffItems) {
      const sinapiMatches  = findTopMatches(item, mockSinapi,  'sinapi',  3, 20)
      const seinfraMatches = findTopMatches(item, mockSeinfra, 'seinfra', 3, 20)
      allMatches.push(...sinapiMatches, ...seinfraMatches)
    }
    setCostMatches(allMatches)
  }, [takeoffItems, costMatches.length, setCostMatches])

  function handleAdvance() {
    // Compute total cost from selected matches
    const selectedMatches = costMatches.filter((m) => m.selected)
    let totalCost = 0
    for (const m of selectedMatches) {
      const item = takeoffItems.find((i) => i.id === m.takeoffItemId)
      if (item) {
        totalCost += item.quantity * (m.overrideUnitCost ?? m.unitCost)
      }
    }
    saveSession(
      uploadedFiles.map((f) => f.name),
      takeoffItems.length,
      totalCost,
    )
    setStep('proposal')
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'sinapi',  label: 'SINAPI' },
    { key: 'seinfra', label: 'SEINFRA' },
    { key: 'custom',  label: 'Base Própria' },
  ]

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* SINAPI refresh indicator */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] text-[#6b6b6b]">
          Base atualizada em: <span className="text-[#a3a3a3]">{new Date(sinapiLastRefresh + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
        </span>
        <button
          onClick={handleRefreshSinapi}
          disabled={isRefreshing}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-[#525252] text-[#6b6b6b] hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[#2c2c2c] border border-[#525252] rounded-lg p-1 self-start">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-1.5 rounded text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-[#f97316] text-white'
                : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'sinapi' && (
          <MatchTable
            items={takeoffItems}
            matches={costMatches}
            source="sinapi"
            onToggle={toggleMatch}
            onOverride={overridePrice}
          />
        )}
        {activeTab === 'seinfra' && (
          <MatchTable
            items={takeoffItems}
            matches={costMatches}
            source="seinfra"
            onToggle={toggleMatch}
            onOverride={overridePrice}
          />
        )}
        {activeTab === 'custom' && (
          <CustomBaseTab
            customBase={customBase}
            onAdd={addCustomEntry}
            onRemove={removeCustomEntry}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 shrink-0">
        <button
          onClick={() => setStep('normalization')}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[#1f3c5e] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555] transition-colors"
        >
          ← Voltar
        </button>
        <button
          onClick={handleAdvance}
          className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#f97316] hover:bg-[#ea6c0a] text-white transition-colors"
        >
          Avançar → Proposta
        </button>
      </div>
    </div>
  )
}
