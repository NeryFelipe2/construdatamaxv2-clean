import { useState, useRef, useEffect, useCallback } from 'react'
import { Kanban } from 'lucide-react'
import { useCurrentReport } from '@/hooks/useRelatorio360'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { useShallow } from 'zustand/react/shallow'
import type { Activity, ActivityStatus } from '@/types'
import { KanbanColumn } from './KanbanColumn'
import { ActivityCard } from './ActivityCard'
import { ActivityEditModal } from './ActivityEditModal'

const STATUSES: ActivityStatus[] = ['planned', 'in_progress', 'completed']

interface DragState {
  activity: Activity
  x: number
  y: number
  targetColumn: ActivityStatus | null
}

export function KanbanBoard() {
  const report = useCurrentReport()
  const { moveActivity, updateActivity } = useRelatorio360Store(
    useShallow((s) => ({ moveActivity: s.moveActivity, updateActivity: s.updateActivity }))
  )

  const [drag, setDrag]           = useState<DragState | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const colRefs = useRef<Partial<Record<ActivityStatus, HTMLDivElement | null>>>({
    planned: null,
    in_progress: null,
    completed: null,
  })
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => { cleanupRef.current?.() }
  }, [])

  const activities = report?.activities ?? []

  function getTargetColumn(x: number, y: number): ActivityStatus | null {
    for (const status of STATUSES) {
      const el = colRefs.current[status]
      if (el) {
        const rect = el.getBoundingClientRect()
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return status
        }
      }
    }
    return null
  }

  const handleGripPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, activity: Activity) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      setDrag({ activity, x: e.clientX, y: e.clientY, targetColumn: activity.status })

      function onMove(ev: PointerEvent) {
        const target = getTargetColumn(ev.clientX, ev.clientY)
        setDrag((d) => d ? { ...d, x: ev.clientX, y: ev.clientY, targetColumn: target } : null)
      }

      function onUp(ev: PointerEvent) {
        el.removeEventListener('pointermove', onMove)
        cleanupRef.current = null
        const target = getTargetColumn(ev.clientX, ev.clientY)
        setDrag(null)
        if (target && target !== activity.status) {
          moveActivity(activity.id, target)
        }
      }

      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp, { once: true })
      cleanupRef.current = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
    },
    [moveActivity]
  )

  function handleSaveActivity(patch: Partial<Omit<Activity, 'id'>>) {
    if (!editingId) return
    updateActivity(editingId, patch)

    // Cross-module sync: update projetosStore phase progress if name matches
    try {
      const { projects, updatePhase } = useProjetosStore.getState()
      const act = activities.find((a) => a.id === editingId)
      if (act && patch.plannedQty !== undefined && patch.actualQty !== undefined) {
        const updatedName = patch.name ?? act.name
        const firstWord   = updatedName.split(/\s+/)[0].toLowerCase()
        for (const proj of projects) {
          for (const phase of proj.executionPhases) {
            if (phase.name.toLowerCase().includes(firstWord)) {
              const newProgress = Math.min(100, Math.round((patch.actualQty / Math.max(1, patch.plannedQty)) * 100))
              updatePhase(proj.id, 'execution', phase.id, { progress: newProgress })
              break
            }
          }
        }
      }
    } catch {
      // Best-effort — no crash
    }

    setEditingId(null)
  }

  const editingActivity = editingId ? activities.find((a) => a.id === editingId) ?? null : null

  return (
    <div className="flex flex-col gap-3" style={{ userSelect: 'none' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] flex items-center gap-2">
          <Kanban size={13} />
          Atividades do Dia
        </h2>
        <span className="text-xs font-mono text-[#6b6b6b]">{activities.length} atividades</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            activities={activities.filter((a) => a.status === status)}
            isOver={drag?.targetColumn === status}
            draggingId={drag?.activity.id ?? null}
            colRef={(el) => { colRefs.current[status] = el }}
            onGripPointerDown={handleGripPointerDown}
            onEditActivity={(id) => setEditingId(id)}
          />
        ))}
      </div>

      {/* Drag overlay */}
      {drag && (
        <div
          style={{
            position: 'fixed',
            left: drag.x + 14,
            top: drag.y - 24,
            width: 280,
            pointerEvents: 'none',
            zIndex: 9999,
            transform: 'rotate(2deg) scale(1.03)',
          }}
        >
          <ActivityCard activity={drag.activity} isOverlay />
        </div>
      )}

      {/* Edit modal */}
      {editingActivity && (
        <ActivityEditModal
          activity={editingActivity}
          crews={report?.crews ?? []}
          onClose={() => setEditingId(null)}
          onSave={handleSaveActivity}
        />
      )}
    </div>
  )
}
