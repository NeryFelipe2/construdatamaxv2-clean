/**
 * lpsStore.ts - Zustand store for the LPS / Lean Construction module.
 *
 * Phase 1 rule:
 * - restrictions come from the canonical API whenever possible
 * - lookahead / takt / semaforo remain local UI state until their canonical domains are implemented
 */
import { create } from 'zustand'
import {
  apiProjetoAtualizarLpsRestricao,
  apiProjetoCriarLpsRestricao,
  apiProjetoLpsRestricoes,
  apiProjetoRemoverLpsRestricao,
} from '@/lib/api'
import type {
  IntegrationStatus,
  LpsActivity,
  LpsAlert,
  LpsRestriction,
  LpsRestrictionCategory,
  LpsRestrictionStatus,
  LpsTab,
  LpsWeeklyPPC,
  StaffingDimension,
  TaktZone,
} from '@/types'

const ALLOW_DEMO_DATA = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'

function isoWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function weekOffset(base: Date, offset: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + offset * 7)
  return isoWeek(d)
}

function weekLabel(isoWeekStr: string): string {
  const [year, wPart] = isoWeekStr.split('-W')
  return `S${wPart}/${year.slice(2)}`
}

const today = new Date()

function makeMockActivities(): LpsActivity[] {
  const trechos = [
    { code: 'T01', desc: 'Escavacao Av. Principal', team: 'Equipe A' },
    { code: 'T02', desc: 'Assentamento DN200', team: 'Equipe A' },
    { code: 'T03', desc: 'Reaterro compactado', team: 'Equipe B' },
    { code: 'T04', desc: 'Pocos de visita PV-01..04', team: 'Equipe B' },
    { code: 'T05', desc: 'Ramais domiciliares', team: 'Equipe C' },
    { code: 'T06', desc: 'Teste hidrostatico T01-T03', team: 'Equipe A' },
  ]

  const activities: LpsActivity[] = []
  let id = 1
  for (let wi = -6; wi <= 2; wi++) {
    const week = weekOffset(today, wi)
    trechos.forEach((t, ti) => {
      const planned = ti < 4 || wi >= -2
      const completed = wi < 0 && planned
      const notDone = wi < 0 && planned && !completed
      let readyStatus: LpsActivity['readyStatus'] = 'green'
      if (!planned) readyStatus = 'yellow'
      if (notDone) readyStatus = 'red'
      if (wi === 0 && ti === 2) readyStatus = 'yellow'

      activities.push({
        id: String(id++),
        week,
        trechoCode: t.code,
        description: t.desc,
        planned,
        completed: completed && Math.random() > 0.15,
        readyStatus,
        responsibleTeam: t.team,
        plannedMeters: [80, 60, 90, 40, 50, 30][ti],
        executedMeters: completed ? [72, 58, 85, 38, 45, 30][ti] : undefined,
        cncCategory: notDone ? (['equipment', 'material', 'weather', 'labor'] as const)[ti % 4] : undefined,
        cncDescription: notDone ? 'Atraso na entrega de insumos' : undefined,
      })
    })
  }
  return activities
}

function makeMockRestrictions(): LpsRestriction[] {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const addDays = (d: Date, n: number) => {
    const r = new Date(d)
    r.setDate(r.getDate() + n)
    return r
  }

  return [
    {
      id: 'r1',
      tema: 'Licenca Ambiental Trecho T03',
      categoria: 'projeto_engenharia',
      descricao: 'Licenca de instalacao ainda nao emitida para intervencao no corrego.',
      impacto: 'Impede inicio das escavacoes no trecho T03 e T04.',
      responsavel: 'Eng. Ambiental / SEMA',
      prazoRemocao: fmt(addDays(today, -3)),
      acoesNecessarias: 'Protocolar documentacao complementar; agendar vistoria tecnica.',
      tags: ['licenca', 'ambiental', 'T03'],
      observacoes: 'Aguardando retorno do orgao.',
      status: 'em_resolucao',
      createdAt: fmt(addDays(today, -14)),
    },
    {
      id: 'r2',
      tema: 'Falta de Manilhas DN300 no Almoxarifado',
      categoria: 'materiais',
      descricao: 'Pedido de compra em atraso com fornecedor.',
      impacto: 'Paralisa equipe B no trecho T05 por falta de material.',
      responsavel: 'Compras',
      prazoRemocao: fmt(addDays(today, 5)),
      acoesNecessarias: 'Acionar segundo fornecedor.',
      tags: ['material', 'DN300', 'Equipe B'],
      status: 'identificada',
      createdAt: fmt(addDays(today, -7)),
    },
  ]
}

function makeMockTaktZones(): TaktZone[] {
  return [
    { id: '1', code: 'T01', lengthM: 320, taktDays: 8, actualDays: 7 },
    { id: '2', code: 'T02', lengthM: 280, taktDays: 8, actualDays: 9 },
    { id: '3', code: 'T03', lengthM: 200, taktDays: 8, actualDays: 8 },
    { id: '4', code: 'T04', lengthM: 150, taktDays: 8, actualDays: undefined },
  ]
}

function createBaseIntegrationStatuses(): IntegrationStatus[] {
  return [
    { source: 'suprimentos', label: 'Suprimentos', lastSyncAt: null, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'disconnected' },
    { source: 'mao_de_obra', label: 'Mao de Obra', lastSyncAt: null, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'disconnected' },
    { source: 'rdo', label: 'RDO', lastSyncAt: null, itemsLinked: 0, restrictionsAutoClearable: 0, status: 'disconnected' },
  ]
}

function mapCategoria(input: unknown): LpsRestrictionCategory {
  const raw = String(input ?? '').toLowerCase()
  if (['projeto', 'engenharia', 'projeto_engenharia'].includes(raw)) return 'projeto_engenharia'
  if (raw === 'materiais') return 'materiais'
  if (raw === 'equipamentos') return 'equipamentos'
  if (['mao_de_obra', 'mao de obra', 'labor'].includes(raw)) return 'mao_de_obra'
  if (['externo', 'external'].includes(raw)) return 'externo'
  return 'outros'
}

function mapStatus(input: unknown): LpsRestrictionStatus {
  const raw = String(input ?? '').toLowerCase()
  if (['resolvido', 'resolvida', 'resolved', 'closed'].includes(raw)) return 'resolvida'
  if (['em_resolucao', 'in_progress', 'ativo', 'active'].includes(raw)) return 'em_resolucao'
  return 'identificada'
}

function mapRestriction(row: Record<string, unknown>): LpsRestriction {
  const descricao = String(row.descricao ?? row.restricao ?? row.tema ?? 'Restricao')
  return {
    id: String(row.id ?? crypto.randomUUID()),
    tema: String(row.tema ?? row.titulo ?? descricao),
    categoria: mapCategoria(row.categoria ?? row.tipo ?? row.origem),
    descricao,
    impacto: row.impacto ? String(row.impacto) : '',
    responsavel: row.responsavel ? String(row.responsavel) : row.responsavel_nome ? String(row.responsavel_nome) : '',
    prazoRemocao: row.prazo_remocao ? String(row.prazo_remocao) : row.data_alvo ? String(row.data_alvo) : row.prazo ? String(row.prazo) : '',
    acoesNecessarias: row.acoes_necessarias ? String(row.acoes_necessarias) : '',
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    observacoes: row.observacoes ? String(row.observacoes) : '',
    status: mapStatus(row.status),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString().slice(0, 10)),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : row.resolvedAt ? String(row.resolvedAt) : undefined,
  }
}

function buildIntegrationStatuses(restrictions: LpsRestriction[], activities: LpsActivity[], lastSyncAt: string | null): IntegrationStatus[] {
  const openRestrictions = restrictions.filter((r) => r.status !== 'resolvida').length
  const linkedActivities = activities.filter((a) => a.planned).length
  return [
    {
      source: 'suprimentos',
      label: 'Suprimentos',
      lastSyncAt,
      itemsLinked: restrictions.filter((r) => r.categoria === 'materiais').length,
      restrictionsAutoClearable: restrictions.filter((r) => r.categoria === 'materiais' && r.status !== 'resolvida').length > 0 ? 1 : 0,
      status: restrictions.some((r) => r.categoria === 'materiais') ? 'partial' : 'disconnected',
    },
    {
      source: 'mao_de_obra',
      label: 'Mao de Obra',
      lastSyncAt,
      itemsLinked: linkedActivities,
      restrictionsAutoClearable: restrictions.filter((r) => r.categoria === 'mao_de_obra' && r.status !== 'resolvida').length,
      status: activities.length > 0 ? 'partial' : 'disconnected',
    },
    {
      source: 'rdo',
      label: 'RDO',
      lastSyncAt,
      itemsLinked: openRestrictions,
      restrictionsAutoClearable: restrictions.filter((r) => r.status === 'em_resolucao').length,
      status: restrictions.length > 0 ? 'connected' : 'partial',
    },
  ]
}

function computeStaffingFromActivities(activities: LpsActivity[]): StaffingDimension[] {
  const grouped = new Map<string, LpsActivity[]>()
  for (const activity of activities) {
    const key = activity.responsibleTeam || 'Equipe'
    grouped.set(key, [...(grouped.get(key) ?? []), activity])
  }
  return Array.from(grouped.entries()).map(([team, teamActivities], index) => {
    const requiredTeams = Math.max(1, Math.ceil(teamActivities.length / 2))
    const requiredWorkers = requiredTeams * 5
    const availableFromMaoDeObra = requiredWorkers - (index % 2 === 0 ? 0 : 2)
    const gap = requiredWorkers - availableFromMaoDeObra
    return {
      id: `sd-${team}-${index}`,
      activityName: team,
      requiredTeams,
      requiredWorkers,
      role: 'Equipe de campo',
      availableFromMaoDeObra,
      gap,
      status: gap > 0 ? 'deficit' : gap < 0 ? 'surplus' : 'ok',
    }
  })
}

export function computeWeeklyPPC(activities: LpsActivity[]): LpsWeeklyPPC[] {
  const map = new Map<string, { planned: number; completed: number }>()
  for (const a of activities) {
    if (!a.planned) continue
    const entry = map.get(a.week) ?? { planned: 0, completed: 0 }
    entry.planned += 1
    if (a.completed) entry.completed += 1
    map.set(a.week, entry)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { planned, completed }]) => ({
      week,
      planned,
      completed,
      ppc: planned > 0 ? Math.round((completed / planned) * 100) : 0,
    }))
}

export { weekLabel, isoWeek, weekOffset }

interface LpsState {
  activeTab: LpsTab
  currentProjectId: string | null
  connectionStatus: 'connected' | 'partial' | 'local'
  activities: LpsActivity[]
  taktZones: TaktZone[]
  taktTotalDays: number
  restrictions: LpsRestriction[]
  staffingDimensions: StaffingDimension[]
  integrationStatuses: IntegrationStatus[]
  alerts: LpsAlert[]

  setActiveTab: (tab: LpsTab) => void
  loadFromProject: (projectId: string) => Promise<void>

  addActivity: (a: Omit<LpsActivity, 'id'>) => void
  updateActivity: (id: string, updates: Partial<Omit<LpsActivity, 'id'>>) => void
  removeActivity: (id: string) => void

  updateTaktZone: (id: string, updates: Partial<Omit<TaktZone, 'id'>>) => void
  setTaktTotalDays: (days: number) => void
  recalculateTakt: () => void

  addRestriction: (r: Omit<LpsRestriction, 'id' | 'createdAt'>) => Promise<void>
  updateRestriction: (id: string, updates: Partial<Omit<LpsRestriction, 'id'>>) => Promise<void>
  removeRestriction: (id: string) => Promise<void>

  computeStaffingDimensions: () => void
  refreshIntegrationStatus: () => void
  autoClearRestrictions: () => void

  addAlert: (a: Omit<LpsAlert, 'id'>) => void
  acknowledgeAlert: (id: string) => void

  loadDemoData: () => void
  clearData: () => void
}

export const useLpsStore = create<LpsState>((set, get) => ({
  activeTab: 'semaforo',
  currentProjectId: null,
  connectionStatus: ALLOW_DEMO_DATA ? 'local' : 'partial',
  activities: ALLOW_DEMO_DATA ? makeMockActivities() : [],
  taktZones: ALLOW_DEMO_DATA ? makeMockTaktZones() : [],
  taktTotalDays: 48,
  restrictions: ALLOW_DEMO_DATA ? makeMockRestrictions() : [],
  staffingDimensions: ALLOW_DEMO_DATA ? computeStaffingFromActivities(makeMockActivities()) : [],
  integrationStatuses: buildIntegrationStatuses(ALLOW_DEMO_DATA ? makeMockRestrictions() : [], ALLOW_DEMO_DATA ? makeMockActivities() : [], null),
  alerts: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadFromProject: async (projectId) => {
    if (!projectId) return
    try {
      const payload = await apiProjetoLpsRestricoes(projectId)
      const restrictions = (payload.items ?? []).map((row) => mapRestriction(row))
      const nextActivities = get().activities.length > 0 ? get().activities : (ALLOW_DEMO_DATA ? makeMockActivities() : [])
      set({
        currentProjectId: projectId,
        restrictions,
        activities: nextActivities,
        taktZones: get().taktZones.length > 0 ? get().taktZones : (ALLOW_DEMO_DATA ? makeMockTaktZones() : []),
        staffingDimensions: computeStaffingFromActivities(nextActivities),
        integrationStatuses: buildIntegrationStatuses(restrictions, nextActivities, new Date().toISOString()),
        connectionStatus: 'connected',
      })
      return
    } catch {
      const nextActivities = ALLOW_DEMO_DATA ? makeMockActivities() : []
      const nextRestrictions = ALLOW_DEMO_DATA ? makeMockRestrictions() : []
      set({
        currentProjectId: projectId,
        restrictions: nextRestrictions,
        activities: get().activities.length > 0 ? get().activities : nextActivities,
        taktZones: get().taktZones.length > 0 ? get().taktZones : (ALLOW_DEMO_DATA ? makeMockTaktZones() : []),
        staffingDimensions: computeStaffingFromActivities(get().activities.length > 0 ? get().activities : nextActivities),
        integrationStatuses: buildIntegrationStatuses(nextRestrictions, get().activities.length > 0 ? get().activities : nextActivities, null),
        connectionStatus: ALLOW_DEMO_DATA ? 'local' : 'partial',
      })
    }
  },

  addActivity: (a) =>
    set((s) => {
      const activities = [...s.activities, { ...a, id: crypto.randomUUID() }]
      return {
        activities,
        staffingDimensions: computeStaffingFromActivities(activities),
        integrationStatuses: buildIntegrationStatuses(s.restrictions, activities, new Date().toISOString()),
      }
    }),

  updateActivity: (id, updates) =>
    set((s) => {
      const activities = s.activities.map((a) => (a.id === id ? { ...a, ...updates } : a))
      return {
        activities,
        staffingDimensions: computeStaffingFromActivities(activities),
        integrationStatuses: buildIntegrationStatuses(s.restrictions, activities, new Date().toISOString()),
      }
    }),

  removeActivity: (id) =>
    set((s) => {
      const activities = s.activities.filter((a) => a.id !== id)
      return {
        activities,
        staffingDimensions: computeStaffingFromActivities(activities),
        integrationStatuses: buildIntegrationStatuses(s.restrictions, activities, new Date().toISOString()),
      }
    }),

  updateTaktZone: (id, updates) =>
    set((s) => ({
      taktZones: s.taktZones.map((z) => (z.id === id ? { ...z, ...updates } : z)),
    })),

  setTaktTotalDays: (days) => {
    set({ taktTotalDays: days })
    get().recalculateTakt()
  },

  recalculateTakt: () => {
    const { taktZones, taktTotalDays } = get()
    const numZones = taktZones.length || 1
    const taktPerZone = Math.round(taktTotalDays / numZones)
    set({
      taktZones: taktZones.map((z) => ({ ...z, taktDays: taktPerZone })),
    })
  },

  addRestriction: async (r) => {
    const projectId = get().currentProjectId
    if (projectId) {
      try {
        const created = await apiProjetoCriarLpsRestricao(projectId, r as unknown as Record<string, unknown>)
        const restriction = mapRestriction(created)
        set((s) => {
          const restrictions = [...s.restrictions, restriction]
          return {
            restrictions,
            integrationStatuses: buildIntegrationStatuses(restrictions, s.activities, new Date().toISOString()),
            connectionStatus: 'connected',
          }
        })
        return
      } catch {
        // fallback below
      }
    }
    set((s) => {
      const restrictions = [...s.restrictions, { ...r, id: crypto.randomUUID(), createdAt: new Date().toISOString().slice(0, 10) }]
      return {
        restrictions,
        integrationStatuses: buildIntegrationStatuses(restrictions, s.activities, new Date().toISOString()),
      }
    })
  },

  updateRestriction: async (id, updates) => {
    const projectId = get().currentProjectId
    if (projectId) {
      try {
        const updated = await apiProjetoAtualizarLpsRestricao(projectId, id, updates as unknown as Record<string, unknown>)
        const restriction = mapRestriction(updated)
        set((s) => {
          const restrictions = s.restrictions.map((r) => (r.id === id ? restriction : r))
          return {
            restrictions,
            integrationStatuses: buildIntegrationStatuses(restrictions, s.activities, new Date().toISOString()),
            connectionStatus: 'connected',
          }
        })
        return
      } catch {
        // fallback below
      }
    }
    set((s) => {
      const restrictions = s.restrictions.map((r) => (r.id === id ? { ...r, ...updates } : r))
      return {
        restrictions,
        integrationStatuses: buildIntegrationStatuses(restrictions, s.activities, new Date().toISOString()),
      }
    })
  },

  removeRestriction: async (id) => {
    const projectId = get().currentProjectId
    if (projectId) {
      try {
        await apiProjetoRemoverLpsRestricao(projectId, id)
        set((s) => {
          const restrictions = s.restrictions.filter((r) => r.id !== id)
          return {
            restrictions,
            integrationStatuses: buildIntegrationStatuses(restrictions, s.activities, new Date().toISOString()),
            connectionStatus: 'connected',
          }
        })
        return
      } catch {
        // fallback below
      }
    }
    set((s) => {
      const restrictions = s.restrictions.filter((r) => r.id !== id)
      return {
        restrictions,
        integrationStatuses: buildIntegrationStatuses(restrictions, s.activities, new Date().toISOString()),
      }
    })
  },

  computeStaffingDimensions: () => {
    const activities = get().activities
    set({ staffingDimensions: computeStaffingFromActivities(activities) })
  },

  refreshIntegrationStatus: () => {
    const { restrictions, activities } = get()
    set({ integrationStatuses: buildIntegrationStatuses(restrictions, activities, new Date().toISOString()) })
  },

  autoClearRestrictions: () => {
    set((s) => {
      const restrictions = s.restrictions.map((restriction, index) =>
        restriction.status === 'em_resolucao' && index < 2
          ? { ...restriction, status: 'resolvida' as const, resolvedAt: new Date().toISOString().slice(0, 10) }
          : restriction,
      )
      return {
        restrictions,
        integrationStatuses: buildIntegrationStatuses(restrictions, s.activities, new Date().toISOString()),
      }
    })
  },

  addAlert: (a) =>
    set((s) => ({
      alerts: [...s.alerts, { ...a, id: crypto.randomUUID() }],
    })),

  acknowledgeAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a,
      ),
    })),

  loadDemoData: () => {
    const activities = makeMockActivities()
    const restrictions = makeMockRestrictions()
    set({
      activities,
      taktZones: makeMockTaktZones(),
      taktTotalDays: 48,
      restrictions,
      staffingDimensions: computeStaffingFromActivities(activities),
      integrationStatuses: buildIntegrationStatuses(restrictions, activities, null),
      connectionStatus: 'local',
    })
  },

  clearData: () =>
    set({
      activities: [],
      taktZones: [],
      taktTotalDays: 48,
      restrictions: [],
      staffingDimensions: [],
      integrationStatuses: createBaseIntegrationStatuses(),
      connectionStatus: 'local',
      alerts: [],
    }),
}))

if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    import('./projectContext')
      .then(({ useProjectContext }) => {
        const sync = async () => {
          const { activeProjectId } = useProjectContext.getState()
          if (activeProjectId) await useLpsStore.getState().loadFromProject(activeProjectId)
        }
        void sync()
        useProjectContext.subscribe(() => {
          void sync()
        })
      })
      .catch(() => undefined)
  })
}
