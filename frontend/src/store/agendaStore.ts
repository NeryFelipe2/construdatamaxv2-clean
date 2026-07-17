import { create } from 'zustand'
import { addDays, format, parseISO } from 'date-fns'
import type { AgendaTask, AgendaResource, AgendaViewMode, AgendaDisplayView } from '@/types'
import { mockTasks, mockResources, INITIAL_VIEW_START, INITIAL_VISIBLE_WEEKS } from '@/data/mockAgenda'
import { salvarAgendaTask, removerAgendaTask } from '@/hooks/useAgendaSupabase'

const PAN_DAYS: Record<AgendaViewMode, number> = {
  day:      7,
  week:     28,
  month:    90,
  quarter:  91,
  semester: 182,
  year:     365,
}

interface AgendaState {
  tasks: AgendaTask[]
  resources: AgendaResource[]
  viewStart: string         // 'yyyy-MM-dd', always a Monday
  visibleWeeks: number
  viewMode: AgendaViewMode
  selectedTaskId: string | null
  editingTaskId: string | null   // 'new' | task.id | null
  displayView: AgendaDisplayView

  addTask: (task: Omit<AgendaTask, 'id'>) => void
  updateTask: (id: string, updates: Partial<Omit<AgendaTask, 'id'>>) => void
  deleteTask: (id: string) => void
  moveTask: (id: string, newStart: string, newEnd: string) => void

  // Hidratação a partir do Supabase (agenda_tasks + wcr_equipes/wcr_veiculos)
  // — chamada pela AgendaPage no mount, mesmo padrão de
  // planejamentoStore.hidratarTrechos/hidratarTeams. Sempre incondicional
  // (mesmo com array vazio) pra nunca deixar dado antigo na tela.
  hidratarTasks: (tasks: AgendaTask[]) => void
  hidratarResources: (resources: AgendaResource[]) => void

  panLeft: () => void
  panRight: () => void
  zoomIn: () => void
  zoomOut: () => void
  setViewMode: (mode: AgendaViewMode) => void
  setViewStart: (d: string) => void
  setVisibleWeeks: (n: number) => void

  selectTask: (id: string | null) => void
  setEditingTask: (id: string | null) => void
  setDisplayView: (view: AgendaDisplayView) => void
  loadDemoData: () => void
  clearData: () => void
}

export const useAgendaStore = create<AgendaState>((set, get) => ({
  tasks: mockTasks,
  resources: mockResources,
  viewStart: INITIAL_VIEW_START,
  visibleWeeks: INITIAL_VISIBLE_WEEKS,
  viewMode: 'week',
  selectedTaskId: null,
  editingTaskId: null,
  displayView: 'gantt',

  addTask: (task) => {
    const newTask: AgendaTask = { ...task, id: crypto.randomUUID() }
    set((s) => ({ tasks: [...s.tasks, newTask] }))
    salvarAgendaTask(newTask)
  },

  updateTask: (id, updates) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
    const updated = get().tasks.find((t) => t.id === id)
    if (updated) salvarAgendaTask(updated)
  },

  deleteTask: (id) => {
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      editingTaskId: s.editingTaskId === id ? null : s.editingTaskId,
    }))
    removerAgendaTask(id)
  },

  moveTask: (id, newStart, newEnd) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, startDate: newStart, endDate: newEnd } : t
      ),
    }))
    const moved = get().tasks.find((t) => t.id === id)
    if (moved) salvarAgendaTask(moved)
  },

  panLeft: () =>
    set((s) => ({
      viewStart: format(addDays(parseISO(s.viewStart), -PAN_DAYS[s.viewMode]), 'yyyy-MM-dd'),
    })),

  panRight: () =>
    set((s) => ({
      viewStart: format(addDays(parseISO(s.viewStart), PAN_DAYS[s.viewMode]), 'yyyy-MM-dd'),
    })),

  zoomIn: () =>
    set((s) => ({ visibleWeeks: Math.max(4, s.visibleWeeks - 2) })),

  zoomOut: () =>
    set((s) => ({ visibleWeeks: Math.min(26, s.visibleWeeks + 2) })),

  setViewMode: (mode) => set({ viewMode: mode }),
  setViewStart: (d) => set({ viewStart: d }),
  setVisibleWeeks: (n) => set({ visibleWeeks: Math.min(52, Math.max(1, n)) }),

  selectTask: (id) => set({ selectedTaskId: id }),
  setEditingTask: (id) => set({ editingTaskId: id }),
  setDisplayView: (view) => set({ displayView: view }),

  loadDemoData: () =>
    set({ tasks: mockTasks, resources: mockResources }),

  clearData: () =>
    set({ tasks: [], resources: [] }),

  hidratarTasks: (tasks) => set({ tasks }),
  hidratarResources: (resources) => set({ resources }),
}))

// Derived selectors
export function getUnscheduledCount(tasks: AgendaTask[]) {
  return tasks.filter((t) => t.status === 'unscheduled').length
}

export function getTasksForResource(tasks: AgendaTask[], resourceId: string) {
  return tasks.filter((t) => t.resourceId === resourceId)
}

export function useViewEnd(viewStart: string, visibleWeeks: number): string {
  return format(addDays(parseISO(viewStart), visibleWeeks * 7), 'yyyy-MM-dd')
}
