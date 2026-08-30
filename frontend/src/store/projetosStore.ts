import { create } from 'zustand'
import { MOCK_PROJETOS } from '@/data/mockProjetos'
import { apiProjetoDashboard } from '@/lib/api'
import { mapDbProjetoToProject, custoRealMedicao } from '@/lib/canonicalProject'
import type { DbProjeto } from '@/lib/supabase'
import type {
  BudgetLine,
  DesignViewType,
  Project,
  ProjectDocument,
  ProjectPhase,
} from '@/types'

const ALLOW_DEMO_DATA = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'

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
  editingProjectId: string | null
  editingPhase: EditingPhase | null
  editingBudgetLine: EditingBudgetLine | null
}

interface ProjetosActions {
  addProject: (payload: Omit<Project, 'id'>) => void
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => void
  deleteProject: (id: string) => void
  selectProject: (id: string | null) => void
  setActiveTab: (tab: number) => void
  setActiveDesignView: (view: DesignViewType) => void
  setEditingProject: (id: string | null) => void
  setEditingPhase: (args: EditingPhase | null) => void
  setEditingBudgetLine: (args: EditingBudgetLine | null) => void
  updatePhase: (projectId: string, group: PhaseGroup, phaseId: string, patch: Partial<ProjectPhase>) => void
  addBudgetLine: (projectId: string, line: Omit<BudgetLine, 'id'>) => void
  updateBudgetLine: (projectId: string, lineId: string, patch: Partial<Omit<BudgetLine, 'id'>>) => void
  deleteBudgetLine: (projectId: string, lineId: string) => void
  addDocument: (projectId: string, doc: ProjectDocument) => void
  deleteDocument: (projectId: string, docId: string) => void
  loadDemoData: () => void
  clearData: () => void
  loadFromProjectContext: () => Promise<void>
}

function mergeProject(existing: Project | undefined, incoming: Project): Project {
  if (!existing) return incoming
  return {
    ...existing,
    ...incoming,
    planningPhases: existing.planningPhases.length ? existing.planningPhases : incoming.planningPhases,
    executionPhases: existing.executionPhases.length ? existing.executionPhases : incoming.executionPhases,
    budgetLines: existing.budgetLines.length ? existing.budgetLines : incoming.budgetLines,
    demands: existing.demands.length ? existing.demands : incoming.demands,
    documents: existing.documents.length ? existing.documents : incoming.documents,
  }
}

export const useProjetosStore = create<ProjetosState & ProjetosActions>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  activeTab: 0,
  activeDesignView: '3D',
  editingProjectId: null,
  editingPhase: null,
  editingBudgetLine: null,

  addProject: (payload) =>
    set((state) => {
      const id = `prj-${Date.now()}`
      return { projects: [...state.projects, { ...payload, id }], selectedProjectId: id }
    }),

  updateProject: (id, patch) =>
    set((state) => ({
      projects: state.projects.map((project) => (project.id === id ? { ...project, ...patch } : project)),
    })),

  deleteProject: (id) =>
    set((state) => {
      const remaining = state.projects.filter((project) => project.id !== id)
      return {
        projects: remaining,
        selectedProjectId: remaining[0]?.id ?? null,
        activeTab: 0,
      }
    }),

  selectProject: (id) => {
    set({ selectedProjectId: id, activeTab: 0 })
    if (id) {
      import('./projectContext')
        .then(({ useProjectContext }) => {
          useProjectContext.getState().setActiveProject(id)
        })
        .catch(() => undefined)
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveDesignView: (view) => set({ activeDesignView: view }),
  setEditingProject: (id) => set({ editingProjectId: id }),
  setEditingPhase: (args) => set({ editingPhase: args }),
  setEditingBudgetLine: (args) => set({ editingBudgetLine: args }),

  updatePhase: (projectId, group, phaseId, patch) =>
    set((state) => ({
      projects: state.projects.map((project) => {
        if (project.id !== projectId) return project
        const key = group === 'planning' ? 'planningPhases' : 'executionPhases'
        return {
          ...project,
          [key]: project[key].map((phase) => (phase.id === phaseId ? { ...phase, ...patch } : phase)),
        }
      }),
    })),

  addBudgetLine: (projectId, line) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? { ...project, budgetLines: [...project.budgetLines, { ...line, id: `bl-${Date.now()}` }] }
          : project,
      ),
    })),

  updateBudgetLine: (projectId, lineId, patch) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              budgetLines: project.budgetLines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
            }
          : project,
      ),
    })),

  deleteBudgetLine: (projectId, lineId) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? { ...project, budgetLines: project.budgetLines.filter((line) => line.id !== lineId) }
          : project,
      ),
    })),

  addDocument: (projectId, doc) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId ? { ...project, documents: [...project.documents, doc] } : project,
      ),
    })),

  deleteDocument: (projectId, docId) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? { ...project, documents: project.documents.filter((doc) => doc.id !== docId) }
          : project,
      ),
    })),

  loadDemoData: () => set({ projects: MOCK_PROJETOS, selectedProjectId: MOCK_PROJETOS[0]?.id ?? null }),
  clearData: () => set({ projects: [], selectedProjectId: null }),

  loadFromProjectContext: async () => {
    try {
      const [{ useProjectContext }] = await Promise.all([import('./projectContext')])
      const { projetos, activeProjectId } = useProjectContext.getState()
      if (!projetos.length) {
        if (ALLOW_DEMO_DATA) set({ projects: MOCK_PROJETOS, selectedProjectId: MOCK_PROJETOS[0]?.id ?? null })
        else set({ projects: [], selectedProjectId: null })
        return
      }

      const dashboard = activeProjectId ? await apiProjetoDashboard(activeProjectId).catch(() => null) : null
      // custo real (medicao_itens) por projeto — substitui o custo_total_dia
      // da API (frequentemente indisponível) sem inventar número: soma o que
      // já está gravado no banco. Roda em paralelo, um por projeto.
      const custosReais = await Promise.all(
        projetos.map((p) => custoRealMedicao(p.id).catch(() => null)),
      )
      const nextProjects = projetos.map((projeto, i) => {
        const existing = get().projects.find((project) => project.id === projeto.id)
        const custoReal = custosReais[i]
        const dashboardComCustoReal =
          custoReal != null
            ? { ...(projeto.id === activeProjectId ? dashboard : null), kpis: { ...(projeto.id === activeProjectId ? dashboard?.kpis : null), custo_total_dia: custoReal } }
            : (projeto.id === activeProjectId ? dashboard : null)
        const mapped = mapDbProjetoToProject(projeto as DbProjeto, {
          existing,
          dashboard: dashboardComCustoReal as any,
        })
        return mergeProject(existing, mapped)
      })

      set({
        projects: nextProjects,
        selectedProjectId: activeProjectId && nextProjects.some((project) => project.id === activeProjectId)
          ? activeProjectId
          : nextProjects[0]?.id ?? null,
      })
    } catch {
      if (ALLOW_DEMO_DATA) set({ projects: MOCK_PROJETOS, selectedProjectId: MOCK_PROJETOS[0]?.id ?? null })
      else set({ projects: [], selectedProjectId: null })
    }
  },
}))

if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    import('./projectContext')
      .then(({ useProjectContext }) => {
        useProjetosStore.getState().loadFromProjectContext()
        useProjectContext.subscribe(() => {
          void useProjetosStore.getState().loadFromProjectContext()
        })
      })
      .catch(() => undefined)
  })
}
