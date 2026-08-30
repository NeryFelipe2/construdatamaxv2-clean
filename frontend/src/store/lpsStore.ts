/**
 * lpsStore.ts - Zustand store for the LPS / Lean Construction module.
 *
 * Fase 5 (10/07/2026): as ATIVIDADES (semáforo/PPC — a "meta verdinho")
 * passaram a persistir em `lps_tasks` no Supabase (useLpsTasks.ts): leitura no
 * loadFromProject, escrita fire-and-forget nos CRUDs, gated por
 * currentProjectId (que vira null em demo/clear pra mock nunca ir pro banco).
 *
 * Fase 2 do plano LPS-real (27/07/2026):
 *  - RESTRIÇÕES agora persistem em `lps_restricoes` no Supabase
 *    (useLpsRestricoes.ts, tabela populada com 74 linhas seed em 27/07) —
 *    a API Render (apiProjetoLpsRestricoes etc., @deprecated em lib/api.ts)
 *    ficou só como fallback quando o Supabase está indisponível.
 *  - STAFFING deixou de ser inventado a partir das atividades
 *    (computeStaffingFromActivities morreu): agora é o efetivo REAL de
 *    `wcr_equipes` ativas + contagem de `equipe_membros`. Sem Supabase →
 *    lista vazia honesta (a tela declara a fonte).
 *  - integrationStatuses/autoClearRestrictions (números e "baixa automática"
 *    fabricados) foram removidos — o IntegracoesPanel passou a contar direto
 *    nas tabelas reais.
 */
import { create } from 'zustand'
import {
  apiProjetoAtualizarLpsRestricao,
  apiProjetoCriarLpsRestricao,
  apiProjetoLpsRestricoes,
  apiProjetoRemoverLpsRestricao,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { carregarLpsTasks, salvarLpsTask, removerLpsTask } from '@/hooks/useLpsTasks'
import { carregarLpsRestricoes, salvarLpsRestricao, removerLpsRestricao } from '@/hooks/useLpsRestricoes'
import type {
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

/**
 * Staffing REAL: uma linha por equipe ativa de `wcr_equipes`, com o efetivo
 * contado em `equipe_membros`. Não existe "dimensionamento-alvo" cadastrado no
 * banco, então NÃO inventamos gap numérico: requerido = efetivo atual e gap=0;
 * o sinal honesto de déficit é qualitativo — equipe marcada `a_contratar` ou
 * ativa sem nenhum membro cadastrado. Sem Supabase/erro → [] (vazio honesto).
 */
async function carregarStaffingReal(): Promise<StaffingDimension[]> {
  if (!supabase) return []
  try {
    const [equipesRes, membrosRes] = await Promise.all([
      supabase.from('wcr_equipes').select('id, nome, frente, foco, a_contratar, ordem, ativo').eq('ativo', true).order('ordem'),
      supabase.from('equipe_membros').select('id, equipe_id'),
    ])
    if (equipesRes.error || membrosRes.error) return []
    const membrosPorEquipe = new Map<string, number>()
    for (const m of (membrosRes.data ?? []) as Array<{ id: string; equipe_id: string }>) {
      membrosPorEquipe.set(m.equipe_id, (membrosPorEquipe.get(m.equipe_id) ?? 0) + 1)
    }
    type DbEquipe = { id: string; nome: string; frente: string | null; foco: string | null; a_contratar: boolean }
    return ((equipesRes.data ?? []) as DbEquipe[]).map((e) => {
      const membros = membrosPorEquipe.get(e.id) ?? 0
      return {
        id: e.id,
        activityName: e.nome,
        requiredTeams: 1,
        requiredWorkers: membros,
        role: e.foco || e.frente || 'Equipe de campo',
        availableFromMaoDeObra: membros,
        gap: 0,
        status: e.a_contratar || membros === 0 ? 'deficit' : 'ok',
      }
    })
  } catch {
    return []
  }
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
  // Staffing nunca nasce de mock: é sempre o efetivo real (carregado em
  // loadFromProject/computeStaffingDimensions) ou vazio honesto.
  staffingDimensions: [],
  alerts: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadFromProject: async (projectId) => {
    if (!projectId) return
    // Atividades reais vêm do Supabase (lps_tasks). null = leitura falhou
    // (mantém comportamento antigo); [] = banco vazio de verdade (seta vazio,
    // sem vazar mock/projeto anterior — mesma lição do Planejamento na Fase 2).
    const tasksDb = await carregarLpsTasks(projectId)
    // Restrições reais: Supabase (lps_restricoes) é a fonte primária desde
    // 27/07; a API Render é só fallback legado (@deprecated em lib/api.ts).
    const restricoesDb = await carregarLpsRestricoes(projectId)
    let restrictions: LpsRestriction[]
    let restricoesOk = restricoesDb !== null
    if (restricoesDb) {
      restrictions = restricoesDb
    } else {
      try {
        const payload = await apiProjetoLpsRestricoes(projectId)
        restrictions = (payload.items ?? []).map((row) => mapRestriction(row))
        restricoesOk = true
      } catch {
        restrictions = ALLOW_DEMO_DATA ? makeMockRestrictions() : []
      }
    }
    const nextActivities = tasksDb ?? (get().activities.length > 0 ? get().activities : (ALLOW_DEMO_DATA ? makeMockActivities() : []))
    set({
      currentProjectId: projectId,
      restrictions,
      activities: nextActivities,
      taktZones: get().taktZones.length > 0 ? get().taktZones : (ALLOW_DEMO_DATA ? makeMockTaktZones() : []),
      connectionStatus:
        restricoesOk && tasksDb !== null
          ? 'connected'
          : restricoesOk || tasksDb !== null
            ? 'partial'
            : ALLOW_DEMO_DATA
              ? 'local'
              : 'partial',
    })
    // Staffing real (wcr_equipes + equipe_membros) — independente do resto.
    get().computeStaffingDimensions()
  },

  addActivity: (a) => {
    const nova: LpsActivity = { ...a, id: crypto.randomUUID() }
    set((s) => ({ activities: [...s.activities, nova] }))
    const { currentProjectId } = get()
    if (currentProjectId) salvarLpsTask(currentProjectId, nova)
  },

  updateActivity: (id, updates) => {
    set((s) => ({ activities: s.activities.map((a) => (a.id === id ? { ...a, ...updates } : a)) }))
    const { currentProjectId, activities } = get()
    const atualizada = activities.find((a) => a.id === id)
    if (currentProjectId && atualizada) salvarLpsTask(currentProjectId, atualizada)
  },

  removeActivity: (id) => {
    set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }))
    const { currentProjectId } = get()
    if (currentProjectId) removerLpsTask(id)
  },

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
    const nova: LpsRestriction = { ...r, id: crypto.randomUUID(), createdAt: new Date().toISOString().slice(0, 10) }
    if (projectId && supabase) {
      // Fonte primária: escrita otimista + fire-and-forget em lps_restricoes
      // (padrão useLpsTasks — erro só loga, não trava a UI).
      set((s) => ({ restrictions: [...s.restrictions, nova], connectionStatus: 'connected' }))
      salvarLpsRestricao(projectId, nova)
      return
    }
    if (projectId) {
      // Fallback legado: API Render (@deprecated em lib/api.ts).
      try {
        const created = await apiProjetoCriarLpsRestricao(projectId, r as unknown as Record<string, unknown>)
        const restriction = mapRestriction(created)
        set((s) => ({ restrictions: [...s.restrictions, restriction] }))
        return
      } catch {
        // cai no estado local abaixo
      }
    }
    set((s) => ({ restrictions: [...s.restrictions, nova] }))
  },

  updateRestriction: async (id, updates) => {
    const projectId = get().currentProjectId
    if (projectId && supabase) {
      set((s) => ({ restrictions: s.restrictions.map((r) => (r.id === id ? { ...r, ...updates } : r)) }))
      const atualizada = get().restrictions.find((r) => r.id === id)
      if (atualizada) salvarLpsRestricao(projectId, atualizada)
      return
    }
    if (projectId) {
      // Fallback legado: API Render (@deprecated em lib/api.ts).
      try {
        const updated = await apiProjetoAtualizarLpsRestricao(projectId, id, updates as unknown as Record<string, unknown>)
        const restriction = mapRestriction(updated)
        set((s) => ({ restrictions: s.restrictions.map((r) => (r.id === id ? restriction : r)) }))
        return
      } catch {
        // cai no estado local abaixo
      }
    }
    set((s) => ({ restrictions: s.restrictions.map((r) => (r.id === id ? { ...r, ...updates } : r)) }))
  },

  removeRestriction: async (id) => {
    const projectId = get().currentProjectId
    if (projectId && supabase) {
      set((s) => ({ restrictions: s.restrictions.filter((r) => r.id !== id) }))
      removerLpsRestricao(id)
      return
    }
    if (projectId) {
      // Fallback legado: API Render (@deprecated em lib/api.ts).
      try {
        await apiProjetoRemoverLpsRestricao(projectId, id)
        set((s) => ({ restrictions: s.restrictions.filter((r) => r.id !== id) }))
        return
      } catch {
        // cai no estado local abaixo
      }
    }
    set((s) => ({ restrictions: s.restrictions.filter((r) => r.id !== id) }))
  },

  computeStaffingDimensions: () => {
    // Efetivo REAL (wcr_equipes ativas + equipe_membros) — assíncrono, mas a
    // assinatura continua síncrona pros chamadores (painel só dispara).
    void carregarStaffingReal().then((dims) => set({ staffingDimensions: dims }))
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
      // currentProjectId null: em demo, os CRUDs nunca persistem mock no
      // Supabase (lps_tasks/lps_restricoes) — loadFromProject re-seta ao
      // voltar pro real. Staffing NÃO tem versão mock: continua vazio.
      currentProjectId: null,
      activities,
      taktZones: makeMockTaktZones(),
      taktTotalDays: 48,
      restrictions,
      staffingDimensions: [],
      connectionStatus: 'local',
    })
  },

  clearData: () =>
    set({
      currentProjectId: null,
      activities: [],
      taktZones: [],
      taktTotalDays: 48,
      restrictions: [],
      staffingDimensions: [],
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
