/**
 * Frota Veicular Store — operational fleet management.
 * Separate from otimizacaoFrotaStore (routing optimization).
 *
 * Security:
 *  - All IDs via crypto.randomUUID()
 *  - CPF/license numbers stored only in masked form (never raw)
 *  - No external calls, no localStorage
 */
import { create } from 'zustand'
import type {
  Vehicle,
  FuelRecord,
  VehicleMaintenanceRecord,
  VehicleDriver,
  VehicleRoute,
  VehicleServiceOrder,
  VehicleFine,
  FleetMaintenanceAlert,
  FleetScheduleEntry,
} from '@/types'
import {
  MOCK_VEHICLES,
  MOCK_VEHICLE_DRIVERS,
  MOCK_FUEL_RECORDS,
  MOCK_MAINTENANCE,
  MOCK_VEHICLE_ROUTES,
  MOCK_SERVICE_ORDERS,
  MOCK_VEHICLE_FINES,
  MOCK_FLEET_ALERTS,
  MOCK_FLEET_SCHEDULES,
} from '@/data/mockFrotaVeicular'

// ─── State ─────────────────────────────────────────────────────────────────────

interface FrotaVeicularState {
  vehicles:    Vehicle[]
  fuelRecords: FuelRecord[]
  maintenance: VehicleMaintenanceRecord[]
  drivers:     VehicleDriver[]
  routes:      VehicleRoute[]
  orders:      VehicleServiceOrder[]
  fines:       VehicleFine[]
  alerts:      FleetMaintenanceAlert[]
  schedules:   FleetScheduleEntry[]

  // ── Vehicle CRUD ────────────────────────────────────────────────────────────
  addVehicle:    (v: Omit<Vehicle, 'id'>) => void
  updateVehicle: (id: string, updates: Partial<Omit<Vehicle, 'id'>>) => void
  removeVehicle: (id: string) => void

  // ── Fuel ────────────────────────────────────────────────────────────────────
  addFuelRecord:    (r: Omit<FuelRecord, 'id'>) => void
  updateFuelRecord: (id: string, updates: Partial<Omit<FuelRecord, 'id'>>) => void
  removeFuelRecord: (id: string) => void

  // ── Maintenance ─────────────────────────────────────────────────────────────
  addMaintenance:    (m: Omit<VehicleMaintenanceRecord, 'id'>) => void
  updateMaintenance: (id: string, updates: Partial<Omit<VehicleMaintenanceRecord, 'id'>>) => void
  removeMaintenance: (id: string) => void

  // ── Drivers ─────────────────────────────────────────────────────────────────
  addDriver:    (d: Omit<VehicleDriver, 'id'>) => void
  updateDriver: (id: string, updates: Partial<Omit<VehicleDriver, 'id'>>) => void
  removeDriver: (id: string) => void

  // ── Routes ──────────────────────────────────────────────────────────────────
  addRoute:    (r: Omit<VehicleRoute, 'id'>) => void
  updateRoute: (id: string, updates: Partial<Omit<VehicleRoute, 'id'>>) => void
  removeRoute: (id: string) => void

  // ── Service Orders ──────────────────────────────────────────────────────────
  addOrder:    (o: Omit<VehicleServiceOrder, 'id' | 'code'>) => void
  updateOrder: (id: string, updates: Partial<Omit<VehicleServiceOrder, 'id'>>) => void
  removeOrder: (id: string) => void

  // ── Fines ───────────────────────────────────────────────────────────────────
  addFine:    (f: Omit<VehicleFine, 'id'>) => void
  updateFine: (id: string, updates: Partial<Omit<VehicleFine, 'id'>>) => void
  removeFine: (id: string) => void

  // ── Alerts ──────────────────────────────────────────────────────────────────
  addAlert:     (a: Omit<FleetMaintenanceAlert, 'id' | 'createdAt'>) => void
  dismissAlert: (id: string) => void

  // ── Schedules ───────────────────────────────────────────────────────────────
  addSchedule:    (s: Omit<FleetScheduleEntry, 'id'>) => void
  updateSchedule: (id: string, updates: Partial<Omit<FleetScheduleEntry, 'id'>>) => void
  removeSchedule: (id: string) => void

  // ── Demo ────────────────────────────────────────────────────────────────────
  loadDemoData: () => void
  clearData:    () => void
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useFrotaVeicularStore = create<FrotaVeicularState>((set) => ({
  vehicles:    MOCK_VEHICLES,
  fuelRecords: MOCK_FUEL_RECORDS,
  maintenance: MOCK_MAINTENANCE,
  drivers:     MOCK_VEHICLE_DRIVERS,
  routes:      MOCK_VEHICLE_ROUTES,
  orders:      MOCK_SERVICE_ORDERS,
  fines:       MOCK_VEHICLE_FINES,
  alerts:      MOCK_FLEET_ALERTS,
  schedules:   MOCK_FLEET_SCHEDULES,

  // ── Vehicles ─────────────────────────────────────────────────────────────────

  addVehicle: (v) =>
    set((s) => ({ vehicles: [...s.vehicles, { ...v, id: crypto.randomUUID() }] })),

  updateVehicle: (id, updates) =>
    set((s) => ({ vehicles: s.vehicles.map((v) => v.id === id ? { ...v, ...updates } : v) })),

  removeVehicle: (id) =>
    set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) })),

  // ── Fuel ─────────────────────────────────────────────────────────────────────

  addFuelRecord: (r) =>
    set((s) => ({ fuelRecords: [...s.fuelRecords, { ...r, id: crypto.randomUUID() }] })),

  updateFuelRecord: (id, updates) =>
    set((s) => ({ fuelRecords: s.fuelRecords.map((r) => r.id === id ? { ...r, ...updates } : r) })),

  removeFuelRecord: (id) =>
    set((s) => ({ fuelRecords: s.fuelRecords.filter((r) => r.id !== id) })),

  // ── Maintenance ───────────────────────────────────────────────────────────────

  addMaintenance: (m) =>
    set((s) => ({ maintenance: [...s.maintenance, { ...m, id: crypto.randomUUID() }] })),

  updateMaintenance: (id, updates) =>
    set((s) => ({ maintenance: s.maintenance.map((m) => m.id === id ? { ...m, ...updates } : m) })),

  removeMaintenance: (id) =>
    set((s) => ({ maintenance: s.maintenance.filter((m) => m.id !== id) })),

  // ── Drivers ───────────────────────────────────────────────────────────────────

  addDriver: (d) =>
    set((s) => ({ drivers: [...s.drivers, { ...d, id: crypto.randomUUID() }] })),

  updateDriver: (id, updates) =>
    set((s) => ({ drivers: s.drivers.map((d) => d.id === id ? { ...d, ...updates } : d) })),

  removeDriver: (id) =>
    set((s) => ({ drivers: s.drivers.filter((d) => d.id !== id) })),

  // ── Routes ────────────────────────────────────────────────────────────────────

  addRoute: (r) =>
    set((s) => ({ routes: [...s.routes, { ...r, id: crypto.randomUUID() }] })),

  updateRoute: (id, updates) =>
    set((s) => ({ routes: s.routes.map((r) => r.id === id ? { ...r, ...updates } : r) })),

  removeRoute: (id) =>
    set((s) => ({ routes: s.routes.filter((r) => r.id !== id) })),

  // ── Orders ────────────────────────────────────────────────────────────────────

  addOrder: (o) =>
    set((s) => {
      const count = s.orders.length + 1
      const code  = `OS-${String(count).padStart(4, '0')}`
      return { orders: [...s.orders, { ...o, id: crypto.randomUUID(), code }] }
    }),

  updateOrder: (id, updates) =>
    set((s) => ({ orders: s.orders.map((o) => o.id === id ? { ...o, ...updates } : o) })),

  removeOrder: (id) =>
    set((s) => ({ orders: s.orders.filter((o) => o.id !== id) })),

  // ── Fines ─────────────────────────────────────────────────────────────────────

  addFine: (f) =>
    set((s) => ({ fines: [...s.fines, { ...f, id: crypto.randomUUID() }] })),

  updateFine: (id, updates) =>
    set((s) => ({ fines: s.fines.map((f) => f.id === id ? { ...f, ...updates } : f) })),

  removeFine: (id) =>
    set((s) => ({ fines: s.fines.filter((f) => f.id !== id) })),

  // ── Alerts ────────────────────────────────────────────────────────────────────

  addAlert: (a) =>
    set((s) => ({
      alerts: [...s.alerts, { ...a, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
    })),

  dismissAlert: (id) =>
    set((s) => ({ alerts: s.alerts.map((a) => a.id === id ? { ...a, isActive: false } : a) })),

  // ── Schedules ─────────────────────────────────────────────────────────────────

  addSchedule: (s_) =>
    set((s) => ({ schedules: [...s.schedules, { ...s_, id: crypto.randomUUID() }] })),

  updateSchedule: (id, updates) =>
    set((s) => ({ schedules: s.schedules.map((sc) => sc.id === id ? { ...sc, ...updates } : sc) })),

  removeSchedule: (id) =>
    set((s) => ({ schedules: s.schedules.filter((sc) => sc.id !== id) })),

  // ── Demo / Clear ──────────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      vehicles:    MOCK_VEHICLES,
      fuelRecords: MOCK_FUEL_RECORDS,
      maintenance: MOCK_MAINTENANCE,
      drivers:     MOCK_VEHICLE_DRIVERS,
      routes:      MOCK_VEHICLE_ROUTES,
      orders:      MOCK_SERVICE_ORDERS,
      fines:       MOCK_VEHICLE_FINES,
      alerts:      MOCK_FLEET_ALERTS,
      schedules:   MOCK_FLEET_SCHEDULES,
    }),

  clearData: () =>
    set({
      vehicles:    [],
      fuelRecords: [],
      maintenance: [],
      drivers:     [],
      routes:      [],
      orders:      [],
      fines:       [],
      alerts:      [],
      schedules:   [],
    }),
}))
