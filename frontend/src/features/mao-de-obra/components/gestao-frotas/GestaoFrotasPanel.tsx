/**
 * Gestão de Frotas Veicular — main panel with 11 sub-tabs.
 * Security: no dangerouslySetInnerHTML; all IDs via crypto.randomUUID() in store;
 * CPF/license displayed in masked form only; CSV export sanitized.
 */
import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFrotaVeicularStore } from '@/store/frotaVeicularStore'
import type {
  Vehicle, FuelRecord, VehicleMaintenanceRecord, VehicleDriver,
  VehicleServiceOrder,
  FleetScheduleEntry, VehicleType, VehicleStatus, FuelType,
  VehicleMaintenanceType, VehicleMaintenanceStatus, ServiceOrderStatus,
  FineStatus, RouteStatus,
} from '@/types'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function safeCsvCell(v: string | number): string {
  const s = String(v)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: 'Automóvel', truck: 'Caminhão', van: 'Van/Furgão',
  motorcycle: 'Motocicleta', heavy: 'Máquina Pesada', pickup: 'Picape',
}
const STATUS_LABELS: Record<VehicleStatus, string> = {
  active: 'Ativo', maintenance: 'Em Manutenção', inactive: 'Inativo', unavailable: 'Indisponível',
}
const STATUS_COLORS: Record<VehicleStatus, string> = {
  active:      'bg-[#22c55e]/15 text-[#22c55e]',
  maintenance: 'bg-[#f59e0b]/15 text-[#f59e0b]',
  inactive:    'bg-[var(--color-surface)] text-[var(--color-text-muted)]',
  unavailable: 'bg-[#ef4444]/15 text-[#ef4444]',
}
const ALERT_COLORS: Record<string, string> = {
  critical: 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30',
  high:     'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30',
  medium:   'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30',
  low:      'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
}
const FINE_STATUS_COLORS: Record<FineStatus, string> = {
  pending:   'bg-[#f59e0b]/15 text-[#f59e0b]',
  paid:      'bg-[#22c55e]/15 text-[#22c55e]',
  contested: 'bg-[#8b5cf6]/15 text-[#8b5cf6]',
}
const OS_STATUS_COLORS: Record<ServiceOrderStatus, string> = {
  open:           'bg-[#f59e0b]/15 text-[#f59e0b]',
  in_progress:    'bg-[#3b82f6]/15 text-[#3b82f6]',
  awaiting_parts: 'bg-[#8b5cf6]/15 text-[#8b5cf6]',
  completed:      'bg-[#22c55e]/15 text-[#22c55e]',
  cancelled:      'bg-[var(--color-surface)] text-[var(--color-text-muted)]',
}
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-[#ef4444]', high: 'text-[#f59e0b]', normal: 'text-[var(--color-text-secondary)]', low: 'text-[var(--color-text-muted)]',
}

function StatusBadge({ status }: { status: VehicleStatus }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
}

const inputCls  = 'w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]'
const labelCls  = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1'
const thCls     = 'text-left px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap'
const tdCls     = 'px-3 py-3 text-sm text-[var(--color-text-secondary)]'
const actionBtn = 'px-3 py-1 rounded-lg text-xs font-medium transition-colors'

// ─── Vehicle Dialog ───────────────────────────────────────────────────────────

function VehicleDialog({ vehicle, onClose, onSave }: {
  vehicle?: Vehicle; onClose: () => void
  onSave: (data: Omit<Vehicle, 'id'>) => void
}) {
  const [form, setForm] = useState({
    plate:            vehicle?.plate            ?? '',
    make:             vehicle?.make             ?? '',
    model:            vehicle?.model            ?? '',
    year:             vehicle?.year             ?? new Date().getFullYear(),
    type:             vehicle?.type             ?? ('truck' as VehicleType),
    fuelType:         vehicle?.fuelType         ?? ('diesel' as FuelType),
    currentKm:        vehicle?.currentKm        ?? 0,
    status:           vehicle?.status           ?? ('active' as VehicleStatus),
    department:       vehicle?.department       ?? '',
    acquisitionDate:  vehicle?.acquisitionDate  ?? '',
    acquisitionValue: vehicle?.acquisitionValue ?? 0,
    notes:            vehicle?.notes            ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!form.plate.trim())  e.plate = 'Placa obrigatória'
    if (!form.make.trim())   e.make  = 'Marca obrigatória'
    if (!form.model.trim())  e.model = 'Modelo obrigatório'
    setErrors(e)
    return Object.keys(e).length === 0
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSave(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl bg-[var(--color-surface-elevated)] rounded-2xl shadow-2xl p-6 mb-8">
        <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-5">{vehicle ? 'Editar Veículo' : 'Novo Veículo'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Placa</label>
              <input className={inputCls} value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} placeholder="ABC-1234" />
              {errors.plate && <p className="text-xs text-[#ef4444] mt-1">{errors.plate}</p>}
            </div>
            <div>
              <label className={labelCls}>Marca</label>
              <input className={inputCls} value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} />
              {errors.make && <p className="text-xs text-[#ef4444] mt-1">{errors.make}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Modelo</label>
              <input className={inputCls} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
              {errors.model && <p className="text-xs text-[#ef4444] mt-1">{errors.model}</p>}
            </div>
            <div>
              <label className={labelCls}>Ano</label>
              <input type="number" min={1980} max={2030} className={inputCls} value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as VehicleType }))}>
                {(Object.entries(VEHICLE_TYPE_LABELS)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Combustível</label>
              <select className={inputCls} value={form.fuelType} onChange={e => setForm(f => ({ ...f, fuelType: e.target.value as FuelType }))}>
                {(['gasoline','diesel','ethanol','flex','electric','gnv'] as FuelType[]).map(f => (
                  <option key={f} value={f}>{f === 'gnv' ? 'GNV' : f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as VehicleStatus }))}>
                {(Object.entries(STATUS_LABELS)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>KM Atual</label>
              <input type="number" min={0} className={inputCls} value={form.currentKm} onChange={e => setForm(f => ({ ...f, currentKm: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Departamento</label>
              <input className={inputCls} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data de Aquisição</label>
              <input type="date" className={inputCls} value={form.acquisitionDate} onChange={e => setForm(f => ({ ...f, acquisitionDate: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Valor de Aquisição (R$)</label>
              <input type="number" min={0} className={inputCls} value={form.acquisitionValue} onChange={e => setForm(f => ({ ...f, acquisitionValue: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Observações</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">Cancelar</button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Generic simple dialog ────────────────────────────────────────────────────

function SimpleDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-[var(--color-surface-elevated)] rounded-2xl shadow-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Sub-tab panels ───────────────────────────────────────────────────────────

// VEÍCULOS
function VeiculosTab() {
  const { vehicles, addVehicle, updateVehicle, removeVehicle } = useFrotaVeicularStore(
    useShallow(s => ({ vehicles: s.vehicles, addVehicle: s.addVehicle, updateVehicle: s.updateVehicle, removeVehicle: s.removeVehicle }))
  )
  const [dialog, setDialog]   = useState<{ open: boolean; vehicle?: Vehicle }>({ open: false })
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          {['active','maintenance','inactive'].map(s => {
            const cnt = vehicles.filter(v => v.status === s).length
            return <div key={s} className={`px-3 py-2 rounded-xl border text-xs font-medium ${STATUS_COLORS[s as VehicleStatus]} border-current/20`}>{STATUS_LABELS[s as VehicleStatus]}: {cnt}</div>
          })}
        </div>
        <button onClick={() => setDialog({ open: true })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity">
          + Novo Veículo
        </button>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {['Placa','Veículo','Tipo','Ano','KM Atual','Combustível','Status','Ações'].map(h => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {vehicles.map(v => (
                <>
                  <tr key={v.id} className={`hover:bg-[var(--color-surface)] transition-colors cursor-pointer ${selected === v.id ? 'bg-[var(--color-surface)]' : ''}`}
                    onClick={() => setSelected(s => s === v.id ? null : v.id)}>
                    <td className={`${tdCls} font-mono font-bold text-[var(--color-text-primary)]`}>{v.plate}</td>
                    <td className={`${tdCls} font-medium text-[var(--color-text-primary)]`}>{v.make} {v.model}</td>
                    <td className={tdCls}>{VEHICLE_TYPE_LABELS[v.type]}</td>
                    <td className={tdCls}>{v.year}</td>
                    <td className={`${tdCls} font-medium`}>{v.currentKm.toLocaleString('pt-BR')} km</td>
                    <td className={tdCls}>{v.fuelType.toUpperCase()}</td>
                    <td className={tdCls}><StatusBadge status={v.status} /></td>
                    <td className={tdCls}>
                      <div className="flex gap-1.5">
                        <button onClick={e => { e.stopPropagation(); setDialog({ open: true, vehicle: v }) }}
                          className={`${actionBtn} bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20`}>Editar</button>
                        <button onClick={e => { e.stopPropagation(); removeVehicle(v.id) }}
                          className={`${actionBtn} bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20`}>Remover</button>
                      </div>
                    </td>
                  </tr>
                  {selected === v.id && (
                    <tr className="bg-[var(--color-surface)]">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          {[
                            ['Departamento', v.department ?? '—'],
                            ['Aquisição', v.acquisitionDate ? fmtDate(v.acquisitionDate) : '—'],
                            ['Valor Aquisição', fmt(v.acquisitionValue)],
                          ].map(([l, val]) => (
                            <div key={l}><span className="text-[var(--color-text-muted)]">{l}: </span><span className="font-medium text-[var(--color-text-primary)]">{val}</span></div>
                          ))}
                          {v.notes && <div className="col-span-3 text-[var(--color-text-muted)]">{v.notes}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {dialog.open && (
        <VehicleDialog vehicle={dialog.vehicle} onClose={() => setDialog({ open: false })}
          onSave={data => dialog.vehicle ? updateVehicle(dialog.vehicle.id, data) : addVehicle(data)} />
      )}
    </div>
  )
}

// ABASTECIMENTO
function AbastecimentoTab() {
  const { fuelRecords, vehicles, drivers, addFuelRecord, removeFuelRecord } = useFrotaVeicularStore(
    useShallow(s => ({ fuelRecords: s.fuelRecords, vehicles: s.vehicles, drivers: s.drivers, addFuelRecord: s.addFuelRecord, removeFuelRecord: s.removeFuelRecord }))
  )
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ vehicleId: '', driverId: '', date: new Date().toISOString().split('T')[0], liters: 0, pricePerLiter: 0, kmAtFill: 0, fullTank: true, station: '', notes: '' })

  const sorted = useMemo(() => [...fuelRecords].sort((a, b) => b.date.localeCompare(a.date)), [fuelRecords])
  const totalCostMonth = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7)
    return fuelRecords.filter(r => r.date.startsWith(m)).reduce((s, r) => s + r.totalCost, 0)
  }, [fuelRecords])

  function getVehiclePlate(id: string) { return vehicles.find(v => v.id === id)?.plate ?? id }
  function getDriverName(id?: string) { return id ? (drivers.find(d => d.id === id)?.name ?? id) : '—' }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vehicleId || form.liters <= 0) return
    addFuelRecord({ ...form, totalCost: parseFloat((form.liters * form.pricePerLiter).toFixed(2)) })
    setDialog(false)
    setForm({ vehicleId: '', driverId: '', date: new Date().toISOString().split('T')[0], liters: 0, pricePerLiter: 0, kmAtFill: 0, fullTank: true, station: '', notes: '' })
  }

  // km/L per vehicle (last 5 fills with full tank)
  const efficiency = useMemo(() => {
    const byVeh: Record<string, FuelRecord[]> = {}
    for (const r of sorted.filter(r => r.fullTank)) {
      if (!byVeh[r.vehicleId]) byVeh[r.vehicleId] = []
      byVeh[r.vehicleId].push(r)
    }
    const result: Record<string, string> = {}
    for (const [vId, records] of Object.entries(byVeh)) {
      if (records.length < 2) { result[vId] = '—'; continue }
      const kmDiff = records[0].kmAtFill - records[1].kmAtFill
      const liters = records[1].liters
      result[vId] = kmDiff > 0 && liters > 0 ? `${(kmDiff / liters).toFixed(2)} km/L` : '—'
    }
    return result
  }, [sorted])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-xs font-medium text-[var(--color-text-secondary)]">
          Custo mês atual: <strong className="text-[var(--color-text-primary)]">{fmt(totalCostMonth)}</strong>
        </div>
        <button onClick={() => setDialog(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity">
          + Registrar Abastecimento
        </button>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {['Data','Placa','Motorista','Litros','R$/L','Total','KM','Tanque Cheio','Eficiência','Ações'].map(h => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {sorted.length === 0
                ? <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-[var(--color-text-muted)]">Nenhum abastecimento registrado</td></tr>
                : sorted.map(r => (
                  <tr key={r.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className={tdCls}>{fmtDate(r.date)}</td>
                    <td className={`${tdCls} font-mono font-bold text-[var(--color-text-primary)]`}>{getVehiclePlate(r.vehicleId)}</td>
                    <td className={tdCls}>{getDriverName(r.driverId)}</td>
                    <td className={tdCls}>{r.liters.toFixed(1)} L</td>
                    <td className={tdCls}>R$ {r.pricePerLiter.toFixed(2)}</td>
                    <td className={`${tdCls} font-semibold text-[var(--color-text-primary)]`}>{fmt(r.totalCost)}</td>
                    <td className={tdCls}>{r.kmAtFill.toLocaleString('pt-BR')}</td>
                    <td className={tdCls}>{r.fullTank ? '✓' : '—'}</td>
                    <td className={`${tdCls} text-[#22c55e] font-medium`}>{efficiency[r.vehicleId] ?? '—'}</td>
                    <td className={tdCls}>
                      <button onClick={() => removeFuelRecord(r.id)} className={`${actionBtn} bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20`}>Remover</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {dialog && (
        <SimpleDialog title="Registrar Abastecimento" onClose={() => setDialog(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Veículo</label>
                <select className={inputCls} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Motorista</label>
                <select className={inputCls} value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                  <option value="">Sem motorista</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Data</label>
                <input type="date" className={inputCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Litros</label>
                <input type="number" min={0} step={0.1} className={inputCls} value={form.liters} onChange={e => setForm(f => ({ ...f, liters: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelCls}>R$/Litro</label>
                <input type="number" min={0} step={0.01} className={inputCls} value={form.pricePerLiter} onChange={e => setForm(f => ({ ...f, pricePerLiter: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>KM no abastecimento</label>
                <input type="number" min={0} className={inputCls} value={form.kmAtFill} onChange={e => setForm(f => ({ ...f, kmAtFill: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={labelCls}>Posto</label>
                <input className={inputCls} value={form.station} onChange={e => setForm(f => ({ ...f, station: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="fullTank" checked={form.fullTank} onChange={e => setForm(f => ({ ...f, fullTank: e.target.checked }))} className="w-4 h-4 rounded" />
              <label htmlFor="fullTank" className="text-sm text-[var(--color-text-secondary)]">Tanque cheio</label>
            </div>
            {form.liters > 0 && form.pricePerLiter > 0 && (
              <div className="px-3 py-2 rounded-lg bg-[var(--color-accent)]/10 text-sm text-[var(--color-accent)] font-medium">
                Total: {fmt(form.liters * form.pricePerLiter)}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDialog(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">Salvar</button>
            </div>
          </form>
        </SimpleDialog>
      )}
    </div>
  )
}

// MANUTENÇÃO
function ManutencaoTab() {
  const { maintenance, vehicles, addMaintenance, updateMaintenance } = useFrotaVeicularStore(
    useShallow(s => ({ maintenance: s.maintenance, vehicles: s.vehicles, addMaintenance: s.addMaintenance, updateMaintenance: s.updateMaintenance }))
  )
  const [dialog, setDialog] = useState(false)
  const [editItem, setEditItem] = useState<VehicleMaintenanceRecord | undefined>()
  const [form, setForm] = useState({ vehicleId: '', type: 'preventive' as VehicleMaintenanceType, description: '', serviceDate: '', nextServiceDate: '', nextServiceKm: 0, kmAtService: 0, cost: 0, provider: '', status: 'scheduled' as VehicleMaintenanceStatus, notes: '' })

  function getPlate(id: string) { return vehicles.find(v => v.id === id)?.plate ?? id }

  const MAINT_STATUS_COLORS: Record<VehicleMaintenanceStatus, string> = {
    scheduled:   'bg-[#3b82f6]/15 text-[#3b82f6]',
    in_progress: 'bg-[#f59e0b]/15 text-[#f59e0b]',
    completed:   'bg-[#22c55e]/15 text-[#22c55e]',
    cancelled:   'bg-[var(--color-surface)] text-[var(--color-text-muted)]',
  }
  const MAINT_STATUS_LABELS: Record<VehicleMaintenanceStatus, string> = {
    scheduled: 'Agendado', in_progress: 'Em Andamento', completed: 'Concluído', cancelled: 'Cancelado',
  }

  function openNew() { setEditItem(undefined); setForm({ vehicleId: '', type: 'preventive', description: '', serviceDate: '', nextServiceDate: '', nextServiceKm: 0, kmAtService: 0, cost: 0, provider: '', status: 'scheduled', notes: '' }); setDialog(true) }
  function openEdit(m: VehicleMaintenanceRecord) { setEditItem(m); setForm({ vehicleId: m.vehicleId, type: m.type, description: m.description, serviceDate: m.serviceDate, nextServiceDate: m.nextServiceDate ?? '', nextServiceKm: m.nextServiceKm ?? 0, kmAtService: m.kmAtService, cost: m.cost, provider: m.provider ?? '', status: m.status, notes: m.notes ?? '' }); setDialog(true) }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vehicleId || !form.description) return
    if (editItem) { updateMaintenance(editItem.id, form) }
    else { addMaintenance({ ...form, nextServiceDate: form.nextServiceDate || undefined, nextServiceKm: form.nextServiceKm || undefined }) }
    setDialog(false)
  }

  const preventive = maintenance.filter(m => m.type === 'preventive')
  const corrective = maintenance.filter(m => m.type === 'corrective')

  function MaintTable({ items, label }: { items: VehicleMaintenanceRecord[]; label: string }) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${label === 'Preventiva' ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
          <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase">{label}</h4>
          <span className="ml-auto text-xs text-[var(--color-text-muted)]">{items.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {['Placa','Descrição','Data','KM','Custo','Próxima','Status',''].map(h => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {items.length === 0
                ? <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">Sem registros</td></tr>
                : items.map(m => (
                  <tr key={m.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className={`${tdCls} font-mono font-bold text-[var(--color-text-primary)]`}>{getPlate(m.vehicleId)}</td>
                    <td className={`${tdCls} max-w-[160px] truncate`}>{m.description}</td>
                    <td className={tdCls}>{fmtDate(m.serviceDate)}</td>
                    <td className={tdCls}>{m.kmAtService.toLocaleString('pt-BR')}</td>
                    <td className={`${tdCls} font-semibold`}>{fmt(m.cost)}</td>
                    <td className={tdCls}>{m.nextServiceDate ? fmtDate(m.nextServiceDate) : m.nextServiceKm ? `${m.nextServiceKm.toLocaleString('pt-BR')} km` : '—'}</td>
                    <td className={tdCls}><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MAINT_STATUS_COLORS[m.status]}`}>{MAINT_STATUS_LABELS[m.status]}</span></td>
                    <td className={tdCls}><button onClick={() => openEdit(m)} className={`${actionBtn} bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20`}>Editar</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity">+ Nova Manutenção</button>
      </div>
      <MaintTable items={preventive} label="Preventiva" />
      <MaintTable items={corrective} label="Corretiva" />
      {dialog && (
        <SimpleDialog title={editItem ? 'Editar Manutenção' : 'Nova Manutenção'} onClose={() => setDialog(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Veículo</label>
                <select className={inputCls} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as VehicleMaintenanceType }))}>
                  <option value="preventive">Preventiva</option>
                  <option value="corrective">Corretiva</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Data</label>
                <input type="date" className={inputCls} value={form.serviceDate} onChange={e => setForm(f => ({ ...f, serviceDate: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>KM no serviço</label>
                <input type="number" min={0} className={inputCls} value={form.kmAtService} onChange={e => setForm(f => ({ ...f, kmAtService: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={labelCls}>Custo (R$)</label>
                <input type="number" min={0} step={0.01} className={inputCls} value={form.cost} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Próxima Data</label>
                <input type="date" className={inputCls} value={form.nextServiceDate} onChange={e => setForm(f => ({ ...f, nextServiceDate: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Próximo KM</label>
                <input type="number" min={0} className={inputCls} value={form.nextServiceKm} onChange={e => setForm(f => ({ ...f, nextServiceKm: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fornecedor</label>
                <input className={inputCls} value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as VehicleMaintenanceStatus }))}>
                  {(['scheduled','in_progress','completed','cancelled'] as VehicleMaintenanceStatus[]).map(s => <option key={s} value={s}>{MAINT_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDialog(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">Salvar</button>
            </div>
          </form>
        </SimpleDialog>
      )}
    </div>
  )
}

// MOTORISTAS
function MotoristasTab() {
  const { drivers, addDriver, updateDriver, removeDriver } = useFrotaVeicularStore(
    useShallow(s => ({ drivers: s.drivers, addDriver: s.addDriver, updateDriver: s.updateDriver, removeDriver: s.removeDriver }))
  )
  const [dialog, setDialog] = useState(false)
  const [editDriver, setEdit] = useState<VehicleDriver | undefined>()
  const [form, setForm] = useState({ name: '', cpfMasked: '', licenseNumber: '', licenseCategory: 'B', licenseExpiry: '', phone: '', email: '', status: 'active' as VehicleDriver['status'] })

  function daysUntil(d: string) { return Math.floor((new Date(d + 'T12:00:00').getTime() - Date.now()) / 86400000) }

  function openEdit(d: VehicleDriver) { setEdit(d); setForm({ name: d.name, cpfMasked: d.cpfMasked, licenseNumber: d.licenseNumber, licenseCategory: d.licenseCategory, licenseExpiry: d.licenseExpiry, phone: d.phone, email: d.email ?? '', status: d.status }); setDialog(true) }
  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone) return
    if (editDriver) { updateDriver(editDriver.id, form) }
    else { addDriver(form) }
    setDialog(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEdit(undefined); setForm({ name: '', cpfMasked: '', licenseNumber: '', licenseCategory: 'B', licenseExpiry: '', phone: '', email: '', status: 'active' }); setDialog(true) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity">
          + Novo Motorista
        </button>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {['Nome','CPF','CNH','Categoria','Validade CNH','Telefone','Status','Ações'].map(h => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {drivers.map(d => {
                const days   = daysUntil(d.licenseExpiry)
                const expCls = days < 0 ? 'text-[#ef4444]' : days < 30 ? 'text-[#f59e0b]' : 'text-[var(--color-text-secondary)]'
                return (
                  <tr key={d.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className={`${tdCls} font-medium text-[var(--color-text-primary)]`}>{d.name}</td>
                    <td className={tdCls}>{d.cpfMasked}</td>
                    <td className={tdCls}>{d.licenseNumber}</td>
                    <td className={`${tdCls} font-bold`}>{d.licenseCategory}</td>
                    <td className={`${tdCls} ${expCls} font-medium`}>{fmtDate(d.licenseExpiry)}{days < 30 && days >= 0 ? ` (${days}d)` : ''}</td>
                    <td className={tdCls}>{d.phone}</td>
                    <td className={tdCls}>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'active' ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#ef4444]/15 text-[#ef4444]'}`}>
                        {d.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(d)} className={`${actionBtn} bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20`}>Editar</button>
                        <button onClick={() => removeDriver(d.id)} className={`${actionBtn} bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20`}>Remover</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {dialog && (
        <SimpleDialog title={editDriver ? 'Editar Motorista' : 'Novo Motorista'} onClose={() => setDialog(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className={labelCls}>Nome</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>CPF (mascarado)</label><input className={inputCls} value={form.cpfMasked} placeholder="***.***.**-XX" onChange={e => setForm(f => ({ ...f, cpfMasked: e.target.value }))} /></div>
              <div><label className={labelCls}>Nº CNH (mascarado)</label><input className={inputCls} value={form.licenseNumber} placeholder="***.***.***-**" onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Categoria CNH</label><input className={inputCls} value={form.licenseCategory} placeholder="B, C, D, E, AB..." onChange={e => setForm(f => ({ ...f, licenseCategory: e.target.value.toUpperCase() }))} /></div>
              <div><label className={labelCls}>Validade CNH</label><input type="date" className={inputCls} value={form.licenseExpiry} onChange={e => setForm(f => ({ ...f, licenseExpiry: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Telefone</label><input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label className={labelCls}>E-mail</label><input type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDialog(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">Salvar</button>
            </div>
          </form>
        </SimpleDialog>
      )}
    </div>
  )
}

// ROTAS
function RotasTab() {
  const { routes, vehicles, drivers, addRoute } = useFrotaVeicularStore(
    useShallow(s => ({ routes: s.routes, vehicles: s.vehicles, drivers: s.drivers, addRoute: s.addRoute }))
  )
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ vehicleId: '', driverId: '', date: new Date().toISOString().split('T')[0], origin: '', destination: '', departureTime: '07:00', arrivalTime: '', startKm: 0, endKm: 0, purpose: '', status: 'planned' as RouteStatus, notes: '' })

  const ROUTE_STATUS: Record<RouteStatus, string> = {
    planned: 'Planejado', in_progress: 'Em Andamento', completed: 'Concluído', cancelled: 'Cancelado',
  }
  const ROUTE_STATUS_COLORS: Record<RouteStatus, string> = {
    planned: 'bg-[#3b82f6]/15 text-[#3b82f6]', in_progress: 'bg-[#f59e0b]/15 text-[#f59e0b]',
    completed: 'bg-[#22c55e]/15 text-[#22c55e]', cancelled: 'bg-[var(--color-surface)] text-[var(--color-text-muted)]',
  }

  function getPlate(id: string) { return vehicles.find(v => v.id === id)?.plate ?? id }
  function getDriver(id?: string) { return id ? (drivers.find(d => d.id === id)?.name ?? id) : '—' }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vehicleId || !form.origin || !form.destination) return
    addRoute({ ...form, driverId: form.driverId || undefined, arrivalTime: form.arrivalTime || undefined, endKm: form.endKm || undefined, notes: form.notes || undefined })
    setDialog(false)
  }

  const sorted = useMemo(() => [...routes].sort((a, b) => b.date.localeCompare(a.date)), [routes])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setDialog(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity">+ Registrar Rota</button>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {['Data','Placa','Motorista','Origem','Destino','Saída','Chegada','KM Perc.','Finalidade','Status'].map(h => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {sorted.length === 0
                ? <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-[var(--color-text-muted)]">Nenhuma rota registrada</td></tr>
                : sorted.map(r => {
                  const kmPerc = r.endKm && r.endKm > r.startKm ? (r.endKm - r.startKm).toLocaleString('pt-BR') + ' km' : '—'
                  return (
                    <tr key={r.id} className="hover:bg-[var(--color-surface)] transition-colors">
                      <td className={tdCls}>{fmtDate(r.date)}</td>
                      <td className={`${tdCls} font-mono font-bold text-[var(--color-text-primary)]`}>{getPlate(r.vehicleId)}</td>
                      <td className={tdCls}>{getDriver(r.driverId)}</td>
                      <td className={`${tdCls} max-w-[120px] truncate`}>{r.origin}</td>
                      <td className={`${tdCls} max-w-[120px] truncate`}>{r.destination}</td>
                      <td className={tdCls}>{r.departureTime}</td>
                      <td className={tdCls}>{r.arrivalTime ?? '—'}</td>
                      <td className={`${tdCls} font-medium`}>{kmPerc}</td>
                      <td className={`${tdCls} max-w-[120px] truncate`}>{r.purpose}</td>
                      <td className={tdCls}><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROUTE_STATUS_COLORS[r.status]}`}>{ROUTE_STATUS[r.status]}</span></td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
      {dialog && (
        <SimpleDialog title="Registrar Rota" onClose={() => setDialog(false)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Veículo</label>
                <select className={inputCls} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  <option value="">Selecione...</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Motorista</label>
                <select className={inputCls} value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                  <option value="">Sem motorista</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Data</label><input type="date" className={inputCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label className={labelCls}>Saída</label><input type="time" className={inputCls} value={form.departureTime} onChange={e => setForm(f => ({ ...f, departureTime: e.target.value }))} /></div>
              <div><label className={labelCls}>Chegada</label><input type="time" className={inputCls} value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Origem</label><input className={inputCls} value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} /></div>
              <div><label className={labelCls}>Destino</label><input className={inputCls} value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>KM Inicial</label><input type="number" min={0} className={inputCls} value={form.startKm} onChange={e => setForm(f => ({ ...f, startKm: Number(e.target.value) }))} /></div>
              <div><label className={labelCls}>KM Final</label><input type="number" min={0} className={inputCls} value={form.endKm} onChange={e => setForm(f => ({ ...f, endKm: Number(e.target.value) }))} /></div>
            </div>
            <div><label className={labelCls}>Finalidade</label><input className={inputCls} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} /></div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDialog(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">Salvar</button>
            </div>
          </form>
        </SimpleDialog>
      )}
    </div>
  )
}

// ORDENS DE SERVIÇO
function OrdensTab() {
  const { orders, vehicles, addOrder, updateOrder } = useFrotaVeicularStore(
    useShallow(s => ({ orders: s.orders, vehicles: s.vehicles, addOrder: s.addOrder, updateOrder: s.updateOrder }))
  )
  const [dialog, setDialog] = useState(false)
  const [editOS, setEditOS] = useState<VehicleServiceOrder | undefined>()
  const [form, setForm] = useState({ vehicleId: '', type: 'corrective' as VehicleMaintenanceType, description: '', requestedBy: '', scheduledDate: '', estimatedCost: 0, provider: '', status: 'open' as ServiceOrderStatus, priority: 'normal' as VehicleServiceOrder['priority'], notes: '' })

  function getPlate(id: string) { return vehicles.find(v => v.id === id)?.plate ?? id }
  const OS_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
    open: 'Aberta', in_progress: 'Em Andamento', awaiting_parts: 'Aguard. Peças', completed: 'Concluída', cancelled: 'Cancelada',
  }

  function openNew() { setEditOS(undefined); setForm({ vehicleId: '', type: 'corrective', description: '', requestedBy: '', scheduledDate: '', estimatedCost: 0, provider: '', status: 'open', priority: 'normal', notes: '' }); setDialog(true) }
  function openEdit(o: VehicleServiceOrder) { setEditOS(o); setForm({ vehicleId: o.vehicleId, type: o.type, description: o.description, requestedBy: o.requestedBy, scheduledDate: o.scheduledDate ?? '', estimatedCost: o.estimatedCost ?? 0, provider: o.provider ?? '', status: o.status, priority: o.priority, notes: o.notes ?? '' }); setDialog(true) }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vehicleId || !form.description) return
    if (editOS) { updateOrder(editOS.id, form) } else { addOrder({ ...form, requestedAt: new Date().toISOString() }) }
    setDialog(false)
  }

  // Pipeline counts
  const pipeline = (['open','in_progress','awaiting_parts','completed'] as ServiceOrderStatus[]).map(s => ({
    status: s, label: OS_STATUS_LABELS[s], count: orders.filter(o => o.status === s).length,
  }))

  return (
    <div className="space-y-4">
      {/* Pipeline header */}
      <div className="grid grid-cols-4 gap-3">
        {pipeline.map(p => (
          <div key={p.status} className={`rounded-xl border px-3 py-2 text-center text-xs font-medium ${OS_STATUS_COLORS[p.status]} border-current/20`}>
            <div className="text-lg font-bold">{p.count}</div>
            <div>{p.label}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity">+ Nova OS</button>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {['OS','Placa','Tipo','Prioridade','Descrição','Custo Est.','Fornecedor','Status','Ações'].map(h => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {orders.length === 0
                ? <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-[var(--color-text-muted)]">Nenhuma OS registrada</td></tr>
                : orders.map(o => (
                  <tr key={o.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className={`${tdCls} font-mono font-bold text-[var(--color-text-primary)]`}>{o.code}</td>
                    <td className={`${tdCls} font-mono`}>{getPlate(o.vehicleId)}</td>
                    <td className={tdCls}>{o.type === 'preventive' ? 'Prev.' : 'Corret.'}</td>
                    <td className={`${tdCls} font-semibold ${PRIORITY_COLORS[o.priority]}`}>{o.priority.charAt(0).toUpperCase() + o.priority.slice(1)}</td>
                    <td className={`${tdCls} max-w-[160px] truncate`}>{o.description}</td>
                    <td className={tdCls}>{o.estimatedCost ? fmt(o.estimatedCost) : '—'}</td>
                    <td className={`${tdCls} max-w-[100px] truncate`}>{o.provider ?? '—'}</td>
                    <td className={tdCls}><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${OS_STATUS_COLORS[o.status]}`}>{OS_STATUS_LABELS[o.status]}</span></td>
                    <td className={tdCls}><button onClick={() => openEdit(o)} className={`${actionBtn} bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20`}>Editar</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {dialog && (
        <SimpleDialog title={editOS ? 'Editar OS' : 'Nova Ordem de Serviço'} onClose={() => setDialog(false)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Veículo</label>
                <select className={inputCls} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  <option value="">Selecione...</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Tipo</label>
                <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as VehicleMaintenanceType }))}>
                  <option value="preventive">Preventiva</option><option value="corrective">Corretiva</option>
                </select>
              </div>
            </div>
            <div><label className={labelCls}>Descrição</label><textarea className={`${inputCls} resize-none`} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Prioridade</label>
                <select className={inputCls} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as typeof form.priority }))}>
                  {['urgent','high','normal','low'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Status</label>
                <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ServiceOrderStatus }))}>
                  {(['open','in_progress','awaiting_parts','completed','cancelled'] as ServiceOrderStatus[]).map(s => <option key={s} value={s}>{OS_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Custo Est.</label><input type="number" min={0} step={0.01} className={inputCls} value={form.estimatedCost} onChange={e => setForm(f => ({ ...f, estimatedCost: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Solicitante</label><input className={inputCls} value={form.requestedBy} onChange={e => setForm(f => ({ ...f, requestedBy: e.target.value }))} /></div>
              <div><label className={labelCls}>Fornecedor</label><input className={inputCls} value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDialog(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">Salvar</button>
            </div>
          </form>
        </SimpleDialog>
      )}
    </div>
  )
}

// MULTAS
function MultasTab() {
  const { fines, vehicles, drivers, addFine, updateFine } = useFrotaVeicularStore(
    useShallow(s => ({ fines: s.fines, vehicles: s.vehicles, drivers: s.drivers, addFine: s.addFine, updateFine: s.updateFine }))
  )
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ vehicleId: '', driverId: '', date: new Date().toISOString().split('T')[0], description: '', infraction: '', points: 0, amount: 0, dueDate: '', status: 'pending' as FineStatus, autoNumber: '', notes: '' })

  function getPlate(id: string) { return vehicles.find(v => v.id === id)?.plate ?? id }
  function getDriver(id?: string) { return id ? (drivers.find(d => d.id === id)?.name ?? '—') : '—' }
  const FINE_LABELS: Record<FineStatus, string> = { pending: 'Pendente', paid: 'Paga', contested: 'Contestada' }

  const pendingTotal = fines.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vehicleId || !form.description || form.amount <= 0) return
    addFine({ ...form, driverId: form.driverId || undefined, points: form.points || undefined })
    setDialog(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {pendingTotal > 0 && (
          <div className="px-3 py-2 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 text-xs font-medium text-[#ef4444]">
            Total pendente: <strong>{fmt(pendingTotal)}</strong>
          </div>
        )}
        <div className="ml-auto">
          <button onClick={() => setDialog(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity">+ Registrar Multa</button>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {['Data','Placa','Motorista','Infração','Pontos','Valor','Vencimento','Status','Ações'].map(h => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {fines.length === 0
                ? <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-[var(--color-text-muted)]">Nenhuma multa registrada</td></tr>
                : fines.map(f => (
                  <tr key={f.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className={tdCls}>{fmtDate(f.date)}</td>
                    <td className={`${tdCls} font-mono font-bold text-[var(--color-text-primary)]`}>{getPlate(f.vehicleId)}</td>
                    <td className={tdCls}>{getDriver(f.driverId)}</td>
                    <td className={`${tdCls} max-w-[160px] truncate`}>{f.infraction}</td>
                    <td className={tdCls}>{f.points ?? '—'}</td>
                    <td className={`${tdCls} font-semibold text-[#ef4444]`}>{fmt(f.amount)}</td>
                    <td className={tdCls}>{fmtDate(f.dueDate)}</td>
                    <td className={tdCls}><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FINE_STATUS_COLORS[f.status]}`}>{FINE_LABELS[f.status]}</span></td>
                    <td className={tdCls}>
                      <div className="flex gap-1.5">
                        {f.status === 'pending' && (
                          <button onClick={() => updateFine(f.id, { status: 'paid' })} className={`${actionBtn} bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20`}>Pagar</button>
                        )}
                        {f.status === 'pending' && (
                          <button onClick={() => updateFine(f.id, { status: 'contested' })} className={`${actionBtn} bg-[#8b5cf6]/10 text-[#8b5cf6] hover:bg-[#8b5cf6]/20`}>Contestar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {dialog && (
        <SimpleDialog title="Registrar Multa" onClose={() => setDialog(false)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Veículo</label>
                <select className={inputCls} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  <option value="">Selecione...</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Motorista</label>
                <select className={inputCls} value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                  <option value="">Sem motorista</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className={labelCls}>Infração (Artigo)</label><input className={inputCls} value={form.infraction} onChange={e => setForm(f => ({ ...f, infraction: e.target.value }))} /></div>
            <div><label className={labelCls}>Descrição</label><input className={inputCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Data</label><input type="date" className={inputCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label className={labelCls}>Valor (R$)</label><input type="number" min={0} step={0.01} className={inputCls} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /></div>
              <div><label className={labelCls}>Vencimento</label><input type="date" className={inputCls} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Pontos</label><input type="number" min={0} max={20} className={inputCls} value={form.points} onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))} /></div>
              <div><label className={labelCls}>Nº Auto</label><input className={inputCls} value={form.autoNumber} onChange={e => setForm(f => ({ ...f, autoNumber: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDialog(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">Salvar</button>
            </div>
          </form>
        </SimpleDialog>
      )}
    </div>
  )
}

// CUSTOS
function CustosTab() {
  const { fuelRecords, maintenance, fines } = useFrotaVeicularStore(
    useShallow(s => ({ fuelRecords: s.fuelRecords, maintenance: s.maintenance, fines: s.fines }))
  )
  const { vehicles } = useFrotaVeicularStore(useShallow(s => ({ vehicles: s.vehicles })))

  // Monthly breakdown for last 6 months
  const months = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  const monthlyCosts = useMemo(() => months.map(m => ({
    month: m,
    fuel:        fuelRecords.filter(r => r.date.startsWith(m)).reduce((s, r) => s + r.totalCost, 0),
    maintenance: maintenance.filter(r => r.serviceDate.startsWith(m) && r.status === 'completed').reduce((s, r) => s + r.cost, 0),
    fines:       fines.filter(r => r.date.startsWith(m)).reduce((s, r) => s + r.amount, 0),
  })), [months, fuelRecords, maintenance, fines])

  // Cost per vehicle
  const byVehicle = useMemo(() => {
    return vehicles.map(v => ({
      vehicle: v,
      fuel:  fuelRecords.filter(r => r.vehicleId === v.id).reduce((s, r) => s + r.totalCost, 0),
      maint: maintenance.filter(r => r.vehicleId === v.id).reduce((s, r) => s + r.cost, 0),
      fines: fines.filter(r => r.vehicleId === v.id).reduce((s, r) => s + r.amount, 0),
    })).map(v => ({ ...v, total: v.fuel + v.maint + v.fines }))
      .sort((a, b) => b.total - a.total)
  }, [vehicles, fuelRecords, maintenance, fines])

  const maxBar = Math.max(...monthlyCosts.map(m => m.fuel + m.maintenance + m.fines), 1)

  return (
    <div className="space-y-5">
      {/* Monthly stacked bar chart */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">Custo Mensal (6 meses)</h3>
        <div className="flex items-end gap-3 h-32">
          {monthlyCosts.map(m => {
            const total = m.fuel + m.maintenance + m.fines
            const h     = total > 0 ? (total / maxBar) * 100 : 2
            const mLabel = new Date(m.month + '-15').toLocaleDateString('pt-BR', { month: 'short' })
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end rounded-t-lg overflow-hidden" style={{ height: `${h}%`, minHeight: 4 }}>
                  <div className="w-full bg-[#ef4444]" style={{ height: `${m.fines / (total || 1) * 100}%` }} />
                  <div className="w-full bg-[#f59e0b]" style={{ height: `${m.maintenance / (total || 1) * 100}%` }} />
                  <div className="w-full bg-[#3b82f6]" style={{ height: `${m.fuel / (total || 1) * 100}%` }} />
                </div>
                <span className="text-[9px] text-[var(--color-text-muted)] capitalize">{mLabel}</span>
                {total > 0 && <span className="text-[9px] font-semibold text-[var(--color-text-secondary)]">R${Math.round(total/1000)}k</span>}
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3">
          {[['bg-[#3b82f6]','Combustível'],['bg-[#f59e0b]','Manutenção'],['bg-[#ef4444]','Multas']].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <span className={`w-3 h-3 rounded-sm ${c}`} />{l}
            </div>
          ))}
        </div>
      </div>

      {/* Vehicle ranking */}
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Custo Total por Veículo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {['#','Placa','Veículo','Combustível','Manutenção','Multas','Total'].map(h => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {byVehicle.map((row, i) => (
                <tr key={row.vehicle.id} className="hover:bg-[var(--color-surface)] transition-colors">
                  <td className={`${tdCls} text-center font-bold text-[var(--color-text-muted)]`}>{i + 1}</td>
                  <td className={`${tdCls} font-mono font-bold text-[var(--color-text-primary)]`}>{row.vehicle.plate}</td>
                  <td className={tdCls}>{row.vehicle.make} {row.vehicle.model}</td>
                  <td className={`${tdCls} text-[#3b82f6]`}>{fmt(row.fuel)}</td>
                  <td className={`${tdCls} text-[#f59e0b]`}>{fmt(row.maint)}</td>
                  <td className={`${tdCls} text-[#ef4444]`}>{fmt(row.fines)}</td>
                  <td className={`${tdCls} font-bold text-[var(--color-text-primary)]`}>{fmt(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// AGENDAMENTO
function AgendamentoTab() {
  const { schedules, vehicles, drivers, addSchedule } = useFrotaVeicularStore(
    useShallow(s => ({ schedules: s.schedules, vehicles: s.vehicles, drivers: s.drivers, addSchedule: s.addSchedule }))
  )
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ vehicleId: '', type: 'maintenance' as FleetScheduleEntry['type'], title: '', scheduledDate: '', driverId: '', notes: '', status: 'scheduled' as FleetScheduleEntry['status'] })
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDates = useMemo(() => {
    const base = new Date()
    base.setDate(base.getDate() + weekOffset * 7)
    const monday = new Date(base)
    const day = monday.getDay()
    monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  }, [weekOffset])

  const TYPE_LABELS: Record<FleetScheduleEntry['type'], string> = { maintenance: 'Manutenção', inspection: 'Inspeção', route: 'Rota' }
  const TYPE_COLORS: Record<FleetScheduleEntry['type'], string> = { maintenance: 'bg-[#f59e0b]/15 text-[#f59e0b]', inspection: 'bg-[#3b82f6]/15 text-[#3b82f6]', route: 'bg-[#22c55e]/15 text-[#22c55e]' }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vehicleId || !form.title || !form.scheduledDate) return
    addSchedule({ ...form, driverId: form.driverId || undefined, notes: form.notes || undefined })
    setDialog(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors">‹</button>
          <span className="text-xs text-[var(--color-text-secondary)] min-w-[160px] text-center">
            {new Date(weekDates[0] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {new Date(weekDates[6] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors">›</button>
        </div>
        <button onClick={() => setDialog(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity">+ Novo Agendamento</button>
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <th className={`${thCls} sticky left-0 bg-[var(--color-surface)] z-10 min-w-[100px]`}>Veículo</th>
                {weekDates.map(d => {
                  const dow = new Date(d + 'T12:00:00').getDay()
                  return <th key={d} className={`${thCls} text-center min-w-[100px] ${dow === 0 ? 'text-[#ef4444]/70' : ''}`}>{new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}</th>
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {vehicles.map(v => (
                <tr key={v.id} className="hover:bg-[var(--color-surface)]/50 transition-colors">
                  <td className="sticky left-0 z-10 bg-[var(--color-surface-elevated)] px-3 py-2 font-mono font-bold text-[var(--color-text-primary)]">{v.plate}</td>
                  {weekDates.map(date => {
                    const dayEvents = schedules.filter(s => s.vehicleId === v.id && s.scheduledDate === date)
                    return (
                      <td key={date} className="px-2 py-2 align-top min-h-[60px]">
                        {dayEvents.map(ev => (
                          <div key={ev.id} className={`rounded-md px-2 py-1 mb-1 text-[10px] font-medium ${TYPE_COLORS[ev.type]}`}>
                            {ev.title.length > 16 ? ev.title.slice(0, 15) + '…' : ev.title}
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {dialog && (
        <SimpleDialog title="Novo Agendamento" onClose={() => setDialog(false)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Veículo</label>
                <select className={inputCls} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  <option value="">Selecione...</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Tipo</label>
                <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as FleetScheduleEntry['type'] }))}>
                  {(Object.entries(TYPE_LABELS)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div><label className={labelCls}>Título</label><input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Data</label><input type="date" className={inputCls} value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} /></div>
              <div><label className={labelCls}>Motorista</label>
                <select className={inputCls} value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                  <option value="">Sem motorista</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className={labelCls}>Observações</label><textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDialog(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">Salvar</button>
            </div>
          </form>
        </SimpleDialog>
      )}
    </div>
  )
}

// ALERTAS
function AlertasTab() {
  const { alerts, vehicles, dismissAlert } = useFrotaVeicularStore(
    useShallow(s => ({ alerts: s.alerts, vehicles: s.vehicles, dismissAlert: s.dismissAlert }))
  )
  function getPlate(id: string) { return vehicles.find(v => v.id === id)?.plate ?? id }
  const active = alerts.filter(a => a.isActive)
  const SEVERITY_LABELS: Record<string, string> = { critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {(['critical','high','medium','low'] as const).map(sev => (
          <div key={sev} className={`rounded-xl border px-3 py-2 text-center text-xs font-medium ${ALERT_COLORS[sev]}`}>
            <div className="text-lg font-bold">{active.filter(a => a.severity === sev).length}</div>
            <div>{SEVERITY_LABELS[sev]}</div>
          </div>
        ))}
      </div>
      {active.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-[var(--color-text-muted)]">
          <div className="text-3xl mb-2">✓</div>
          <p className="text-sm">Nenhum alerta ativo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3 }
            return order[a.severity as keyof typeof order] - order[b.severity as keyof typeof order]
          }).map(alert => (
            <div key={alert.id} className={`rounded-2xl border p-4 ${ALERT_COLORS[alert.severity]}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold opacity-70">{getPlate(alert.vehicleId)}</span>
                    <span className="text-xs font-bold uppercase">{SEVERITY_LABELS[alert.severity]}</span>
                  </div>
                  <div className="font-semibold text-sm mb-1">{alert.title}</div>
                  <div className="text-xs opacity-80">{alert.description}</div>
                </div>
                <button onClick={() => dismissAlert(alert.id)}
                  className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-white/20 hover:bg-white/30 transition-colors">
                  Dispensar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// INSIGHTS
function InsightsTab() {
  const { vehicles, fuelRecords, routes, orders, alerts } = useFrotaVeicularStore(
    useShallow(s => ({ vehicles: s.vehicles, fuelRecords: s.fuelRecords, routes: s.routes, orders: s.orders, alerts: s.alerts }))
  )

  const activeVehicles = vehicles.filter(v => v.status === 'active').length
  const fleetAvail     = vehicles.length > 0 ? ((activeVehicles / vehicles.length) * 100).toFixed(1) : '0.0'

  const fullTankFills = fuelRecords.filter(r => r.fullTank)
  let totalKmL = 0, kmLCount = 0
  const byVeh: Record<string, FuelRecord[]> = {}
  for (const r of [...fullTankFills].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!byVeh[r.vehicleId]) byVeh[r.vehicleId] = []
    byVeh[r.vehicleId].push(r)
  }
  for (const recs of Object.values(byVeh)) {
    for (let i = 1; i < recs.length; i++) {
      const km = recs[i].kmAtFill - recs[i-1].kmAtFill
      const lt = recs[i-1].liters
      if (km > 0 && lt > 0) { totalKmL += km / lt; kmLCount++ }
    }
  }
  const avgKmL = kmLCount > 0 ? (totalKmL / kmLCount).toFixed(2) : '—'

  const totalRouteKm = routes.filter(r => r.status === 'completed' && r.endKm && r.endKm > r.startKm).reduce((s, r) => s + (r.endKm! - r.startKm), 0)
  const totalFuelCost = fuelRecords.reduce((s, r) => s + r.totalCost, 0)
  const costPerKm = totalRouteKm > 0 ? (totalFuelCost / totalRouteKm).toFixed(2) : '—'

  const openOS = orders.filter(o => o.status === 'open' || o.status === 'in_progress').length
  const activeAlerts = alerts.filter(a => a.isActive && (a.severity === 'critical' || a.severity === 'high')).length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Disponibilidade', value: `${fleetAvail}%`, color: parseFloat(fleetAvail) >= 80 ? 'text-[#22c55e]' : 'text-[#f59e0b]' },
          { label: 'Média km/L',      value: avgKmL,           color: 'text-[#3b82f6]' },
          { label: 'Custo/km',        value: costPerKm !== '—' ? `R$ ${costPerKm}` : '—', color: 'text-[var(--color-text-primary)]' },
          { label: 'OS em Aberto',    value: openOS,           color: openOS > 0 ? 'text-[#f59e0b]' : 'text-[#22c55e]' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-3 px-2 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
            <span className={`text-xl font-bold ${k.color}`}>{k.value}</span>
            <span className="text-xs text-[var(--color-text-muted)] text-center mt-0.5">{k.label}</span>
          </div>
        ))}
      </div>
      {activeAlerts > 0 && (
        <div className="px-4 py-3 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/30 text-sm text-[#ef4444] font-medium">
          ⚠ {activeAlerts} alerta{activeAlerts > 1 ? 's' : ''} crítico{activeAlerts > 1 ? 's' : ''} ativo{activeAlerts > 1 ? 's' : ''} — verifique a aba Alertas
        </div>
      )}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Utilização dos Veículos</h3>
        {vehicles.map(v => {
          const vRoutes = routes.filter(r => r.vehicleId === v.id && r.status === 'completed')
          const vKm     = vRoutes.reduce((s, r) => s + (r.endKm && r.endKm > r.startKm ? r.endKm - r.startKm : 0), 0)
          const maxKm   = Math.max(...vehicles.map(vv => routes.filter(r => r.vehicleId === vv.id && r.status === 'completed').reduce((s, r) => s + (r.endKm && r.endKm > r.startKm ? r.endKm - r.startKm : 0), 0)), 1)
          const pct     = (vKm / maxKm) * 100
          return (
            <div key={v.id} className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] w-20 shrink-0">{v.plate}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-accent)] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-[var(--color-text-muted)] w-20 text-right">{vKm.toLocaleString('pt-BR')} km</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// RELATÓRIOS
function RelatoriosTab() {
  const { vehicles, fuelRecords, maintenance, fines } = useFrotaVeicularStore(
    useShallow(s => ({ vehicles: s.vehicles, fuelRecords: s.fuelRecords, maintenance: s.maintenance, fines: s.fines }))
  )
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [startDate, setStart] = useState('')
  const [endDate,   setEnd]   = useState('')
  const [type, setType]       = useState<'fuel' | 'maintenance' | 'fines' | 'full'>('full')

  function inRange(date: string) {
    if (startDate && date < startDate) return false
    if (endDate   && date > endDate)   return false
    return true
  }
  function forVeh(id: string) { return vehicleFilter === 'all' || id === vehicleFilter }

  function handleGenerate() {
    let rows: string[] = []
    const headers: Record<string, string[]> = {
      fuel:        ['Data','Placa','Litros','R$/L','Total','KM','Posto'],
      maintenance: ['Data','Placa','Tipo','Descrição','KM','Custo','Fornecedor','Status'],
      fines:       ['Data','Placa','Infração','Valor','Vencimento','Status'],
      full:        ['Tipo','Data','Placa','Descrição','Valor'],
    }

    if (type === 'fuel' || type === 'full') {
      const filtered = fuelRecords.filter(r => forVeh(r.vehicleId) && inRange(r.date))
      if (type === 'full') {
        rows.push(...filtered.map(r => [
          safeCsvCell('Combustível'), safeCsvCell(r.date), safeCsvCell(vehicles.find(v => v.id === r.vehicleId)?.plate ?? r.vehicleId),
          safeCsvCell(`${r.liters}L @ R$${r.pricePerLiter}/L`), safeCsvCell(r.totalCost),
        ].join(',')))
      } else {
        rows = filtered.map(r => [
          safeCsvCell(r.date), safeCsvCell(vehicles.find(v => v.id === r.vehicleId)?.plate ?? ''), safeCsvCell(r.liters),
          safeCsvCell(r.pricePerLiter), safeCsvCell(r.totalCost), safeCsvCell(r.kmAtFill), safeCsvCell(r.station ?? ''),
        ].join(','))
      }
    }
    if (type === 'maintenance' || type === 'full') {
      const filtered = maintenance.filter(r => forVeh(r.vehicleId) && inRange(r.serviceDate))
      if (type === 'full') {
        rows.push(...filtered.map(r => [
          safeCsvCell('Manutenção'), safeCsvCell(r.serviceDate), safeCsvCell(vehicles.find(v => v.id === r.vehicleId)?.plate ?? ''),
          safeCsvCell(r.description), safeCsvCell(r.cost),
        ].join(',')))
      } else {
        rows = [...rows, ...filtered.map(r => [
          safeCsvCell(r.serviceDate), safeCsvCell(vehicles.find(v => v.id === r.vehicleId)?.plate ?? ''),
          safeCsvCell(r.type === 'preventive' ? 'Preventiva' : 'Corretiva'), safeCsvCell(r.description),
          safeCsvCell(r.kmAtService), safeCsvCell(r.cost), safeCsvCell(r.provider ?? ''), safeCsvCell(r.status),
        ].join(','))]
      }
    }
    if (type === 'fines' || type === 'full') {
      const filtered = fines.filter(r => forVeh(r.vehicleId) && inRange(r.date))
      if (type === 'full') {
        rows.push(...filtered.map(r => [
          safeCsvCell('Multa'), safeCsvCell(r.date), safeCsvCell(vehicles.find(v => v.id === r.vehicleId)?.plate ?? ''),
          safeCsvCell(r.infraction), safeCsvCell(r.amount),
        ].join(',')))
      } else {
        rows = [...rows, ...filtered.map(r => [
          safeCsvCell(r.date), safeCsvCell(vehicles.find(v => v.id === r.vehicleId)?.plate ?? ''),
          safeCsvCell(r.infraction), safeCsvCell(r.amount), safeCsvCell(r.dueDate), safeCsvCell(r.status),
        ].join(','))]
      }
    }

    const hdr  = headers[type].map(safeCsvCell).join(',')
    const csv  = [hdr, ...rows].join('\n')
    const vLabel = vehicleFilter === 'all' ? 'todos' : (vehicles.find(v => v.id === vehicleFilter)?.plate ?? vehicleFilter)
    downloadCSV(csv, `relatorio-frotas-${type}-${vLabel}-${new Date().toISOString().split('T')[0]}.csv`)
  }

  const TYPE_LABELS: Record<typeof type, string> = { fuel: 'Combustível', maintenance: 'Manutenção', fines: 'Multas', full: 'Completo' }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">Gerar Relatório</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Veículo</label>
            <select className={inputCls} value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}>
              <option value="all">Todos</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data Inicial</label>
            <input type="date" className={inputCls} value={startDate} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Data Final</label>
            <input type="date" className={inputCls} value={endDate} onChange={e => setEnd(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tipo de Relatório</label>
            <select className={inputCls} value={type} onChange={e => setType(e.target.value as typeof type)}>
              {(Object.entries(TYPE_LABELS)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleGenerate}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-sm">
            Exportar CSV
          </button>
        </div>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] text-center">
        O relatório CSV é gerado localmente — nenhum dado é enviado para servidores externos.
      </p>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type FleetSubTab = 'veiculos' | 'abastecimento' | 'manutencao' | 'rotas' | 'motoristas' | 'ordens' | 'multas' | 'custos' | 'agendamento' | 'alertas' | 'insights' | 'relatorios'

const FLEET_TABS: Array<{ id: FleetSubTab; label: string }> = [
  { id: 'veiculos',      label: 'Veículos'         },
  { id: 'abastecimento', label: 'Abastecimento'     },
  { id: 'manutencao',    label: 'Manutenção'        },
  { id: 'rotas',         label: 'Rotas'             },
  { id: 'motoristas',    label: 'Motoristas'        },
  { id: 'ordens',        label: 'Ordens de Serviço' },
  { id: 'multas',        label: 'Multas'            },
  { id: 'custos',        label: 'Custos'            },
  { id: 'agendamento',   label: 'Agendamento'       },
  { id: 'alertas',       label: 'Alertas'           },
  { id: 'insights',      label: 'Insights'          },
  { id: 'relatorios',    label: 'Relatórios'        },
]

export function GestaoFrotasPanel() {
  const [activeTab, setActiveTab] = useState<FleetSubTab>('veiculos')

  const { alerts } = useFrotaVeicularStore(useShallow(s => ({ alerts: s.alerts })))
  const alertCount = alerts.filter(a => a.isActive && (a.severity === 'critical' || a.severity === 'high')).length

  const content: Record<FleetSubTab, React.ReactNode> = {
    veiculos:      <VeiculosTab />,
    abastecimento: <AbastecimentoTab />,
    manutencao:    <ManutencaoTab />,
    rotas:         <RotasTab />,
    motoristas:    <MotoristasTab />,
    ordens:        <OrdensTab />,
    multas:        <MultasTab />,
    custos:        <CustosTab />,
    agendamento:   <AgendamentoTab />,
    alertas:       <AlertasTab />,
    insights:      <InsightsTab />,
    relatorios:    <RelatoriosTab />,
  }

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex overflow-x-auto gap-1 p-1 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] scrollbar-hide">
        {FLEET_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[var(--color-accent)] text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]'
            }`}>
            {tab.label}
            {tab.id === 'alertas' && alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] text-white text-[9px] font-bold flex items-center justify-center">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {content[activeTab]}
    </div>
  )
}
