import { create } from 'zustand'
import { apiManageRede, apiGeoJson, apiNucleos } from '@/lib/api'
import type {
  Rede360Tab, GridAssetTab, NetworkAsset, Rede360ServiceOrder, Outage,
  CircuitAsset, DeviceAsset, NWSWeatherStation, CustomerRecord,
  StructureAsset, VegetationPoint, HardeningPoint,
} from '@/types'
import {
  MOCK_ASSETS, MOCK_SERVICE_ORDERS, MOCK_OUTAGES,
  MOCK_CIRCUIT_ASSETS, MOCK_DEVICE_ASSETS, MOCK_WEATHER_STATIONS,
  MOCK_CUSTOMERS, MOCK_STRUCTURE_ASSETS, MOCK_VEGETATION_POINTS, MOCK_HARDENING_POINTS,
} from '@/data/mockRede360'

interface Rede360State {
  activeTab: Rede360Tab
  // Legacy asset data
  assets: NetworkAsset[]
  serviceOrders: Rede360ServiceOrder[]
  outages: Outage[]
  selectedAssetId: string | null
  selectedCircuitId: string | null
  // New typed data
  circuitAssets: CircuitAsset[]
  deviceAssets: DeviceAsset[]
  weatherStations: NWSWeatherStation[]
  customers: CustomerRecord[]
  structureAssets: StructureAsset[]
  vegetationPoints: VegetationPoint[]
  hardeningPoints: HardeningPoint[]
  // UI state
  layerVisibility: Record<string, boolean>
  activeGridTab: GridAssetTab
  bottomPanelOpen: boolean
  searchQuery: string
  // Actions
  setActiveTab: (tab: Rede360Tab) => void
  setSelectedAssetId: (id: string | null) => void
  setSelectedCircuitId: (id: string | null) => void
  setActiveGridTab: (tab: GridAssetTab) => void
  setBottomPanelOpen: (open: boolean) => void
  setSearchQuery: (q: string) => void
  addServiceOrder: (order: Omit<Rede360ServiceOrder, 'id' | 'createdAt'>) => void
  updateServiceOrder: (id: string, updates: Partial<Rede360ServiceOrder>) => void
  removeServiceOrder: (id: string) => void
  updateAsset: (id: string, updates: Partial<NetworkAsset>) => void
  setLayerVisibility: (key: string, visible: boolean) => void
  loadDemoData: () => void
  // Backend sync
  fetchFromBackend: (nucleo?: string) => Promise<void>
  nucleos: string[]
  geoJsonFeatures: Array<Record<string, unknown>>
}

export const useRede360Store = create<Rede360State>((set) => ({
  nucleos: [],
  geoJsonFeatures: [],
  activeTab: 'home',
  assets: MOCK_ASSETS,
  serviceOrders: MOCK_SERVICE_ORDERS,
  outages: MOCK_OUTAGES,
  selectedAssetId: null,
  selectedCircuitId: null,
  circuitAssets: MOCK_CIRCUIT_ASSETS,
  deviceAssets: MOCK_DEVICE_ASSETS,
  weatherStations: MOCK_WEATHER_STATIONS,
  customers: MOCK_CUSTOMERS,
  structureAssets: MOCK_STRUCTURE_ASSETS,
  vegetationPoints: MOCK_VEGETATION_POINTS,
  hardeningPoints: MOCK_HARDENING_POINTS,
  layerVisibility: {
    assets: true,
    orders: true,
    outages: true,
    risk: false,
    sewer: true,
    water: true,
    drainage: true,
    civil: true,
    generic: true,
    circuits: true,
    riskLayers: false,
    serviceDistricts: false,
    landCover: false,
  },
  activeGridTab: 'circuit',
  bottomPanelOpen: true,
  searchQuery: '',
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedAssetId: (id) => set({ selectedAssetId: id, selectedCircuitId: null }),
  setSelectedCircuitId: (id) => set({ selectedCircuitId: id, selectedAssetId: null }),
  setActiveGridTab: (tab) => set({ activeGridTab: tab }),
  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  addServiceOrder: (order) => set((s) => ({
    serviceOrders: [...s.serviceOrders, { ...order, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
  })),
  updateServiceOrder: (id, updates) => set((s) => ({
    serviceOrders: s.serviceOrders.map((o) => o.id === id ? { ...o, ...updates } : o),
  })),
  removeServiceOrder: (id) => set((s) => ({
    serviceOrders: s.serviceOrders.filter((o) => o.id !== id),
  })),
  updateAsset: (id, updates) => set((s) => ({
    assets: s.assets.map((a) => a.id === id ? { ...a, ...updates } : a),
  })),
  setLayerVisibility: (key, visible) => set((s) => ({
    layerVisibility: { ...s.layerVisibility, [key]: visible },
  })),
  loadDemoData: () => set({
    assets: MOCK_ASSETS,
    serviceOrders: MOCK_SERVICE_ORDERS,
    outages: MOCK_OUTAGES,
    circuitAssets: MOCK_CIRCUIT_ASSETS,
    deviceAssets: MOCK_DEVICE_ASSETS,
    weatherStations: MOCK_WEATHER_STATIONS,
    customers: MOCK_CUSTOMERS,
    structureAssets: MOCK_STRUCTURE_ASSETS,
    vegetationPoints: MOCK_VEGETATION_POINTS,
    hardeningPoints: MOCK_HARDENING_POINTS,
  }),

  fetchFromBackend: async (nucleo) => {
    // WCR demo mode: skip backend (old Supabase data, doesn't have WCR projects)
    if (import.meta.env.VITE_ENABLE_DEMO_DATA === 'true') return
    try {
      const [redeRes, geoRes, nucleosRes] = await Promise.allSettled([
        apiManageRede(nucleo),
        apiGeoJson(nucleo),
        apiNucleos(),
      ])

      if (redeRes.status === 'fulfilled') {
        const { nodes, edges } = redeRes.value
        const mappedAssets: any[] = (nodes ?? []).map((n: any) => ({
          id:       String(n.id ?? crypto.randomUUID()),
          name:     String(n.nome ?? n.name ?? n.id ?? ''),
          type:     String(n.tipo ?? n.type ?? 'generic') as NetworkAsset['type'],
          status:   (n.status as NetworkAsset['status']) ?? 'active',
          lat:      Number(n.lat ?? n.y ?? 0),
          lng:      Number(n.lng ?? n.x ?? 0),
          metadata: (n.metadata as Record<string, unknown>) ?? {},
        }))
        const mappedCircuits: any[] = (edges ?? []).map((e: any, i: number) => ({
          id:          String((e as Record<string,unknown>).id ?? `edge-${i}`),
          name:        String((e as Record<string,unknown>).nome ?? (e as Record<string,unknown>).name ?? `Trecho ${i + 1}`),
          voltage:     Number((e as Record<string,unknown>).tensao ?? 0),
          lengthKm:    Number(e.ext ?? 0) / 1000,
          status:      e.status ?? 'energized',
          conductorType: String((e as Record<string,unknown>).condutor ?? 'unknown'),
          phases:      Number((e as Record<string,unknown>).fases ?? 3),
          capacity:    Number(e.c ?? 0),
          metadata:    {},
        }))
        if (mappedAssets.length > 0) set({ assets: mappedAssets })
        if (mappedCircuits.length > 0) set({ circuitAssets: mappedCircuits })
      }

      if (geoRes.status === 'fulfilled') {
        set({ geoJsonFeatures: geoRes.value.features ?? [] })
      }

      if (nucleosRes.status === 'fulfilled') {
        set({ nucleos: (nucleosRes.value.items ?? []).map((n) => n.nome) })
      }
    } catch {
      // fallback: keep existing mock data
    }
  },

  /**
   * Carrega dados do pipelineStore central (integração ConstruData).
   * Converte nós e segmentos do pipeline em assets e circuitos da Rede 360.
   */
  loadFromPipeline: () => {
    import('./pipelineStore').then(({ usePipelineStore }) => {
      const { nodes, segments, geoJson, nucleos, hasRealData } = usePipelineStore.getState()
      if (!hasRealData) return

      if (nodes.length > 0) {
        const mappedAssets: NetworkAsset[] = nodes.map((n) => ({
          id: n.id,
          name: n.label,
          type: n.nodeType === 'structure' ? 'substation' : n.nodeType === 'endpoint' ? 'meter' : 'pole',
          status: 'active',
          lat: n.lat,
          lng: n.lng,
          metadata: { elevation: n.elevation, depth: n.depth },
        })) as unknown as NetworkAsset[]
        set({ assets: mappedAssets })
      }

      if (geoJson) {
        set({ geoJsonFeatures: geoJson.features ?? [] })
      }

      if (nucleos.length > 0) {
        set({ nucleos })
      }
    })
  },
}))
