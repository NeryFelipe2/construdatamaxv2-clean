/**
 * HistoricoPanel — list of all RDOs with search, date filter,
 * expandable detail view, print layout, and delete confirmation.
 */
import { useState, useMemo } from 'react'
import {
  Search, Printer, Trash2, ChevronDown, ChevronRight,
  Cloud, CloudRain, Sun, Zap, Camera, MapPin, Edit3, X,
} from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import { printRdoPDF, printRdosBatchPDF } from '../utils/rdoPdfExport'
import type { RDO, RdoWeatherCondition } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function weatherIcon(cond: RdoWeatherCondition) {
  switch (cond) {
    case 'good':   return <Sun size={14} className="text-yellow-400" />
    case 'cloudy': return <Cloud size={14} className="text-gray-400" />
    case 'rain':   return <CloudRain size={14} className="text-blue-400" />
    case 'storm':  return <Zap size={14} className="text-purple-400" />
  }
}

function weatherLabel(cond: RdoWeatherCondition) {
  const map: Record<RdoWeatherCondition, string> = {
    good: 'Bom', cloudy: 'Nublado', rain: 'Chuva', storm: 'Tempestade',
  }
  return map[cond]
}

function statusBadge(status: string) {
  if (status === 'completed')   return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900/50 text-emerald-300">Concluído</span>
  if (status === 'in_progress') return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-900/50 text-yellow-300">Em Execução</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-400">Não Iniciado</span>
}

// ─── Print layout (hidden on screen, visible when printing) ──────────────────

function PrintLayout({ rdo }: { rdo: RDO }) {
  const totalWorkers = rdo.manpower.foremanCount + rdo.manpower.officialCount
    + rdo.manpower.helperCount + rdo.manpower.operatorCount
  const totalMeters = rdo.trechos.reduce((s, t) => s + t.executedMeters, 0)

  return (
    <div className="hidden print:block print:text-black print:bg-white p-8 font-sans text-sm">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">RDO #{rdo.number}</h1>
          <p className="text-gray-600 mt-1">Relatório Diário de Obras</p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>Data: {fmtDate(rdo.date)}</p>
          <p>Responsável: {rdo.responsible}</p>
          {rdo.geolocation && (
            <p>GPS: {rdo.geolocation.lat}, {rdo.geolocation.lng}</p>
          )}
        </div>
      </div>

      {/* Climate */}
      <div className="mb-4">
        <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Condições Climáticas</h2>
        <div className="flex gap-6 text-sm">
          <span>Manhã: {weatherLabel(rdo.weather.morning)}</span>
          <span>Tarde: {weatherLabel(rdo.weather.afternoon)}</span>
          <span>Noite: {weatherLabel(rdo.weather.night)}</span>
          <span>Temperatura: {rdo.weather.temperatureC}°C</span>
        </div>
      </div>

      {/* Manpower */}
      <div className="mb-4">
        <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Mão de Obra</h2>
        <div className="flex gap-6 text-sm">
          <span>Encarregados: {rdo.manpower.foremanCount}</span>
          <span>Oficiais: {rdo.manpower.officialCount}</span>
          <span>Ajudantes: {rdo.manpower.helperCount}</span>
          <span>Operadores: {rdo.manpower.operatorCount}</span>
          <span className="font-medium">Total: {totalWorkers}</span>
        </div>
      </div>

      {/* Equipment */}
      {rdo.equipment.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Equipamentos</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-1 text-left">Equipamento</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Qtd</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Horas</th>
              </tr>
            </thead>
            <tbody>
              {rdo.equipment.map((e) => (
                <tr key={e.id}>
                  <td className="border border-gray-300 px-3 py-1">{e.name}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{e.quantity}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{e.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Services */}
      {rdo.services.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Serviços Executados</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-1 text-left">Descrição</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Quantidade</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {rdo.services.map((s) => (
                <tr key={s.id}>
                  <td className="border border-gray-300 px-3 py-1">{s.description}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{s.quantity}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{s.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trechos */}
      {rdo.trechos.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">
            Avanço por Trecho — Total: {totalMeters.toFixed(2)} m
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-1 text-left">Código</th>
                <th className="border border-gray-300 px-3 py-1 text-left">Descrição</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Planejado (m)</th>
                <th className="border border-gray-300 px-3 py-1 text-right">Executado (m)</th>
                <th className="border border-gray-300 px-3 py-1 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rdo.trechos.map((t) => (
                <tr key={t.id}>
                  <td className="border border-gray-300 px-3 py-1">{t.trechoCode}</td>
                  <td className="border border-gray-300 px-3 py-1">{t.trechoDescription}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{t.plannedMeters.toFixed(2)}</td>
                  <td className="border border-gray-300 px-3 py-1 text-right">{t.executedMeters.toFixed(2)}</td>
                  <td className="border border-gray-300 px-3 py-1 text-center">
                    {t.status === 'completed' ? 'Concluído' : t.status === 'in_progress' ? 'Em Execução' : 'Não Iniciado'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Observations */}
      {rdo.observations && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Observações Gerais</h2>
          <p className="text-sm whitespace-pre-wrap">{rdo.observations}</p>
        </div>
      )}
      {rdo.incidents && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">Ocorrências / Incidentes</h2>
          <p className="text-sm whitespace-pre-wrap">{rdo.incidents}</p>
        </div>
      )}

      {/* Photos */}
      {rdo.photos.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold text-base border-b border-gray-300 pb-1 mb-2">
            Registro Fotográfico ({rdo.photos.length})
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {rdo.photos.map((p) => (
              <div key={p.id}>
                <img src={p.base64} alt={p.label} className="w-full h-32 object-cover border border-gray-300 rounded" />
                {p.label && <p className="text-xs text-gray-600 mt-0.5 text-center">{p.label}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-gray-300 pt-3 text-xs text-gray-500 flex justify-between">
        <span>Gerado em: {new Date().toLocaleString('pt-BR')}</span>
        <span>ConstruData Palantir</span>
      </div>
    </div>
  )
}

// ─── RDO Card ─────────────────────────────────────────────────────────────────

function RdoCard({ rdo, onDelete, onEdit }: { rdo: RDO; onDelete: () => void; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const totalWorkers = rdo.manpower.foremanCount + rdo.manpower.officialCount
    + rdo.manpower.helperCount + rdo.manpower.operatorCount
  const totalMeters = rdo.trechos.reduce((s, t) => s + t.executedMeters, 0)

  function handlePrint() {
    printRdoPDF(rdo)
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Print layout injected at page level but scoped to this RDO — shows only when printing */}
      <PrintLayout rdo={rdo} />

      {/* Card header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-white font-semibold">RDO #{rdo.number}</span>
            <span className="text-gray-400 text-sm">{fmtDate(rdo.date)}</span>
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              {weatherIcon(rdo.weather.morning)}
              <span>{weatherLabel(rdo.weather.morning)}</span>
              <span className="mx-1 text-gray-600">·</span>
              <span>{rdo.weather.temperatureC}°C</span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-1 text-gray-400 text-sm flex-wrap">
            <span>{rdo.responsible}</span>
            <span className="text-gray-600">·</span>
            <span>{rdo.trechos.length} trecho{rdo.trechos.length !== 1 ? 's' : ''}</span>
            <span className="text-gray-600">·</span>
            <span>{totalMeters.toFixed(1)} m executados</span>
            <span className="text-gray-600">·</span>
            <span>{totalWorkers} trabalhadores</span>
            {rdo.photos.length > 0 && (
              <>
                <span className="text-gray-600">·</span>
                <span className="flex items-center gap-1">
                  <Camera size={12} />
                  {rdo.photos.length}
                </span>
              </>
            )}
            {rdo.geolocation && (
              <>
                <span className="text-gray-600">·</span>
                <MapPin size={12} className="text-sky-400" />
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs transition-colors"
            title="Editar RDO"
          >
            <Edit3 size={13} />
            Editar
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs transition-colors"
            title="Imprimir RDO"
          >
            <Printer size={13} />
            Imprimir
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-colors"
            title="Excluir RDO"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-700 space-y-5 pt-4">

          {/* Climate row */}
          <div>
            <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wide mb-2">Condições Climáticas</h3>
            <div className="flex gap-5 text-sm text-gray-300 flex-wrap">
              {(['morning', 'afternoon', 'night'] as const).map((p) => {
                const labels = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' }
                return (
                  <div key={p} className="flex items-center gap-1.5">
                    {weatherIcon(rdo.weather[p])}
                    <span className="text-gray-500">{labels[p]}:</span>
                    <span>{weatherLabel(rdo.weather[p])}</span>
                  </div>
                )
              })}
              <span className="text-gray-400">{rdo.weather.temperatureC}°C</span>
            </div>
          </div>

          {/* Manpower */}
          <div>
            <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wide mb-2">Mão de Obra</h3>
            <div className="flex gap-5 text-sm text-gray-300 flex-wrap">
              <span>Encarregados: <strong>{rdo.manpower.foremanCount}</strong></span>
              <span>Oficiais: <strong>{rdo.manpower.officialCount}</strong></span>
              <span>Ajudantes: <strong>{rdo.manpower.helperCount}</strong></span>
              <span>Operadores: <strong>{rdo.manpower.operatorCount}</strong></span>
              <span className="text-sky-400">Total: <strong>{totalWorkers}</strong></span>
            </div>
          </div>

          {/* Equipment */}
          {rdo.equipment.length > 0 && (
            <div>
              <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wide mb-2">Equipamentos</h3>
              <div className="space-y-1">
                {rdo.equipment.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="flex-1">{e.name}</span>
                    <span className="text-gray-500">{e.quantity}× · {e.hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {rdo.services.length > 0 && (
            <div>
              <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wide mb-2">Serviços Executados</h3>
              <div className="space-y-1">
                {rdo.services.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="flex-1">{s.description}</span>
                    <span className="text-gray-500">{s.quantity} {s.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trechos */}
          {rdo.trechos.length > 0 && (
            <div>
              <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wide mb-2">Avanço por Trecho</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs">
                      <th className="text-left pb-2 font-medium">Código</th>
                      <th className="text-left pb-2 font-medium">Descrição</th>
                      <th className="text-right pb-2 font-medium">Planejado</th>
                      <th className="text-right pb-2 font-medium">Executado</th>
                      <th className="text-right pb-2 font-medium">%</th>
                      <th className="text-center pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rdo.trechos.map((t) => {
                      const pct = t.plannedMeters > 0 ? (t.executedMeters / t.plannedMeters) * 100 : 0
                      return (
                        <tr key={t.id} className="border-t border-gray-700">
                          <td className="py-1.5 pr-3 text-gray-200 font-mono text-xs">{t.trechoCode}</td>
                          <td className="py-1.5 pr-3 text-gray-400">{t.trechoDescription}</td>
                          <td className="py-1.5 pr-3 text-right text-gray-300">{t.plannedMeters.toFixed(1)} m</td>
                          <td className="py-1.5 pr-3 text-right text-gray-300">{t.executedMeters.toFixed(1)} m</td>
                          <td className="py-1.5 pr-3 text-right text-gray-300">{pct.toFixed(1)}%</td>
                          <td className="py-1.5 text-center">{statusBadge(t.status)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Observations */}
          {rdo.observations && (
            <div>
              <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wide mb-2">Observações</h3>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{rdo.observations}</p>
            </div>
          )}
          {rdo.incidents && (
            <div>
              <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wide mb-2">Ocorrências</h3>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{rdo.incidents}</p>
            </div>
          )}

          {/* Photos */}
          {rdo.photos.length > 0 && (
            <div>
              <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wide mb-2">
                Registro Fotográfico ({rdo.photos.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {rdo.photos.map((p) => (
                  <div key={p.id}>
                    <img src={p.base64} alt={p.label} className="w-full h-28 object-cover rounded-lg border border-gray-700" />
                    {p.label && (
                      <p className="text-xs text-gray-500 mt-1 text-center truncate">{p.label}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function HistoricoPanel() {
  const { rdos, removeRdo, updateRdo } = useRdoStore()
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  // Edit state
  const [editingRdo, setEditingRdo] = useState<RDO | null>(null)
  const [editForm, setEditForm]     = useState<Partial<RDO>>({})

  // Period PDF state
  const [pdfPeriodType, setPdfPeriodType] = useState<'semanal' | 'mensal' | 'personalizado' | ''>('')
  const [pdfWeek,   setPdfWeek]   = useState('')
  const [pdfMonth,  setPdfMonth]  = useState('')
  const [pdfFrom,   setPdfFrom]   = useState('')
  const [pdfTo,     setPdfTo]     = useState('')

  const filtered = useMemo(() => {
    return rdos
      .filter((r) => {
        const q = search.toLowerCase()
        if (q && !String(r.number).includes(q) && !r.responsible.toLowerCase().includes(q) && !r.date.includes(q)) return false
        if (dateFrom && r.date < dateFrom) return false
        if (dateTo   && r.date > dateTo)   return false
        return true
      })
      .slice()
      .sort((a, b) => b.number - a.number)
  }, [rdos, search, dateFrom, dateTo])

  function handleDelete(id: string) {
    if (!confirm('Excluir este RDO? Esta ação não pode ser desfeita.')) return
    removeRdo(id)
  }

  function handleSaveEdit() {
    if (!editingRdo) return
    updateRdo(editingRdo.id, editForm)
    setEditingRdo(null)
    setEditForm({})
  }

  function handleBatchPDF() {
    let from = '', to = ''
    if (pdfPeriodType === 'semanal' && pdfWeek) {
      const [year, week] = pdfWeek.split('-W').map(Number)
      const jan4 = new Date(year, 0, 4)
      const startOfWeek1 = new Date(jan4.getTime() - ((jan4.getDay() || 7) - 1) * 86400000)
      const weekStart = new Date(startOfWeek1.getTime() + (week - 1) * 7 * 86400000)
      from = weekStart.toISOString().slice(0, 10)
      to   = new Date(weekStart.getTime() + 6 * 86400000).toISOString().slice(0, 10)
    } else if (pdfPeriodType === 'mensal' && pdfMonth) {
      const [y, m] = pdfMonth.split('-').map(Number)
      from = `${y}-${String(m).padStart(2, '0')}-01`
      const lastDay = new Date(y, m, 0).getDate()
      to   = `${y}-${String(m).padStart(2, '0')}-${lastDay}`
    } else if (pdfPeriodType === 'personalizado') {
      from = pdfFrom; to = pdfTo
    }
    const batchFiltered = rdos.filter((r) => r.date >= from && r.date <= to)
    if (batchFiltered.length === 0) { alert('Nenhum RDO no período selecionado.'); return }
    const label = pdfPeriodType === 'mensal' ? pdfMonth : `${from} a ${to}`
    printRdosBatchPDF(batchFiltered, label)
  }

  const filterInputCls = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-sky-500'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4 print:p-0">
      {/* Filters (hidden when printing) */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, responsável ou data..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-sky-500"
          />
        </div>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={filterInputCls} title="Data inicial" />
        <span className="text-gray-600 text-sm">até</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={filterInputCls} title="Data final" />
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }} className="text-sky-400 hover:text-sky-300 text-sm">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Period PDF selector */}
      <div className="flex items-center gap-2 flex-wrap print:hidden bg-gray-800 rounded-lg border border-gray-700 px-4 py-2.5">
        <span className="text-gray-400 text-xs font-medium">PDF por Período:</span>
        <select
          value={pdfPeriodType}
          onChange={(e) => setPdfPeriodType(e.target.value as typeof pdfPeriodType)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
        >
          <option value="">-- Selecionar --</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
          <option value="personalizado">Personalizado</option>
        </select>
        {pdfPeriodType === 'semanal' && (
          <input type="week" value={pdfWeek} onChange={(e) => setPdfWeek(e.target.value)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none" />
        )}
        {pdfPeriodType === 'mensal' && (
          <input type="month" value={pdfMonth} onChange={(e) => setPdfMonth(e.target.value)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none" />
        )}
        {pdfPeriodType === 'personalizado' && (
          <>
            <input type="date" value={pdfFrom} onChange={(e) => setPdfFrom(e.target.value)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none" />
            <span className="text-gray-500 text-xs">até</span>
            <input type="date" value={pdfTo} onChange={(e) => setPdfTo(e.target.value)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none" />
          </>
        )}
        {pdfPeriodType && (
          <button
            onClick={handleBatchPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold transition-colors"
          >
            <Printer size={12} />
            Exportar PDF (Período)
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-gray-500 text-sm print:hidden">
        {filtered.length} RDO{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        {rdos.length !== filtered.length && ` de ${rdos.length} total`}
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500 print:hidden">
          <p className="text-lg">Nenhum RDO encontrado.</p>
          {rdos.length === 0 && (
            <p className="text-sm mt-1">Crie o primeiro RDO pela aba "+ Novo RDO".</p>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((rdo) => (
          <RdoCard key={rdo.id} rdo={rdo} onDelete={() => handleDelete(rdo.id)} onEdit={() => { setEditingRdo(rdo); setEditForm({ ...rdo }) }} />
        ))}
      </div>

      {/* Edit Modal */}
      {editingRdo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
              <span className="text-white font-semibold">Editar RDO #{editingRdo.number}</span>
              <button onClick={() => setEditingRdo(null)} className="text-gray-400 hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Date + Responsible */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Data</label>
                  <input
                    type="date"
                    value={editForm.date ?? editingRdo.date}
                    onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Responsável</label>
                  <input
                    type="text"
                    value={editForm.responsible ?? editingRdo.responsible}
                    onChange={(e) => setEditForm((f) => ({ ...f, responsible: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none"
                  />
                </div>
              </div>
              {/* Weather */}
              <div>
                <label className="block text-gray-400 text-xs mb-2">Condições Climáticas</label>
                <div className="grid grid-cols-4 gap-3">
                  {(['morning', 'afternoon', 'night'] as const).map((p) => {
                    const labels = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' }
                    const weather = (editForm.weather ?? editingRdo.weather)
                    return (
                      <div key={p}>
                        <label className="text-gray-500 text-xs block mb-1">{labels[p]}</label>
                        <select
                          value={weather[p]}
                          onChange={(e) => setEditForm((f) => ({ ...f, weather: { ...(f.weather ?? editingRdo.weather), [p]: e.target.value } }))}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200"
                        >
                          <option value="good">Bom</option>
                          <option value="cloudy">Nublado</option>
                          <option value="rain">Chuva</option>
                          <option value="storm">Tempestade</option>
                        </select>
                      </div>
                    )
                  })}
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Temp. (°C)</label>
                    <input
                      type="number"
                      value={(editForm.weather ?? editingRdo.weather).temperatureC}
                      onChange={(e) => setEditForm((f) => ({ ...f, weather: { ...(f.weather ?? editingRdo.weather), temperatureC: Number(e.target.value) } }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200"
                    />
                  </div>
                </div>
              </div>
              {/* Manpower */}
              <div>
                <label className="block text-gray-400 text-xs mb-2">Mão de Obra</label>
                <div className="grid grid-cols-4 gap-3">
                  {([['foremanCount', 'Encarregado'], ['officialCount', 'Oficial'], ['helperCount', 'Ajudante'], ['operatorCount', 'Operador']] as const).map(([field, label]) => (
                    <div key={field}>
                      <label className="text-gray-500 text-xs block mb-1">{label}</label>
                      <input
                        type="number"
                        min={0}
                        value={(editForm.manpower ?? editingRdo.manpower)[field]}
                        onChange={(e) => setEditForm((f) => ({ ...f, manpower: { ...(f.manpower ?? editingRdo.manpower), [field]: Number(e.target.value) } }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200"
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* Observations */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">Observações Gerais</label>
                <textarea
                  rows={3}
                  value={editForm.observations ?? editingRdo.observations}
                  onChange={(e) => setEditForm((f) => ({ ...f, observations: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 resize-none focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Ocorrências / Incidentes</label>
                <textarea
                  rows={2}
                  value={editForm.incidents ?? editingRdo.incidents}
                  onChange={(e) => setEditForm((f) => ({ ...f, incidents: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 resize-none focus:outline-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-700 flex gap-2 shrink-0">
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-semibold transition-colors">Salvar</button>
              <button onClick={() => setEditingRdo(null)} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
