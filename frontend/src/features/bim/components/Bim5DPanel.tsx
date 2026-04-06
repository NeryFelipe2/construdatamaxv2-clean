import { useState } from 'react'
import { RefreshCw, Check, DollarSign } from 'lucide-react'
import { useBimStore } from '@/store/bimStore'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function Bim5DPanel() {
  const project           = useBimStore((s) => s.project)
  const setColorMode      = useBimStore((s) => s.setColorMode)
  const syncWithQuant     = useBimStore((s) => s.syncWithQuantitativos)

  const [syncingQ, setSyncingQ] = useState(false)
  const [syncedQ,  setSyncedQ]  = useState(false)

  async function handleSyncQuant() {
    setSyncingQ(true)
    await syncWithQuant()
    setSyncingQ(false)
    setSyncedQ(true)
    setTimeout(() => setSyncedQ(false), 3000)
    setColorMode('cost')
  }

  async function handleSyncSinapi() {
    try {
      const { mockSinapi } = await import('@/data/mockSinapi')
      const store = useBimStore.getState()
      if (!store.project) return
      const updated = store.project.segments.map((seg) => {
        const dn = `DN${seg.diameter}`
        const match = mockSinapi.find((s) =>
          s.description.toLowerCase().includes(dn.toLowerCase()) ||
          s.description.toLowerCase().includes(seg.material.toLowerCase()),
        )
        if (!match) return seg
        return { ...seg, unitCostBRL: match.unitCost, totalCostBRL: Math.round(seg.lengthM * match.unitCost) }
      })
      const newProject = { ...store.project, segments: updated }
      const newProjects = store.projects.map((p) => p.id === store.activeProjectId ? newProject : p)
      useBimStore.setState({ project: newProject, projects: newProjects })
      setColorMode('cost')
    } catch { /* silently ignore */ }
  }

  if (!project) {
    return (
      <div className="h-24 bg-[#2c2c2c] border-t border-[#3d3d3d] flex items-center justify-center">
        <p className="text-gray-600 text-xs">Carregue um projeto para usar a análise 5D</p>
      </div>
    )
  }

  const segs        = project.segments
  const totalCost   = segs.reduce((s, seg) => s + seg.totalCostBRL, 0)
  const totalLength = segs.reduce((s, seg) => s + seg.lengthM, 0)

  const byMaterial  = segs.reduce<Record<string, { cost: number; count: number }>>((acc, s) => {
    const mat = s.material || 'N/A'
    if (!acc[mat]) acc[mat] = { cost: 0, count: 0 }
    acc[mat].cost += s.totalCostBRL; acc[mat].count += 1; return acc
  }, {})

  const byDiam = segs.reduce<Record<string, { cost: number; count: number }>>((acc, s) => {
    const dn = s.diameter ? `DN${s.diameter}` : (s.elementType ?? 'N/A')
    if (!acc[dn]) acc[dn] = { cost: 0, count: 0 }
    acc[dn].cost += s.totalCostBRL; acc[dn].count += 1; return acc
  }, {})

  const matEntries  = Object.entries(byMaterial).sort((a, b) => b[1].cost - a[1].cost)
  const diamEntries = Object.entries(byDiam).sort((a, b) => b[1].cost - a[1].cost)

  return (
    <div className="bg-[#2c2c2c] border-t border-[#3d3d3d] flex items-start gap-5 px-4 py-2 shrink-0 overflow-x-auto">
      {/* Total + actions */}
      <div className="flex flex-col shrink-0 min-w-[130px]">
        <div className="flex items-center gap-1 mb-0.5">
          <DollarSign size={12} className="text-green-400" />
          <span className="text-[#a3a3a3] text-[10px] font-semibold uppercase tracking-wider">Análise 5D</span>
        </div>
        <span className="text-green-400 font-bold text-base leading-tight">{fmtBRL(totalCost)}</span>
        <span className="text-gray-600 text-xs">
          {totalLength > 0 ? fmtBRL(Math.round(totalCost / totalLength)) : '—'}/m
        </span>
        <div className="flex flex-col gap-1 mt-2">
          <button
            onClick={handleSyncQuant}
            disabled={syncingQ}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 transition-colors disabled:opacity-50"
          >
            {syncedQ ? <><Check size={10} className="text-green-400" /> Sincronizado</> :
             syncingQ ? <><RefreshCw size={10} className="animate-spin" /> …</> :
             <><RefreshCw size={10} /> Quantitativos</>}
          </button>
          <button
            onClick={handleSyncSinapi}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 transition-colors"
          >
            <RefreshCw size={10} /> SINAPI
          </button>
        </div>
      </div>

      <div className="w-px bg-[#3d3d3d] self-stretch shrink-0" />

      {/* By material */}
      <div className="shrink-0">
        <p className="text-[#6b6b6b] text-[10px] font-semibold uppercase tracking-wider mb-1">Por Material</p>
        <div className="space-y-0.5">
          {matEntries.slice(0, 4).map(([mat, { cost, count }]) => (
            <BarRow key={mat} label={mat} sub={`${count} elem.`} cost={cost} totalCost={totalCost} color="bg-green-500" />
          ))}
        </div>
      </div>

      <div className="w-px bg-[#3d3d3d] self-stretch shrink-0" />

      {/* By diameter / element type */}
      <div className="shrink-0">
        <p className="text-[#6b6b6b] text-[10px] font-semibold uppercase tracking-wider mb-1">
          {project.type === 'building' ? 'Por Elemento' : 'Por Diâmetro'}
        </p>
        <div className="space-y-0.5">
          {diamEntries.slice(0, 4).map(([dn, { cost, count }]) => (
            <BarRow key={dn} label={dn} sub={`${count} elem.`} cost={cost} totalCost={totalCost} color="bg-indigo-500" />
          ))}
        </div>
      </div>

      <div className="w-px bg-[#3d3d3d] self-stretch shrink-0" />

      {/* Heatmap legend + toggle */}
      <div className="shrink-0 ml-auto flex flex-col justify-between h-full">
        <p className="text-[#6b6b6b] text-[10px] font-semibold uppercase tracking-wider mb-1">Heatmap de Custo</p>
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-600 text-[10px]">Baixo</span>
          <div className="w-20 h-3 rounded" style={{ background: 'linear-gradient(to right, #f9fafb, #f97316, #ef4444)' }} />
          <span className="text-gray-600 text-[10px]">Alto</span>
        </div>
        <p className="text-gray-700 text-[10px] mb-1.5">custo/m linear</p>
        <button
          onClick={() => setColorMode('cost')}
          className="px-2 py-1 rounded text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        >
          Ver heatmap
        </button>
      </div>
    </div>
  )
}

function BarRow({ label, sub, cost, totalCost, color }: {
  label: string; sub: string; cost: number; totalCost: number; color: string
}) {
  const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#f5f5f5] text-xs w-16 truncate">{label}</span>
      <span className="text-gray-600 text-[10px] w-12">{sub}</span>
      <span className="text-green-400 text-xs font-medium w-20">
        {cost >= 1000 ? `R$ ${(cost/1000).toFixed(0)}k` : `R$ ${cost}`}
      </span>
      <div className="w-14 h-1.5 bg-[#3d3d3d] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
