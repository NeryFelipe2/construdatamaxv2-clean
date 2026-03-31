import { create } from 'zustand'
import { MOCK_PROJETOS } from '@/data/mockProjetos'
import type {
  Project,
  ProjectPhase,
  BudgetLine,
  ProjectDocument,
  DesignViewType,
} from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseGroup = 'planning' | 'execution'

interface EditingPhase {
  projectId: string
  group: PhaseGroup
  phaseId: string
}

interface EditingBudgetLine {
  projectId: string
  lineId: string | 'new'
}

interface ProjetosState {
  projects: Project[]
  selectedProjectId: string | null
  activeTab: number
  activeDesignView: DesignViewType
  editingProjectId: string | null   // 'new' | id | null
  editingPhase: EditingPhase | null
  editingBudgetLine: EditingBudgetLine | null
}

interface ProjetosActions {
  // Project CRUD
  addProject: (payload: Omit<Project, 'id'>) => void
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => void
  deleteProject: (id: string) => void
  // Selection / navigation
  selectProject: (id: string | null) => void
  setActiveTab: (tab: number) => void
  setActiveDesignView: (view: DesignViewType) => void
  // Dialog state
  setEditingProject: (id: string | null) => void
  setEditingPhase: (args: EditingPhase | null) => void
  setEditingBudgetLine: (args: EditingBudgetLine | null) => void
  // Phase update
  updatePhase: (projectId: string, group: PhaseGroup, phaseId: string, patch: Partial<ProjectPhase>) => void
  // Budget lines
  addBudgetLine: (projectId: string, line: Omit<BudgetLine, 'id'>) => void
  updateBudgetLine: (projectId: string, lineId: string, patch: Partial<Omit<BudgetLine, 'id'>>) => void
  deleteBudgetLine: (projectId: string, lineId: string) => void
  // Documents
  addDocument: (projectId: string, doc: ProjectDocument) => void
  deleteDocument: (projectId: string, docId: string) => void
  // Demo mode
  loadDemoData: () => void
  clearData: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProjetosStore = create<ProjetosState & ProjetosActions>((set) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  projects: MOCK_PROJETOS,
  selectedProjectId: MOCK_PROJETOS[0]?.id ?? null,
  activeTab: 0,
  activeDesignView: '3D',
  editingProjectId: null,
  editingPhase: null,
  editingBudgetLine: null,

  // ── Project CRUD ───────────────────────────────────────────────────────────
  addProject: (payload) =>
    set((s) => {
      const id = `prj-${Date.now()}`
      return { projects: [...s.projects, { ...payload, id }], selectedProjectId: id }
    }),

  updateProject: (id, patch) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  deleteProject: (id) =>
    set((s) => {
      const remaining = s.projects.filter((p) => p.id !== id)
      return {
        projects: remaining,
        selectedProjectId: remaining[0]?.id ?? null,
        activeTab: 0,
      }
    }),

  // ── Selection / navigation ─────────────────────────────────────────────────
  selectProject: (id) => set({ selectedProjectId: id, activeTab: 0 }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveDesignView: (view) => set({ activeDesignView: view }),

  // ── Dialog state ───────────────────────────────────────────────────────────
  setEditingProject: (id) => set({ editingProjectId: id }),
  setEditingPhase: (args) => set({ editingPhase: args }),
  setEditingBudgetLine: (args) => set({ editingBudgetLine: args }),

  // ── Phase update ───────────────────────────────────────────────────────────
  updatePhase: (projectId, group, phaseId, patch) =>
    set((s) => ({
      projects: s.projects.map((p) => {
        if (p.id !== projectId) return p
        const key = group === 'planning' ? 'planningPhases' : 'executionPhases'
        return {
          ...p,
          [key]: p[key].map((ph) => (ph.id === phaseId ? { ...ph, ...patch } : ph)),
        }
      }),
    })),

  // ── Budget lines ───────────────────────────────────────────────────────────
  addBudgetLine: (projectId, line) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, budgetLines: [...p.budgetLines, { ...line, id: `bl-${Date.now()}` }] }
          : p
      ),
    })),

  updateBudgetLine: (projectId, lineId, patch) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, budgetLines: p.budgetLines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
          : p
      ),
    })),

  deleteBudgetLine: (projectId, lineId) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, budgetLines: p.budgetLines.filter((l) => l.id !== lineId) }
          : p
      ),
    })),

  // ── Documents ──────────────────────────────────────────────────────────────
  addDocument: (projectId, doc) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, documents: [...p.documents, doc] } : p
      ),
    })),

  deleteDocument: (projectId, docId) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, documents: p.documents.filter((d) => d.id !== docId) }
          : p
      ),
    })),

  // ── Demo mode ──────────────────────────────────────────────────────────────
  loadDemoData: () =>
    set({ projects: MOCK_PROJETOS, selectedProjectId: MOCK_PROJETOS[0]?.id ?? null }),

  clearData: () =>
    set({ projects: [], selectedProjectId: null }),
}))
