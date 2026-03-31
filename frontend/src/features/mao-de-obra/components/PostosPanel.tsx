import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import type { WorkPost } from '@/types'

// ─── WorkPostDialog ────────────────────────────────────────────────────────────

interface WorkPostDialogProps {
  post?: WorkPost
  onClose: () => void
  onSave: (data: Omit<WorkPost, 'id'>) => void
}

function WorkPostDialog({ post, onClose, onSave }: WorkPostDialogProps) {
  const [form, setForm] = useState({
    name:       post?.name       ?? '',
    workFront:  post?.workFront  ?? '',
    role:       post?.role       ?? '',
    minWorkers: post?.minWorkers ?? 1,
    shift:      post?.shift      ?? ('morning' as WorkPost['shift']),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim())      e.name      = 'Nome obrigatório'
    if (!form.workFront.trim()) e.workFront  = 'Frente obrigatória'
    if (!form.role.trim())      e.role       = 'Cargo obrigatório'
    if (form.minWorkers < 1)    e.minWorkers = 'Mínimo 1 trabalhador'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSave(form)
    onClose()
  }

  const labelCls = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1'
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]'
  const errCls   = 'text-xs text-[#ef4444] mt-1'

  const shiftOptions: { value: WorkPost['shift']; label: string }[] = [
    { value: 'morning',   label: 'Manhã'   },
    { value: 'afternoon', label: 'Tarde'   },
    { value: 'night',     label: 'Noite'   },
    { value: 'all',       label: 'Integral'},
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--color-surface-elevated)] rounded-2xl shadow-2xl p-6">
        <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-5">
          {post ? 'Editar Posto' : 'Novo Posto de Trabalho'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Nome do Posto</label>
            <input className={inputCls} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ex: Pedreiro — Fundações" />
            {errors.name && <p className={errCls}>{errors.name}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Frente de Trabalho</label>
              <input className={inputCls} value={form.workFront}
                onChange={e => setForm(f => ({ ...f, workFront: e.target.value }))}
                placeholder="ex: Bloco A" />
              {errors.workFront && <p className={errCls}>{errors.workFront}</p>}
            </div>
            <div>
              <label className={labelCls}>Cargo Requerido</label>
              <input className={inputCls} value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="ex: Pedreiro Oficial" />
              {errors.role && <p className={errCls}>{errors.role}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mínimo de Trabalhadores</label>
              <input type="number" min={1} className={inputCls} value={form.minWorkers}
                onChange={e => setForm(f => ({ ...f, minWorkers: Number(e.target.value) }))} />
              {errors.minWorkers && <p className={errCls}>{errors.minWorkers}</p>}
            </div>
            <div>
              <label className={labelCls}>Turno</label>
              <select className={inputCls} value={form.shift}
                onChange={e => setForm(f => ({ ...f, shift: e.target.value as WorkPost['shift'] }))}>
                {shiftOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Coverage grid helpers ─────────────────────────────────────────────────────

function getWeekDates(baseDate: Date): string[] {
  const monday = new Date(baseDate)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })
}

// ─── PostosPanel ──────────────────────────────────────────────────────────────

export function PostosPanel() {
  const { workPosts, shifts, workers, addWorkPost, updateWorkPost, removeWorkPost } =
    useMaoDeObraStore(useShallow(s => ({
      workPosts:      s.workPosts,
      shifts:         s.shifts,
      workers:        s.workers,
      addWorkPost:    s.addWorkPost,
      updateWorkPost: s.updateWorkPost,
      removeWorkPost: s.removeWorkPost,
    })))

  const [dialogOpen,   setDialogOpen]   = useState(false)
  const [editingPost,  setEditingPost]  = useState<WorkPost | undefined>()
  const [weekOffset,   setWeekOffset]   = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Compute the week dates
  const weekDates = useMemo(() => {
    const base = new Date()
    base.setDate(base.getDate() + weekOffset * 7)
    return getWeekDates(base)
  }, [weekOffset])

  // Coverage matrix: postId → date → { scheduled, required, workers }
  const coverageMatrix = useMemo(() => {
    type CellData = { scheduled: number; required: number; workerNames: string[] }
    const matrix: Record<string, Record<string, CellData>> = {}

    for (const post of workPosts) {
      matrix[post.id] = {}
      for (const date of weekDates) {
        const dayShifts = shifts.filter(s =>
          s.date === date &&
          s.type !== 'day_off' &&
          s.type !== 'holiday' &&
          (s.workFront === post.workFront || !s.workFront)
        )
        const matched = dayShifts.filter(s => {
          const w = workers.find(w => w.id === s.workerId)
          return w?.role === post.role
        })
        matrix[post.id][date] = {
          scheduled:   matched.length,
          required:    post.minWorkers,
          workerNames: matched.map(s => workers.find(w => w.id === s.workerId)?.name ?? s.workerId),
        }
      }
    }
    return matrix
  }, [workPosts, shifts, workers, weekDates])

  // Summary stats
  const totalPosts    = workPosts.length
  const coveredToday  = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return workPosts.filter(p => {
      const cell = coverageMatrix[p.id]?.[today]
      return cell ? cell.scheduled >= cell.required : false
    }).length
  }, [workPosts, coverageMatrix])
  const uncoveredNow = totalPosts - coveredToday

  function openNew() { setEditingPost(undefined); setDialogOpen(true) }
  function openEdit(p: WorkPost) { setEditingPost(p); setDialogOpen(true) }

  function handleSave(data: Omit<WorkPost, 'id'>) {
    if (editingPost) {
      updateWorkPost(editingPost.id, data)
    } else {
      addWorkPost(data)
    }
  }

  const shiftLabel: Record<WorkPost['shift'], string> = {
    morning: 'Manhã', afternoon: 'Tarde', night: 'Noite', all: 'Integral',
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          {[
            { label: 'Total de Postos', value: totalPosts,  color: 'text-[var(--color-text-primary)]' },
            { label: 'Cobertos Hoje',   value: coveredToday,  color: 'text-[#22c55e]' },
            { label: 'Descobertos',     value: uncoveredNow,  color: uncoveredNow > 0 ? 'text-[#ef4444]' : 'text-[var(--color-text-secondary)]' },
          ].map(stat => (
            <div key={stat.label}
              className="flex flex-col items-center px-4 py-2 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
              <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
              <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{stat.label}</span>
            </div>
          ))}
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
          <span className="text-lg leading-none">+</span> Novo Posto
        </button>
      </div>

      {/* Posts table */}
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                {['Nome do Posto', 'Frente', 'Cargo', 'Mín. Trabalhadores', 'Turno', 'Ações'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {workPosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                    Nenhum posto cadastrado
                  </td>
                </tr>
              ) : workPosts.map(post => (
                <tr key={post.id} className="hover:bg-[var(--color-surface)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{post.name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{post.workFront}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{post.role}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-bold text-xs">
                      {post.minWorkers}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                      {shiftLabel[post.shift]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(post)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => setConfirmDelete(post.id)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors">
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coverage calendar */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Cobertura Semanal por Posto</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors">
              ‹
            </button>
            <span className="text-xs text-[var(--color-text-secondary)] min-w-[120px] text-center">
              {formatDateShort(weekDates[0])} — {formatDateShort(weekDates[6])}
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors">
              ›
            </button>
          </div>
        </div>

        {workPosts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">
            Cadastre postos para visualizar a cobertura
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider min-w-[180px]">
                    Posto
                  </th>
                  {weekDates.map(date => {
                    const dow = new Date(date + 'T12:00:00').getDay()
                    const isSun = dow === 0
                    return (
                      <th key={date} className={`px-2 py-2 text-center font-semibold ${isSun ? 'text-[#ef4444]/70' : 'text-[var(--color-text-secondary)]'} uppercase tracking-wider min-w-[80px]`}>
                        {formatDateShort(date)}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {workPosts.map(post => (
                  <tr key={post.id} className="hover:bg-[var(--color-surface)]/50 transition-colors">
                    <td className="sticky left-0 z-10 bg-[var(--color-surface-elevated)] px-4 py-2 font-medium text-[var(--color-text-primary)]">
                      <div>{post.name}</div>
                      <div className="text-[var(--color-text-muted)]">{post.workFront}</div>
                    </td>
                    {weekDates.map(date => {
                      const cell = coverageMatrix[post.id]?.[date]
                      if (!cell) return <td key={date} className="px-2 py-2 text-center">—</td>

                      const dow = new Date(date + 'T12:00:00').getDay()
                      const isSun = dow === 0
                      if (isSun) {
                        return (
                          <td key={date} className="px-2 py-2 text-center">
                            <span className="text-[var(--color-text-muted)]">DSR</span>
                          </td>
                        )
                      }

                      const covered = cell.scheduled >= cell.required
                      const partial = !covered && cell.scheduled > 0
                      const bgCls = covered ? 'bg-[#22c55e]/15 text-[#22c55e]'
                                  : partial  ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
                                  :            'bg-[#ef4444]/15 text-[#ef4444]'

                      return (
                        <td key={date} className="px-2 py-2 text-center">
                          <div className={`inline-flex flex-col items-center justify-center rounded-lg px-2 py-1 min-w-[52px] ${bgCls}`}>
                            <span className="font-bold text-sm">{cell.scheduled}/{cell.required}</span>
                            {cell.workerNames.length > 0 && (
                              <span className="text-[10px] leading-tight opacity-80 max-w-[70px] truncate">
                                {cell.workerNames[0].split(' ')[0]}
                                {cell.workerNames.length > 1 ? ` +${cell.workerNames.length - 1}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-2 border-t border-[var(--color-border)]">
          {[
            { color: 'bg-[#22c55e]/15 text-[#22c55e]', label: 'Coberto' },
            { color: 'bg-[#f59e0b]/15 text-[#f59e0b]', label: 'Parcial' },
            { color: 'bg-[#ef4444]/15 text-[#ef4444]', label: 'Descoberto' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded ${color.split(' ')[0]}`} />
              <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dialogs */}
      {dialogOpen && (
        <WorkPostDialog
          post={editingPost}
          onClose={() => setDialogOpen(false)}
          onSave={handleSave}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[var(--color-surface-elevated)] rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-2">Remover Posto</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              Tem certeza que deseja remover este posto? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">
                Cancelar
              </button>
              <button onClick={() => { removeWorkPost(confirmDelete); setConfirmDelete(null) }}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ef4444] text-white hover:opacity-90 transition-opacity">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
