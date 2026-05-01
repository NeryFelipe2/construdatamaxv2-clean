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
import {
  apiRdoList,
  apiRdoCreate,
  apiRdoClose,
  apiProjetoRdos,
  apiProjetoCriarRdo,
  apiProjetoPreencherTexto,
  apiProjetoRdoAutomaticoTexto,
  apiProjetoRdoAutomaticoUpload,
  apiProjetoRdoFinalizar,
  apiProjetoRdoRejeitar,
  apiProjetoRdoRevisar,
  apiProjetoRdoMedicaoFontes,
  type ApiRdoAutomaticoResult,
  type CanonicalIntegrationStatus,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'

const ALLOW_DEMO_DATA = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'

function mapWeatherToDb(value: string | undefined): string | null {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'good') return 'bom'
  if (normalized === 'cloudy') return 'nublado'
  if (normalized === 'rain') return 'chuva'
  if (normalized === 'storm') return 'tempestade'
  if (['bom', 'nublado', 'chuva', 'tempestade'].includes(normalized)) return normalized
  return null
}

function mapWeatherFromDb(value: string | null | undefined): RDO['weather']['morning'] {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'nublado') return 'cloudy'
  if (normalized === 'chuva') return 'rain'
  if (normalized === 'tempestade') return 'storm'
  return 'good'
}

// ─── State ────────────────────────────────────────────────────────────────────

interface RdoState {
  activeTab:        RdoTab
  rdos:             RDO[]
  financialEntries: RdoFinancialEntry[]
  budgetBRL:        number
  integrationStatus: CanonicalIntegrationStatus
  currentProjectId: string | null
  isSaving:         boolean
  automaticoResult: ApiRdoAutomaticoResult | null
  medicaoFontes:    Array<Record<string, unknown>>

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
  createRdoForProject:    (projectId: string, rdo: Omit<RDO, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => Promise<Record<string, unknown> | null>
  createRdoTextForProject: (projectId: string, texto: string) => Promise<Record<string, unknown> | null>
  createAutomaticoFromText: (projectId: string, texto: string) => Promise<ApiRdoAutomaticoResult | null>
  uploadAutomatico:       (projectId: string, fd: FormData) => Promise<ApiRdoAutomaticoResult | null>
  revisarRdo:             (projectId: string, rdoId: string, payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  finalizarRdo:           (projectId: string, rdoId: string) => Promise<Record<string, unknown> | null>
  rejeitarRdo:            (projectId: string, rdoId: string, motivo?: string) => Promise<Record<string, unknown> | null>
  loadMedicaoFontes:      (projectId: string, rdoId: string) => Promise<Array<Record<string, unknown>>>
  closeRdoOnBackend:      (id: number) => Promise<void>

  // ── Supabase sync (RDOs do WhatsApp) ─────────────────────────────────────────
  loadFromSupabase:       (projectId?: string | null) => Promise<void>
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRdoStore = create<RdoState>((set, get) => ({
  activeTab:        'dashboard',
  rdos:             ALLOW_DEMO_DATA ? MOCK_RDOS : [],
  financialEntries: ALLOW_DEMO_DATA ? MOCK_RDO_FINANCIAL_ENTRIES : [],
  budgetBRL:        ALLOW_DEMO_DATA ? MOCK_RDO_BUDGET_BRL : 0,
  integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial',
  currentProjectId: null,
  isSaving:         false,
  automaticoResult: null,
  medicaoFontes:    [],

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

  createRdoForProject: async (projectId, rdo) => {
    set({ isSaving: true })
    const productionMeters = rdo.trechos.reduce((sum, trecho) => sum + (trecho.executedMeters || 0), 0)
    const servicesSummary = rdo.services
      .map((service) => `${service.description}: ${service.quantity} ${service.unit}`)
      .join(' | ')
    const equipmentSummary = rdo.equipment
      .map((item) => `${item.name} x${item.quantity} (${item.hours}h)`)
      .join(', ')
    const observations = [
      rdo.observations?.trim(),
      rdo.productionNotes?.trim() ? `Producao: ${rdo.productionNotes.trim()}` : '',
      rdo.stoppageNotes?.trim() ? `Paralisacoes: ${rdo.stoppageNotes.trim()}` : '',
      servicesSummary ? `Servicos: ${servicesSummary}` : '',
      equipmentSummary ? `Equipamentos: ${equipmentSummary}` : '',
    ]
      .filter(Boolean)
      .join(' | ')

      const climaDb = mapWeatherToDb(rdo.weather.morning)
      const payload: Record<string, unknown> = {
        projeto_id: projectId,
        data: rdo.date,
        origem: 'web',
        status: 'recebido',
        apontador: rdo.responsible,
        engenheiro: rdo.responsible,
        turno: 'dia',
        producao: rdo.productionNotes || servicesSummary || observations,
      equipe_number:
        (rdo.manpower.foremanCount || 0) +
        (rdo.manpower.officialCount || 0) +
        (rdo.manpower.helperCount || 0) +
        (rdo.manpower.operatorCount || 0),
      equipe: JSON.stringify({
        foremanCount: rdo.manpower.foremanCount || 0,
        officialCount: rdo.manpower.officialCount || 0,
        helperCount: rdo.manpower.helperCount || 0,
        operatorCount: rdo.manpower.operatorCount || 0,
        employeeNames: rdo.manpower.employeeNames || [],
      }),
      producao_m: productionMeters,
      observacoes: observations,
      ocorrencias: rdo.incidents || rdo.ocorrencias || '',
      fotos: rdo.photos.map((photo) => photo.base64),
      latitude: rdo.geolocation?.lat ? Number(rdo.geolocation.lat) : null,
      longitude: rdo.geolocation?.lng ? Number(rdo.geolocation.lng) : null,
      maquinas: rdo.equipment.map((item) => ({
        nome: item.name,
        quantidade: item.quantity,
        horas: item.hours,
        custoBRL: item.costBRL || 0,
      })),
      equipamentos: rdo.equipment.map((item) => ({
        nome: item.name,
        quantidade: item.quantity,
        horas: item.hours,
        custoBRL: item.costBRL || 0,
      })),
      locacoes: rdo.equipment.filter((item) => (item.costBRL || 0) > 0).map((item) => ({
        nome: item.name,
        custoBRL: item.costBRL || 0,
      })),
      mao_obra: [
        { tipo: 'encarregado', quantidade: rdo.manpower.foremanCount || 0 },
        { tipo: 'oficial', quantidade: rdo.manpower.officialCount || 0 },
        { tipo: 'ajudante', quantidade: rdo.manpower.helperCount || 0 },
        { tipo: 'operador', quantidade: rdo.manpower.operatorCount || 0 },
      ].filter((item) => item.quantidade > 0),
      materiais: rdo.services.map((service) => ({
        descricao: service.description,
        quantidade: service.quantity,
        unidade: service.unit,
      })),
      custo_direto:
        (rdo.machineCostBRL || 0) +
        (rdo.equipmentCostBRL || 0) +
        (rdo.rentalCostBRL || 0) +
        (rdo.directCostBRL || 0),
      custo_indireto: rdo.indirectCostBRL || 0,
      custo_total_dia:
        rdo.dailyCostBRL ||
        (rdo.machineCostBRL || 0) +
          (rdo.equipmentCostBRL || 0) +
          (rdo.rentalCostBRL || 0) +
          (rdo.directCostBRL || 0) +
          (rdo.indirectCostBRL || 0),
        paralisacoes: rdo.stoppageNotes || '',
        payload_original: rdo,
      }
      if (climaDb) {
        payload.clima = climaDb
      }

    try {
      const created = await apiProjetoCriarRdo(projectId, payload)
      await get().loadFromSupabase(projectId)
      set({ integrationStatus: 'connected', currentProjectId: projectId, isSaving: false })
      return created
    } catch {
      set({ integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial', currentProjectId: projectId, isSaving: false })
      return null
    }
  },

  createRdoTextForProject: async (projectId, texto) => {
    set({ isSaving: true })
    try {
      const created = await apiProjetoPreencherTexto(projectId, texto)
      await get().loadFromSupabase(projectId)
      set({ integrationStatus: 'connected', currentProjectId: projectId, isSaving: false })
      return created
    } catch {
      set({ integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial', currentProjectId: projectId, isSaving: false })
      return null
    }
  },

  createAutomaticoFromText: async (projectId, texto) => {
    set({ isSaving: true })
    try {
      const result = await apiProjetoRdoAutomaticoTexto(projectId, texto)
      await get().loadFromSupabase(projectId)
      set({ automaticoResult: result, integrationStatus: 'connected', currentProjectId: projectId, isSaving: false })
      return result
    } catch {
      set({ integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial', currentProjectId: projectId, isSaving: false })
      return null
    }
  },

  uploadAutomatico: async (projectId, fd) => {
    set({ isSaving: true })
    try {
      const result = await apiProjetoRdoAutomaticoUpload(projectId, fd)
      await get().loadFromSupabase(projectId)
      set({ automaticoResult: result, integrationStatus: 'connected', currentProjectId: projectId, isSaving: false })
      return result
    } catch {
      set({ integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial', currentProjectId: projectId, isSaving: false })
      return null
    }
  },

  revisarRdo: async (projectId, rdoId, payload) => {
    set({ isSaving: true })
    try {
      const result = await apiProjetoRdoRevisar(projectId, rdoId, payload)
      await get().loadFromSupabase(projectId)
      set({ integrationStatus: 'connected', currentProjectId: projectId, isSaving: false })
      return result
    } catch {
      set({ integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial', currentProjectId: projectId, isSaving: false })
      return null
    }
  },

  finalizarRdo: async (projectId, rdoId) => {
    set({ isSaving: true })
    try {
      const result = await apiProjetoRdoFinalizar(projectId, rdoId)
      await get().loadFromSupabase(projectId)
      set({ integrationStatus: 'connected', currentProjectId: projectId, isSaving: false, medicaoFontes: (result.medicao_fontes as Array<Record<string, unknown>>) ?? [] })
      return result
    } catch {
      set({ integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial', currentProjectId: projectId, isSaving: false })
      return null
    }
  },

  rejeitarRdo: async (projectId, rdoId, motivo) => {
    set({ isSaving: true })
    try {
      const result = await apiProjetoRdoRejeitar(projectId, rdoId, { motivo })
      await get().loadFromSupabase(projectId)
      set({ integrationStatus: 'connected', currentProjectId: projectId, isSaving: false })
      return result
    } catch {
      set({ integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial', currentProjectId: projectId, isSaving: false })
      return null
    }
  },

  loadMedicaoFontes: async (projectId, rdoId) => {
    try {
      const result = await apiProjetoRdoMedicaoFontes(projectId, rdoId)
      const items = result.items ?? []
      set({ medicaoFontes: items, integrationStatus: 'connected' })
      return items
    } catch {
      set({ medicaoFontes: [] })
      return []
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
      set({ currentProjectId: projectId ?? null })
      let rows: Record<string, unknown>[] | null = null
      if (projectId) {
        try {
          const apiRows = await apiProjetoRdos(projectId)
          rows = (apiRows.items ?? []) as Record<string, unknown>[]
          set({ integrationStatus: 'connected' })
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
        set({ integrationStatus: 'partial' })
      }
      if (!rows) {
        set({
          rdos: ALLOW_DEMO_DATA ? MOCK_RDOS : [],
          financialEntries: ALLOW_DEMO_DATA ? MOCK_RDO_FINANCIAL_ENTRIES : [],
          budgetBRL: ALLOW_DEMO_DATA ? MOCK_RDO_BUDGET_BRL : 0,
          integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial',
        })
        return
      }

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
        const payloadOriginal = (row.payload_original && typeof row.payload_original === 'object')
          ? row.payload_original as Record<string, any>
          : {}
        const rdoV5 = (payloadOriginal.rdo_v5 && typeof payloadOriginal.rdo_v5 === 'object')
          ? payloadOriginal.rdo_v5 as Record<string, any>
          : {}
        const extractedFields = (rdoV5.fields && typeof rdoV5.fields === 'object')
          ? rdoV5.fields as Record<string, any>
          : {}
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
            morning: mapWeatherFromDb(row.clima ? String(row.clima) : undefined),
            afternoon: mapWeatherFromDb(row.clima ? String(row.clima) : undefined),
            night: mapWeatherFromDb(row.clima ? String(row.clima) : undefined),
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
          origem: String(row.origem || ''),
          statusRevisao: String(payloadOriginal.status_revisao || rdoV5.status_revisao || (row.status === 'fechado' ? 'finalizado' : 'rascunho')) as RDO['statusRevisao'],
          assinaturaPresente: Boolean(payloadOriginal.assinatura_presente || extractedFields.assinatura_presente),
          pendingFields: Array.isArray(rdoV5.pending_fields) ? rdoV5.pending_fields.map(String) : [],
          extractionConfidence: (rdoV5.confidence && typeof rdoV5.confidence === 'object') ? rdoV5.confidence as Record<string, number> : undefined,
          evidencias: [],
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

      set({
        rdos,
        financialEntries: entries,
        budgetBRL: ALLOW_DEMO_DATA && entries.length === 0 ? MOCK_RDO_BUDGET_BRL : 0,
        integrationStatus: rows.length > 0 ? get().integrationStatus : (ALLOW_DEMO_DATA ? 'local' : 'partial'),
      })
    } catch {
      set({
        rdos: ALLOW_DEMO_DATA ? MOCK_RDOS : [],
        financialEntries: ALLOW_DEMO_DATA ? MOCK_RDO_FINANCIAL_ENTRIES : [],
        budgetBRL: ALLOW_DEMO_DATA ? MOCK_RDO_BUDGET_BRL : 0,
        integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial',
      })
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
