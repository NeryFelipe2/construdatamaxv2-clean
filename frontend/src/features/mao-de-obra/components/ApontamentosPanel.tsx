import { useState, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Upload, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { TimecardDialog } from './dialogs/TimecardDialog'
import type { TimecardEntry, PhysicalProgress } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ─── Physical Progress sub-table ──────────────────────────────────────────────

function ProgressTable({ progress }: { progress: PhysicalProgress[] }) {
  // Aggregate by activity
  const map = new Map<string, { planned: number; reported: number; unit: string }>()
  for (const p of progress) {
    const ex = map.get(p.activityName)
    if (ex) {
      ex.planned  += p.plannedQty
      ex.reported += p.reportedQty
    } else {
      map.set(p.activityName, { planned: p.plannedQty, reported: p.reportedQty, unit: p.unit })
    }
  }

  const rows = Array.from(map.entries()).map(([name, v]) => ({
    name,
    ...v,
    deviation: v.planned > 0 ? Math.round(((v.reported - v.planned) / v.planned) * 100) : 0,
  }))

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Progresso Físico Acumulado</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#525252]">
              <th className="text-left text-[#6b6b6b] font-medium pb-2">Atividade</th>
              <th className="text-right text-[#6b6b6b] font-medium pb-2">Planejado</th>
              <th className="text-right text-[#6b6b6b] font-medium pb-2">Realizado</th>
              <th className="text-right text-[#6b6b6b] font-medium pb-2">Desvio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[#3d3d3d] last:border-0">
                <td className="py-2 text-[#f5f5f5]">{row.name}</td>
                <td className="py-2 text-right text-[#6b6b6b]">{row.planned} {row.unit}</td>
                <td className="py-2 text-right text-[#f5f5f5]">{row.reported} {row.unit}</td>
                <td className="py-2 text-right">
                  <span
                    className="font-semibold"
                    style={{
                      color: row.deviation >= 0 ? '#22c55e' : row.deviation >= -15 ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {row.deviation >= 0 ? '+' : ''}{row.deviation}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Timecard Table ───────────────────────────────────────────────────────────

function TimecardTable({
  timecards,
  workers,
}: {
  timecards: TimecardEntry[]
  workers: import('@/types').Worker[]
}) {
  const [showAll, setShowAll] = useState(false)
  const workerMap = new Map(workers.map((w) => [w.id, w.name]))

  const sorted = [...timecards].sort((a, b) => b.date.localeCompare(a.date))
  const visible = showAll ? sorted : sorted.slice(0, 10)

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Apontamentos ({timecards.length})</p>
      {timecards.length === 0 ? (
        <p className="text-[#6b6b6b] text-sm">Nenhum apontamento registrado.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#525252]">
                  <th className="text-left text-[#6b6b6b] font-medium pb-2">Data</th>
                  <th className="text-left text-[#6b6b6b] font-medium pb-2">Funcionário</th>
                  <th className="text-left text-[#6b6b6b] font-medium pb-2 hidden md:table-cell">Atividade</th>
                  <th className="text-right text-[#6b6b6b] font-medium pb-2">HH</th>
                  <th className="text-right text-[#6b6b6b] font-medium pb-2">Qtd</th>
                  <th className="text-left text-[#6b6b6b] font-medium pb-2">Un</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((tc) => (
                  <tr key={tc.id} className="border-b border-[#3d3d3d] last:border-0">
                    <td className="py-2 text-[#6b6b6b] shrink-0">{formatDate(tc.date)}</td>
                    <td className="py-2 text-[#f5f5f5] max-w-[120px] truncate">
                      {workerMap.get(tc.workerId) ?? tc.workerId}
                    </td>
                    <td className="py-2 text-[#f5f5f5] max-w-[200px] truncate hidden md:table-cell">
                      {tc.activityDescription}
                    </td>
                    <td className="py-2 text-right text-[#f5f5f5]">{tc.hoursWorked}h</td>
                    <td className="py-2 text-right text-[#f5f5f5]">{tc.reportedQty}</td>
                    <td className="py-2 text-[#6b6b6b]">{tc.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > 10 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"
            >
              {showAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showAll ? 'Mostrar menos' : `Ver todos (${sorted.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ApontamentosPanel() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImporting,  setIsImporting]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { workers, timecards, progress, importTimecards } = useMaoDeObraStore(
    useShallow((s) => ({
      workers:        s.workers,
      timecards:      s.timecards,
      progress:       s.progress,
      importTimecards: s.importTimecards,
    }))
  )

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!fileRef.current) return
    fileRef.current.value = ''
    if (!file) return

    // Validate MIME/extension client-side
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'csv'].includes(ext ?? '')) {
      alert('Arquivo inválido. Apenas .xlsx e .csv são aceitos.')
      return
    }

    // Simulate import: inject mock entries after a brief delay
    setIsImporting(true)
    setTimeout(() => {
      const today = new Date().toISOString().slice(0, 10)
      const mockImport: Array<Omit<import('@/types').TimecardEntry, 'id'>> = [
        { workerId: 'w-3', date: today, hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: '[Importado] Apoio alvenaria bloco D', reportedQty: 0, unit: 'serv' },
        { workerId: 'w-6', date: today, hoursWorked: 8, projectRef: 'PRJ-001', phaseRef: 'Construção', activityDescription: '[Importado] Pintura tecto garagem', reportedQty: 60, unit: 'm²' },
      ]
      importTimecards(mockImport)
      setIsImporting(false)
    }, 1200)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold transition-colors"
        >
          <Plus size={15} />
          Novo Apontamento
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={isImporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-sm font-medium hover:bg-[#484848] transition-colors disabled:opacity-50"
        >
          {isImporting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {isImporting ? 'Importando...' : 'Importar Planilha'}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      <TimecardTable timecards={timecards} workers={workers} />
      <ProgressTable progress={progress} />

      {isDialogOpen && <TimecardDialog onClose={() => setIsDialogOpen(false)} />}
    </div>
  )
}
