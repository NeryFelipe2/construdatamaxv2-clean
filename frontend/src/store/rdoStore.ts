/**
 * rdoStore.ts — Zustand store for the RDO (Relatório Diário de Obras) module.
 *
 * Security:
 *  - All IDs via crypto.randomUUID()
 *  - Photos stored as base64 in memory only — no external upload
 *  - No dangerouslySetInnerHTML, no eval
 *  - Cross-store reads are lazy and read-only
 */
import { create } from 'zustand'
import type {
  RDO, RdoTab, RdoFinancialEntry, RdoTrechoEntry,
} from '@/types'
import {
  MOCK_RDOS,
  MOCK_RDO_FINANCIAL_ENTRIES,
  MOCK_RDO_BUDGET_BRL,
} from '@/data/mockRdo'
import { apiRdoList, apiRdoCreate, apiRdoClose, apiProjetoRdos } from '@/lib/api'
import { supabase } from '@/lib/supabase'

// ─── State ────────────────────────────────────────────────────────────────────

interface RdoState {
  activeTab:        RdoTab
  rdos:             RDO[]
  financialEntries: RdoFinancialEntry[]
  budgetBRL:        number

  // ── Navigation ──────────────────────────────────────────────────────────────
  setActiveTab: (tab: RdoTab) => void

  // ── RDO CRUD ────────────────────────────────────────────────────────────────
  addRdo:    (rdo: Omit<RDO, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => void
  updateRdo: (id: string, updates: Partial<RDO>) => void
  removeRdo: (id: string) => void

  // ── Financial ────────────────────────────────────────────────────────────────
  addFinancialEntry:    (e: Omit<RdoFinancialEntry, 'id'>) => void
  updateFinancialEntry: (id: string, updates: Partial<Omit<RdoFinancialEntry, 'id'>>) => void
  removeFinancialEntry: (id: string) => void
  setBudget:            (brl: number) => void

  // ── Platform import & sync ──────────────────────────────────────────────────
  loadTrechosFromPlanejamento: () => Promise<RdoTrechoEntry[]>
  syncExecutionToPlanejamento: () => void

  // ── Demo / Clear ─────────────────────────────────────────────────────────────
  loadDemoData: () => void
  clearData:    () => void

  // ── Backend sync ─────────────────────────────────────────────────────────────
  fetchFromBackend:       (nucleo?: string) => Promise<void>
  createRdoOnBackend:     (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  closeRdoOnBackend:      (id: number) => Promise<void>

  // ── Supabase sync (RDOs do WhatsApp) ─────────────────────────────────────────
  loadFromSupabase:       (projectId?: string | null) => Promise<void>
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRdoStore = create<RdoState>((set, get) => ({
  activeTab:        'dashboard',
  rdos:             MOCK_RDOS,
  financialEntries: MOCK_RDO_FINANCIAL_ENTRIES,
  budgetBRL:        MOCK_RDO_BUDGET_BRL,

  // ── Navigation ────────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── RDO CRUD ──────────────────────────────────────────────────────────────────

  addRdo: (rdo) => {
    set((s) => {
      const now = new Date().toISOString()
      const nextNumber = s.rdos.length + 1
      return {
        rdos: [
          ...s.rdos,
          { ...rdo, id: crypto.randomUUID(), number: nextNumber, createdAt: now, updatedAt: now },
        ],
      }
    })
    // Auto-sync execution data to Planejamento
    setTimeout(() => get().syncExecutionToPlanejamento(), 0)
  },

  updateRdo: (id, updates) => {
    set((s) => ({
      rdos: s.rdos.map((r) =>
        r.id === id
          ? { ...r, ...updates, updatedAt: new Date().toISOString() }
          : r,
      ),
    }))
    // Auto-sync execution data to Planejamento
    setTimeout(() => get().syncExecutionToPlanejamento(), 0)
  },

  removeRdo: (id) =>
    set((s) => ({ rdos: s.rdos.filter((r) => r.id !== id) })),

  // ── Financial ──────────────────────────────────────────────────────────────────

  addFinancialEntry: (e) =>
    set((s) => ({
      financialEntries: [
        ...s.financialEntries,
        { ...e, id: crypto.randomUUID() },
      ],
    })),

  updateFinancialEntry: (id, updates) =>
    set((s) => ({
      financialEntries: s.financialEntries.map((fe) =>
        fe.id === id ? { ...fe, ...updates } : fe,
      ),
    })),

  removeFinancialEntry: (id) =>
    set((s) => ({
      financialEntries: s.financialEntries.filter((fe) => fe.id !== id),
    })),

  setBudget: (brl) => set({ budgetBRL: Math.max(0, brl) }),

  // ── Platform import & sync ──────────────────────────────────────────────────

  loadTrechosFromPlanejamento: () =>
    import('./planejamentoStore')
      .then(({ usePlanejamentoStore }) => {
        type PlanTrecho = { id: string; code: string; description: string; lengthM: number; executedMeters?: number; executionStatus?: string }
        const state = usePlanejamentoStore.getState() as { trechos: PlanTrecho[] }
        const trechos: PlanTrecho[] = state.trechos ?? []
        return trechos.map((t): RdoTrechoEntry => ({
          id:                crypto.randomUUID(),
          trechoCode:        t.code,
          trechoDescription: t.description,
          plannedMeters:     t.lengthM,
          executedMeters:    t.executedMeters ?? 0,
          status:            (t.executionStatus as RdoTrechoEntry['status']) ?? 'not_started',
          source:            'rdo',
        }))
      })
      .catch(() => [] as RdoTrechoEntry[]),

  syncExecutionToPlanejamento: () => {
    const { rdos } = get()
    // Aggregate latest execution per trecho code (most recent RDO wins)
    const execMap = new Map<string, { executedMeters: number; date: string }>()
    const sortedRdos = [...rdos].sort((a, b) => a.date.localeCompare(b.date))
    for (const rdo of sortedRdos) {
      for (const t of rdo.trechos) {
        const prev = execMap.get(t.trechoCode)
        // Accumulate executed meters across all RDOs, or take latest
        execMap.set(t.trechoCode, {
          executedMeters: Math.max(t.executedMeters, prev?.executedMeters ?? 0),
          date: rdo.date,
        })
      }
    }
    const entries = Array.from(execMap.entries()).map(([code, data]) => ({
      trechoCode: code,
      executedMeters: data.executedMeters,
      date: data.date,
    }))
    if (entries.length === 0) return
    import('./planejamentoStore')
      .then(({ usePlanejamentoStore }) => {
        usePlanejamentoStore.getState().syncExecutionFromRdo(entries)
      })
      .catch(() => {})
  },

  // ── Demo / Clear ────────────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      rdos:             MOCK_RDOS,
      financialEntries: MOCK_RDO_FINANCIAL_ENTRIES,
      budgetBRL:        MOCK_RDO_BUDGET_BRL,
    }),

  clearData: () =>
    set({
      rdos:             [],
      financialEntries: [],
      budgetBRL:        0,
    }),

  // ── Backend sync ──────────────────────────────────────────────────────────────

  fetchFromBackend: async (nucleo) => {
    try {
      const res = await apiRdoList(nucleo)
      const mapped: RDO[] = (res.items ?? []).map((r: any) => ({
        id:          String(r.id ?? crypto.randomUUID()),
        number:      Number(r.numero ?? r.number ?? 0),
        date:        String(r.data ?? r.date ?? ''),
        status:      r.status ?? 'open',
        nucleoId:    String(r.nucleo ?? r.nucleo_id ?? ''),
        trechos:     (r.trechos as RdoTrechoEntry[]) ?? [],
        workers:     r.workers ?? [],
        equipment:   (r.equipment as RDO['equipment']) ?? [],
        photos:      (r.photos as RDO['photos']) ?? [],
        weather:     (r.weather as RDO['weather']) ?? 'sunny',
        notes:       String(r.notas ?? r.notes ?? ''),
        createdAt:   String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
        updatedAt:   String(r.updated_at ?? r.updatedAt ?? new Date().toISOString()),
      })) as any
      if (mapped.length > 0) set({ rdos: mapped })
    } catch {
      // fallback: keep existing mock data
    }
  },

  createRdoOnBackend: async (payload) => {
    try {
      return await apiRdoCreate(payload)
    } catch {
      return null
    }
  },

  closeRdoOnBackend: async (id) => {
    try {
      await apiRdoClose(id)
    } catch {
      // silent — local state already updated
    }
  },

  // ── Carrega RDOs + custos do Supabase (populados pelo Router WhatsApp) ──────
  loadFromSupabase: async (projectId) => {
    try {
      let rows: Record<string, unknown>[] | null = null
      if (projectId) {
        try {
          const apiRows = await apiProjetoRdos(projectId)
          rows = (apiRows.items ?? []) as Record<string, unknown>[]
        } catch {
          rows = null
        }
      }

      if (!rows && supabase) {
        let query = supabase
          .from('rdos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
        if (projectId) query = query.eq('projeto_id', projectId)
        const { data, error } = await query
        if (error || !data) return
        rows = data as Record<string, unknown>[]
      }
      if (!rows) return

      const rdos: RDO[] = []
      const entries: RdoFinancialEntry[] = []

      for (const row of rows) {
        const id = String(row.id)
        const data = String(row.data || '').slice(0, 10)
        const apontador = String(row.apontador || '-')
        const obs = String(row.observacoes || '')
        const fotos = (row.fotos as string[]) || []
        const producaoM = Number(row.producao_m || 0)
        const ligacoesDia = Number(row.ligacoes_dia || 0)
        const equipeN = Number(row.equipe_number || 0)
        const now = String(row.created_at || new Date().toISOString())
        const diesel = Number(row.custo_diesel || 0)
        const alimentacao = Number(row.custo_alimentacao || 0)
        const maoObra = Number(row.custo_mao_obra || 0)
        const materiais = Number(row.custo_materiais || 0)
        const dailyCost = Number(row.custo_total_dia || 0) || diesel + alimentacao + maoObra + materiais
        const lat = row.latitude == null ? '' : String(row.latitude)
        const lng = row.longitude == null ? '' : String(row.longitude)
        const projetoId = row.projeto_id ? String(row.projeto_id) : row.project_id ? String(row.project_id) : ''
        const trechoCode = projetoId ? projetoId.slice(0, 8).toUpperCase() : `RDO-${data || id.slice(0, 8)}`
        const equipmentMatch = obs.match(/Equipamentos?:\s*([^|]+)/i)
        const stoppageMatch = obs.match(/(?:Paralisa(?:c|ç)(?:ao|ão|oes|ões)|Pendencias?|Ocorrencias?):\s*([^|]+)/i)

        rdos.push({
          id,
          number: rdos.length + 1,
          date: data,
          responsible: apontador,
          weather: {
            morning: String(row.clima || 'good') as RDO['weather']['morning'],
            afternoon: String(row.clima || 'good') as RDO['weather']['afternoon'],
            night: String(row.clima || 'good') as RDO['weather']['night'],
            temperatureC: 25,
          },
          manpower: { foremanCount: 0, officialCount: 0, helperCount: Math.max(0, equipeN), operatorCount: 0 },
          equipment: equipmentMatch?.[1]
            ? equipmentMatch[1].split(',').map((name, i) => ({
                id: `${id}-eq-${i}`,
                name: name.trim(),
                quantity: 1,
                hours: 8,
                costBRL: 0,
              })).filter((e) => e.name)
            : [],
          services: [
            ...(producaoM > 0 ? [{ id: `${id}-prod`, description: 'Producao executada no dia', quantity: producaoM, unit: 'm' }] : []),
            ...(ligacoesDia > 0 ? [{ id: `${id}-lig`, description: 'Ligacoes executadas no dia', quantity: ligacoesDia, unit: 'un' }] : []),
          ],
          trechos: [{
            id: `${id}-trecho`,
            trechoCode,
            trechoDescription: obs ? obs.slice(0, 160) : 'RDO recebido via WhatsApp',
            plannedMeters: Math.max(producaoM, 1),
            executedMeters: producaoM,
            status: producaoM > 0 ? 'in_progress' : 'not_started',
            source: 'rdo',
            system: 'outro',
          }],
          geolocation: lat && lng ? { lat, lng } : null,
          observations: obs,
          incidents: stoppageMatch?.[1]?.trim() || '',
          photos: fotos.map((f, i) => ({ id: id + '-p' + i, base64: f, label: '' }) as unknown as RDO['photos'][number]),
          machineCostBRL: diesel,
          equipmentCostBRL: materiais,
          rentalCostBRL: materiais,
          directCostBRL: maoObra + materiais + diesel,
          indirectCostBRL: alimentacao,
          dailyCostBRL: dailyCost,
          stoppageNotes: stoppageMatch?.[1]?.trim() || '',
          productionNotes: producaoM > 0 ? `${producaoM} m executados` : '',
          lpsLinked: Boolean(projetoId || row.lps_id),
          createdAt: now,
          updatedAt: now,
        } as RDO)

        // Converte custos do dia em lançamentos financeiros
        const custos: Array<[string, string, number]> = [
          ['Maquinas', 'DIESEL/COMBUSTIVEL', diesel],
          ['Indiretos', 'ALIMENTACAO/HOTELARIA', alimentacao],
          ['Mao de Obra', 'MAO DE OBRA', maoObra],
          ['Equipamentos/Locacoes', 'MATERIAIS/LOCACOES', materiais],
        ]
        for (const [cat, desc, val] of custos) {
          if (val > 0) {
            entries.push({
              id: id + '-' + desc,
              date: data,
              category: cat,
              description: desc + ' (' + apontador + ')',
              valueBRL: val,
              type: 'expense',
            })
          }
        }
      }

      set({ rdos, financialEntries: entries })
    } catch {
      // silent
    }
  },
}))

// ─── EVM helpers (pure, exported for components) ──────────────────────────────

export interface EvmMetrics {
  bac:  number
  ev:   number
  ac:   number
  pv:   number
  cpi:  number
  spi:  number
  cv:   number
  sv:   number
  eac:  number
  etc:  number
  vac:  number
  tcpi: number
}

export function computeEvm(
  bac: number,
  totalPlannedM: number,
  totalExecutedM: number,
  workDaysElapsed: number,
  totalWorkDays: number,
  financialEntries: RdoFinancialEntry[],
): EvmMetrics {
  const ev = totalPlannedM > 0 ? bac * (totalExecutedM / totalPlannedM) : 0
  const pv = totalWorkDays > 0 ? bac * (workDaysElapsed / totalWorkDays) : 0
  const ac = financialEntries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.valueBRL, 0)

  const cpi  = ac  > 0 ? ev / ac  : 0
  const spi  = pv  > 0 ? ev / pv  : 0
  const cv   = ev - ac
  const sv   = ev - pv
  const eac  = cpi > 0 ? bac / cpi : bac
  const etc  = eac - ac
  const vac  = bac - eac
  const denom = bac - ac
  const tcpi = denom !== 0 ? (bac - ev) / denom : 0

  return {
    bac, ev, ac, pv,
    cpi:  Math.round(cpi  * 1000) / 1000,
    spi:  Math.round(spi  * 1000) / 1000,
    cv:   Math.round(cv   * 100)  / 100,
    sv:   Math.round(sv   * 100)  / 100,
    eac:  Math.round(eac  * 100)  / 100,
    etc:  Math.round(etc  * 100)  / 100,
    vac:  Math.round(vac  * 100)  / 100,
    tcpi: Math.round(tcpi * 1000) / 1000,
  }
}
