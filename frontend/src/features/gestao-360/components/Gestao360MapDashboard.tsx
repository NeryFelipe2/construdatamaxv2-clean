/**
 * Gestao360MapDashboard — Interactive map of all projects with severity markers.
 * Clicking a marker opens a Project 360 modal with full KPIs, photos, phases, budget, Gantt.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X, MapPin, AlertTriangle, CheckCircle2, Clock, BarChart3, Image } from 'lucide-react'
import { useProjetosStore } from '@/store/projetosStore'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useShallow } from 'zustand/react/shallow'
import type { Project, ProjectPhase } from '@/types'

// ─── Severity ─────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'ok'

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  ok:       '#22c55e',
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  ok:       'OK',
}

function calcSeverity(project: Project): Severity {
  const today = new Date()
  const end   = new Date(project.endDate + 'T00:00:00')
  const delayDays = Math.max(0, Math.floor((today.getTime() - end.getTime()) / 86_400_000))

  const lines    = project.budgetLines
  const budgeted = lines.reduce((s, l) => s + l.budgeted, 0)
  const eac      = lines.reduce((s, l) => s + l.projected, 0)
  const pctOver  = budgeted > 0 ? ((eac - budgeted) / budgeted) * 100 : 0

  if (delayDays > 30 || pctOver > 20) return 'critical'
  if (delayDays > 15 || pctOver > 10) return 'high'
  if (delayDays > 1  || pctOver > 5)  return 'medium'
  return 'ok'
}

function calcProgress(project: Project): number {
  const phases = project.executionPhases
  if (!phases.length) return 0
  return Math.round(phases.reduce((s, p) => s + p.progress, 0) / phases.length)
}

function calcBudgetDelta(project: Project): number {
  const lines    = project.budgetLines
  const budgeted = lines.reduce((s, l) => s + l.budgeted, 0)
  const eac      = lines.reduce((s, l) => s + l.projected, 0)
  return budgeted > 0 ? ((eac - budgeted) / budgeted) * 100 : 0
}

// ─── Rich pin marker icon ──────────────────────────────────────────────────────

function makeDivIcon(severity: Severity, project: Project, selected: boolean) {
  const color = SEVERITY_COLOR[severity]
  const code  = project.code.length > 10 ? project.code.slice(0, 10) : project.code
  const glow  = selected
    ? `0 0 0 2px ${color}60, 0 0 14px ${color}80`
    : `0 2px 8px rgba(0,0,0,0.6)`
  const bgAlpha = selected ? 'ee' : 'cc'

  return L.divIcon({
    className: '',
    iconAnchor: [44, 38],
    html: `
      <div style="
        position:relative;
        display:inline-flex;
        flex-direction:column;
        align-items:center;
      ">
        <div style="
          display:flex;align-items:center;gap:5px;
          background:#0d2040${bgAlpha};
          border:1.5px solid ${color};
          border-radius:8px;
          padding:4px 8px;
          box-shadow:${glow};
          min-width:80px;
          justify-content:center;
          transition:all 0.15s;
        ">
          <div style="
            width:9px;height:9px;border-radius:50%;
            background:${color};
            flex-shrink:0;
            box-shadow:0 0 5px ${color}aa;
          "></div>
          <span style="
            color:#e4f2f8;font-size:10px;font-weight:700;
            font-family:Inter,sans-serif;
            white-space:nowrap;
            letter-spacing:0.03em;
          ">${code}</span>
        </div>
        <div style="
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:7px solid ${color};
          margin-top:-1px;
        "></div>
      </div>
    `,
  })
}

// ─── Marker layer (imperative Leaflet) ────────────────────────────────────────

interface MarkerLayerProps {
  projects: Project[]
  selected: string | null
  onSelect: (id: string) => void
}

function MarkerLayer({ projects, selected, onSelect }: MarkerLayerProps) {
  const map = useMap()
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  useEffect(() => {
    const existing = markersRef.current

    existing.forEach((m, id) => {
      if (!projects.find((p) => p.id === id)) {
        m.remove()
        existing.delete(id)
      }
    })

    projects.forEach((project) => {
      if (project.lat == null || project.lng == null) return
      const severity = calcSeverity(project)
      const isSel    = project.id === selected

      if (existing.has(project.id)) {
        existing.get(project.id)!.setIcon(makeDivIcon(severity, project, isSel))
      } else {
        const marker = L.marker([project.lat, project.lng], {
          icon: makeDivIcon(severity, project, isSel),
        })
          .addTo(map)
          .on('click', () => onSelect(project.id))
        existing.set(project.id, marker)
      }
    })
  }, [projects, selected, map, onSelect])

  useEffect(() => {
    if (!selected) return
    const project = projects.find((p) => p.id === selected)
    if (project?.lat != null && project.lng != null) {
      map.setView([project.lat, project.lng], Math.max(map.getZoom(), 11), { animate: true })
    }
  }, [selected, projects, map])

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()
    }
  }, [])

  return null
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `R$${(n / 1_000).toFixed(0)}k`
  return `R$${n.toFixed(0)}`
}

function PhaseStatusBadge({ status }: { status: ProjectPhase['status'] }) {
  const map: Record<string, { label: string; color: string }> = {
    completed:   { label: 'Concluído',    color: '#22c55e' },
    in_progress: { label: 'Em andamento', color: '#2abfdc' },
    not_started: { label: 'Não iniciado', color: '#6b6b6b' },
  }
  const cfg = map[status] ?? { label: status, color: '#6b6b6b' }
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ color: cfg.color, background: `${cfg.color}20` }}
    >
      {cfg.label}
    </span>
  )
}

function GanttSvg({ project, W = 420 }: { project: Project; W?: number }) {
  const all: Array<ProjectPhase & { group: string }> = [
    ...project.planningPhases.map((p) => ({ ...p, group: 'Planejamento' })),
    ...project.executionPhases.map((p) => ({ ...p, group: 'Execução' })),
  ]

  const start = new Date(project.startDate + 'T00:00:00').getTime()
  const end   = new Date(project.endDate   + 'T00:00:00').getTime()
  const span  = Math.max(1, end - start)
  const LABEL = 110, ROW = 24, BAR_H = 12

  const today     = Date.now()
  const todayX    = LABEL + ((today - start) / span) * (W - LABEL)
  const todayClip = Math.min(Math.max(todayX, LABEL), W)

  return (
    <svg width={W} height={all.length * ROW + 20} style={{ overflow: 'visible', display: 'block' }}>
      <line x1={todayClip} y1={0} x2={todayClip} y2={all.length * ROW + 4} stroke="#2abfdc" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
      <text x={todayClip + 3} y={10} fontSize={8} fill="#2abfdc" style={{ fontFamily: 'Inter, sans-serif' }}>hoje</text>

      {all.map((phase, i) => {
        const ps = new Date(phase.startDate + 'T00:00:00').getTime()
        const pe = new Date(phase.endDate   + 'T00:00:00').getTime()
        const x1 = LABEL + ((ps - start) / span) * (W - LABEL)
        const x2 = LABEL + ((pe - start) / span) * (W - LABEL)
        const bw = Math.max(4, x2 - x1)
        const y  = i * ROW + 6

        const statusColor =
          phase.status === 'completed'   ? '#22c55e' :
          phase.status === 'in_progress' ? '#2abfdc' : '#5a8caa'

        const fillW = (phase.progress / 100) * bw

        return (
          <g key={phase.id}>
            <text x={LABEL - 4} y={y + BAR_H / 2 + 4} textAnchor="end" fontSize={9} fill="#8fb3c8"
              style={{ fontFamily: 'Inter, sans-serif' }}>
              {phase.name.length > 16 ? phase.name.slice(0, 15) + '…' : phase.name}
            </text>
            <rect x={x1} y={y} width={bw} height={BAR_H} rx={3} fill="#20406a" />
            <rect x={x1} y={y} width={fillW} height={BAR_H} rx={3} fill={statusColor} opacity={0.75} />
            <text x={x1 + bw + 3} y={y + BAR_H / 2 + 4} fontSize={9} fill={statusColor}
              style={{ fontFamily: 'Inter, sans-serif' }}>
              {phase.progress}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Project 360 Modal ────────────────────────────────────────────────────────

interface Project360ModalProps {
  project: Project
  onClose: () => void
}

function Project360Modal({ project, onClose }: Project360ModalProps) {
  const reports = useRelatorio360Store(useShallow((s) => s.reports))

  const severity    = calcSeverity(project)
  const progress    = calcProgress(project)
  const delta       = calcBudgetDelta(project)
  const color       = SEVERITY_COLOR[severity]

  const budgeted = project.budgetLines.reduce((s, l) => s + l.budgeted, 0)
  const eac      = project.budgetLines.reduce((s, l) => s + l.projected, 0)
  const spent    = project.budgetLines.reduce((s, l) => s + l.spent, 0)

  // CPI / SPI
  const execPhases = project.executionPhases
  const avgProgress = execPhases.length
    ? execPhases.reduce((s, p) => s + p.progress, 0) / execPhases.length
    : 0

  const today = new Date()
  const start = new Date(project.startDate + 'T00:00:00')
  const end   = new Date(project.endDate   + 'T00:00:00')
  const totalMs   = Math.max(1, end.getTime() - start.getTime())
  const elapsedMs = Math.min(totalMs, Math.max(0, today.getTime() - start.getTime()))
  const plannedPct = (elapsedMs / totalMs) * 100
  const cpi = spent > 0 ? (budgeted * (avgProgress / 100)) / spent : 1
  const spi = plannedPct > 0 ? avgProgress / plannedPct : 1

  // Photos from relatorio360 (match project name first word)
  const firstWord = project.name.split(/\s+/)[0].toLowerCase()
  const photos = useMemo(() => {
    return Object.values(reports)
      .filter((r) => r.projectName.toLowerCase().includes(firstWord))
      .flatMap((r) => r.photos)
      .slice(0, 8)
  }, [reports, firstWord])

  function spiCpiColor(v: number) {
    if (v >= 0.9) return '#22c55e'
    if (v >= 0.7) return '#eab308'
    return '#ef4444'
  }

  const kpis = [
    { label: 'Progresso',     value: `${progress}%`,             color: color },
    { label: 'Δ Orçamento',   value: `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`, color: Math.abs(delta) <= 5 ? '#22c55e' : Math.abs(delta) <= 15 ? '#eab308' : '#ef4444' },
    { label: 'CPI',           value: cpi > 0 ? cpi.toFixed(2) : '—', color: spiCpiColor(cpi) },
    { label: 'SPI',           value: spi > 0 ? spi.toFixed(2) : '—', color: spiCpiColor(spi) },
    { label: 'Severidade',    value: SEVERITY_LABEL[severity],   color },
    { label: 'Fases Exec.',   value: String(execPhases.length),  color: '#2abfdc' },
  ]

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-[#14294e] border border-[#20406a] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-[#20406a] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, background: `${color}20` }}>
                {SEVERITY_LABEL[severity]}
              </span>
              <span className="text-[#5a8caa] text-sm font-mono">{project.code}</span>
            </div>
            <h2 className="text-[#e4f2f8] text-lg font-bold mt-1 leading-tight">{project.name}</h2>
            {project.address && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin size={11} className="text-[#5a8caa]" />
                <span className="text-[#5a8caa] text-xs">{project.address}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-[#5a8caa] hover:text-[#e4f2f8] transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* KPI chips */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 px-6 py-3 border-b border-[#20406a] shrink-0">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-[#112645] rounded-lg px-3 py-2 text-center">
              <p className="text-[#5a8caa] text-[10px] truncate">{kpi.label}</p>
              <p className="text-sm font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Photos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image size={13} className="text-[#5a8caa]" />
              <p className="text-[#5a8caa] text-[10px] font-semibold uppercase tracking-wider">Fotos da Obra</p>
            </div>
            {photos.length === 0 ? (
              <p className="text-[#5a8caa] text-xs italic">Nenhuma foto disponível no Relatório 360 para este projeto.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {photos.map((ph) => (
                  <div key={ph.id} className="flex flex-col gap-1">
                    <img src={ph.base64} alt={ph.label} className="w-full aspect-video object-cover rounded-lg border border-[#20406a]" />
                    {ph.label && <p className="text-[10px] text-[#5a8caa] truncate text-center">{ph.label}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phases — two columns */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={13} className="text-[#5a8caa]" />
              <p className="text-[#5a8caa] text-[10px] font-semibold uppercase tracking-wider">Fases do Projeto</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Planning */}
              <div>
                <p className="text-[#5a8caa] text-[10px] font-semibold mb-2 uppercase tracking-wider">Planejamento</p>
                <div className="flex flex-col gap-2">
                  {project.planningPhases.map((phase) => (
                    <div key={phase.id} className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#e4f2f8] text-xs font-medium truncate">{phase.name}</span>
                        <PhaseStatusBadge status={phase.status} />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[#5a8caa] mt-1">
                        <span>{fmtDate(phase.startDate)}</span>
                        <span>→</span>
                        <span>{fmtDate(phase.endDate)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-[#20406a] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#5a8caa]" style={{ width: `${phase.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-[#5a8caa]">{phase.progress}%</span>
                      </div>
                    </div>
                  ))}
                  {project.planningPhases.length === 0 && <p className="text-[#5a8caa] text-xs italic">Nenhuma fase</p>}
                </div>
              </div>
              {/* Execution */}
              <div>
                <p className="text-[#5a8caa] text-[10px] font-semibold mb-2 uppercase tracking-wider">Execução</p>
                <div className="flex flex-col gap-2">
                  {project.executionPhases.map((phase) => (
                    <div key={phase.id} className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#e4f2f8] text-xs font-medium truncate">{phase.name}</span>
                        <PhaseStatusBadge status={phase.status} />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[#5a8caa] mt-1">
                        <span>{fmtDate(phase.startDate)}</span>
                        <span>→</span>
                        <span>{fmtDate(phase.endDate)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-[#20406a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${phase.progress}%`,
                              background: phase.status === 'completed' ? '#22c55e' : phase.status === 'in_progress' ? '#2abfdc' : '#5a8caa',
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[#5a8caa]">{phase.progress}%</span>
                      </div>
                    </div>
                  ))}
                  {project.executionPhases.length === 0 && <p className="text-[#5a8caa] text-xs italic">Nenhuma fase</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Budget table */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={13} className="text-[#5a8caa]" />
              <p className="text-[#5a8caa] text-[10px] font-semibold uppercase tracking-wider">Orçamento</p>
            </div>
            <div className="rounded-xl border border-[#20406a] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#112645] text-[#5a8caa] text-[10px]">
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-left px-3 py-2">Descrição</th>
                    <th className="text-right px-3 py-2">Orçado</th>
                    <th className="text-right px-3 py-2">EAC</th>
                    <th className="text-right px-3 py-2">Gasto</th>
                    <th className="text-right px-3 py-2">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {project.budgetLines.map((line) => {
                    const lineDelta = line.budgeted > 0 ? ((line.projected - line.budgeted) / line.budgeted) * 100 : 0
                    return (
                      <tr key={line.id} className="border-t border-[#20406a] hover:bg-[#1a3662] transition-colors">
                        <td className="px-3 py-2 text-[#5a8caa] uppercase text-[10px]">{line.type}</td>
                        <td className="px-3 py-2 text-[#e4f2f8] truncate max-w-[120px]">{line.description}</td>
                        <td className="px-3 py-2 text-right text-[#8fb3c8] font-mono">{fmtBRL(line.budgeted)}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: lineDelta > 5 ? '#ef4444' : '#e4f2f8' }}>{fmtBRL(line.projected)}</td>
                        <td className="px-3 py-2 text-right text-[#2abfdc] font-mono">{fmtBRL(line.spent)}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: Math.abs(lineDelta) <= 5 ? '#22c55e' : Math.abs(lineDelta) <= 15 ? '#eab308' : '#ef4444' }}>
                          {lineDelta > 0 ? '+' : ''}{lineDelta.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals */}
                  <tr className="border-t-2 border-[#20406a] bg-[#112645]">
                    <td colSpan={2} className="px-3 py-2 text-[#e4f2f8] font-semibold text-xs">Total</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-[#e4f2f8]">{fmtBRL(budgeted)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: delta > 5 ? '#ef4444' : '#22c55e' }}>{fmtBRL(eac)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-[#2abfdc]">{fmtBRL(spent)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: Math.abs(delta) <= 5 ? '#22c55e' : Math.abs(delta) <= 15 ? '#eab308' : '#ef4444' }}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Gantt */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={13} className="text-[#5a8caa]" />
              <p className="text-[#5a8caa] text-[10px] font-semibold uppercase tracking-wider">Cronograma</p>
              <span className="text-[#5a8caa] text-[10px]">{fmtDate(project.startDate)} → {fmtDate(project.endDate)}</span>
            </div>
            <div className="overflow-x-auto">
              <GanttSvg project={project} W={540} />
            </div>
            <div className="flex gap-3 mt-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#22c55e] inline-block" />Concluído</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#2abfdc] inline-block" />Em andamento</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#5a8caa] inline-block" />Não iniciado</span>
              <span className="flex items-center gap-1 ml-2"><span className="inline-block w-4 border-t border-dashed border-[#2abfdc]" />Hoje</span>
            </div>
          </div>

          {/* Status alerts */}
          <div className="flex flex-col gap-2">
            {delta > 10 && (
              <div className="flex items-center gap-2 bg-[#ef444418] border border-[#ef444430] rounded-lg px-3 py-2">
                <AlertTriangle size={12} className="text-[#ef4444] shrink-0" />
                <span className="text-[#ef4444] text-xs">Orçamento {delta.toFixed(0)}% acima do previsto</span>
              </div>
            )}
            {delta > 5 && delta <= 10 && (
              <div className="flex items-center gap-2 bg-[#eab30818] border border-[#eab30830] rounded-lg px-3 py-2">
                <AlertTriangle size={12} className="text-[#eab308] shrink-0" />
                <span className="text-[#eab308] text-xs">Custo {delta.toFixed(0)}% acima — atenção</span>
              </div>
            )}
            {severity === 'ok' && (
              <div className="flex items-center gap-2 bg-[#22c55e18] border border-[#22c55e30] rounded-lg px-3 py-2">
                <CheckCircle2 size={12} className="text-[#22c55e] shrink-0" />
                <span className="text-[#22c55e] text-xs">Projeto no prazo e dentro do orçamento</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Basemap config ───────────────────────────────────────────────────────────

type Basemap = 'voyager' | 'satellite' | 'outdoors' | 'dark'

const TILE_CONFIG: Record<Basemap, { url: string; attribution: string; subdomains: string | undefined }> = {
  voyager: {
    url:         'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains:  'abcd',
  },
  satellite: {
    url:         'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    subdomains:  undefined,
  },
  outdoors: {
    url:         'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
    subdomains:  'abc',
  },
  dark: {
    url:         'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains:  'abcd',
  },
}

const BASEMAP_LABELS: Record<Basemap, string> = {
  voyager:   'Ruas',
  satellite: 'Satélite',
  outdoors:  'Relevo',
  dark:      'Escuro',
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type Filter = 'all' | Severity

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Gestao360MapDashboard() {
  const projects = useProjetosStore((s) => s.projects)
  const [filter, setFilter]         = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [basemap, setBasemap]       = useState<Basemap>('voyager')

  const withCoords = projects.filter((p) => p.lat != null && p.lng != null)
  const filtered   = filter === 'all' ? withCoords : withCoords.filter((p) => calcSeverity(p) === filter)
  const selected   = withCoords.find((p) => p.id === selectedId) ?? null

  const counts: Record<Severity, number> = {
    critical: withCoords.filter((p) => calcSeverity(p) === 'critical').length,
    high:     withCoords.filter((p) => calcSeverity(p) === 'high').length,
    medium:   withCoords.filter((p) => calcSeverity(p) === 'medium').length,
    ok:       withCoords.filter((p) => calcSeverity(p) === 'ok').length,
  }

  const center: [number, number] = [-15.0, -52.0]

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all',      label: `Todos (${withCoords.length})` },
    { id: 'critical', label: `Crítico (${counts.critical})` },
    { id: 'high',     label: `Alto (${counts.high})`        },
    { id: 'medium',   label: `Médio (${counts.medium})`     },
    { id: 'ok',       label: `OK (${counts.ok})`            },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#20406a] bg-[#0d2040] flex-wrap">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{
              background: filter === f.id
                ? (f.id === 'all' ? '#2abfdc20' : `${SEVERITY_COLOR[f.id as Severity]}25`)
                : 'transparent',
              color: filter === f.id
                ? (f.id === 'all' ? '#2abfdc' : SEVERITY_COLOR[f.id as Severity])
                : '#6b6b6b',
              border: `1px solid ${filter === f.id
                ? (f.id === 'all' ? '#2abfdc50' : `${SEVERITY_COLOR[f.id as Severity]}50`)
                : '#20406a'}`,
            }}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[#5a8caa] text-xs">
          <MapPin size={11} />
          <span>{filtered.length} obra{filtered.length !== 1 ? 's' : ''} no mapa</span>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <MapContainer
          center={center}
          zoom={5}
          style={{ height: '100%', width: '100%', background: '#0d2040' }}
          zoomControl={true}
        >
          <TileLayer
            key={basemap}
            url={TILE_CONFIG[basemap].url}
            attribution={TILE_CONFIG[basemap].attribution}
            subdomains={TILE_CONFIG[basemap].subdomains ?? 'abc'}
            maxZoom={19}
          />
          <MarkerLayer
            projects={filtered}
            selected={selectedId}
            onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          />
        </MapContainer>

        {/* Basemap switcher overlay */}
        <div className="absolute bottom-4 left-4 z-[1000] flex gap-1 bg-[#112645]/90 border border-[#20406a] rounded-lg p-1 backdrop-blur-sm">
          {(Object.keys(BASEMAP_LABELS) as Basemap[]).map((b) => (
            <button
              key={b}
              onClick={() => setBasemap(b)}
              className="px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
              style={{
                background: basemap === b ? '#2abfdc20' : 'transparent',
                color:      basemap === b ? '#2abfdc'   : '#6b6b6b',
                border:     `1px solid ${basemap === b ? '#2abfdc50' : 'transparent'}`,
              }}
            >
              {BASEMAP_LABELS[b]}
            </button>
          ))}
        </div>
      </div>

      {/* Project 360 Modal */}
      {selected && (
        <Project360Modal
          project={selected}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Leaflet control styles */}
      <style>{`
        .leaflet-control-zoom a {
          background: #112645 !important;
          color: #8fb3c8 !important;
          border-color: #20406a !important;
        }
        .leaflet-control-zoom a:hover {
          background: #14294e !important;
          color: #2abfdc !important;
        }
      `}</style>
    </div>
  )
}
