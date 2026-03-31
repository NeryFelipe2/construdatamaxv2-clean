import { create } from 'zustand'
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
}

export const useRede360Store = create<Rede360State>((set) => ({
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
}))
