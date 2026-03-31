/**
 * BimSaneamentoPanel — Side panel for sanitation-type BIM projects.
 * Tabs: Rede de Tubulações | Fluxograma ETE | Sensores IoT
 */
import { useState, useMemo } from 'react'
import { Activity, Network, GitBranch } from 'lucide-react'
import { useBimStore } from '@/store/bimStore'

// ─── Tab 1: Rede de Tubulações ────────────────────────────────────────────────

function TabRede() {
  const project = useBimStore((s) => s.project)
  const segments = project?.segments ?? []

  if (segments.length === 0) {
    return <p className="text-[#5a8caa] text-xs p-4">Nenhum segmento carregado.</p>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-5 gap-1 px-3 py-2 text-[10px] font-semibold text-[#5a8caa] uppercase tracking-wider border-b border-[#20406a]">
        <span className="col-span-1">Trecho</span>
        <span className="text-right">DN (mm)</span>
        <span className="text-right">Comp. (m)</span>
        <span className="text-right">Prof. (m)</span>
        <span className="text-right">Material</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {segments.slice(0, 80).map((seg) => (
          <div
            key={seg.id}
            className="grid grid-cols-5 gap-1 px-3 py-1.5 text-xs border-b border-[#20406a]/40 hover:bg-[#14294e]/50 transition-colors"
          >
            <span className="text-[#2abfdc] font-mono text-[10px]">{seg.trechoCode || '—'}</span>
            <span className="text-right text-[#e4f2f8]">{seg.diameter ?? '—'}</span>
            <span className="text-right text-[#8fb3c8]">{seg.lengthM?.toFixed(1) ?? '—'}</span>
            <span className="text-right text-[#8fb3c8]">{seg.avgDepthM?.toFixed(2) ?? '—'}</span>
            <span className="text-right text-[#5a8caa] text-[10px]">{seg.material ?? '—'}</span>
          </div>
        ))}
        {segments.length > 80 && (
          <p className="text-[#5a8caa] text-[10px] text-center py-2">
            + {segments.length - 80} trechos adicionais
          </p>
        )}
      </div>
      {/* KPIs */}
      <div className="border-t border-[#20406a] px-3 py-2 flex gap-4 text-[10px]">
        <div>
          <span className="text-[#5a8caa]">Total trechos: </span>
          <span className="text-[#2abfdc] font-bold">{segments.length}</span>
        </div>
        <div>
          <span className="text-[#5a8caa]">Extensão total: </span>
          <span className="text-[#2abfdc] font-bold">
            {(segments.reduce((s, seg) => s + (seg.lengthM ?? 0), 0) / 1000).toFixed(2)} km
          </span>
        </div>
        <div>
          <span className="text-[#5a8caa]">DN médio: </span>
          <span className="text-[#2abfdc] font-bold">
            {Math.round(segments.reduce((s, seg) => s + (seg.diameter ?? 200), 0) / Math.max(1, segments.length))} mm
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: Fluxograma ETE ────────────────────────────────────────────────────

const ETE_STAGES = [
  { id: 'captacao',    label: 'Captação',       color: '#3b82f6', desc: 'Captação bruta' },
  { id: 'grade',       label: 'Grade / Crivo',  color: '#8b5cf6', desc: 'Remoção sólidos' },
  { id: 'desarenador', label: 'Desarenador',     color: '#2abfdc', desc: 'Remoção areia' },
  { id: 'decantador',  label: 'Decantador Prim.', color: '#38bdf8', desc: 'Sedimentação' },
  { id: 'bio',         label: 'Tratamento Bio.', color: '#4ade80', desc: 'Lodo ativado / UASB' },
  { id: 'decantador2', label: 'Decantador Sec.', color: '#22c55e', desc: 'Clarificação' },
  { id: 'desinfeccao', label: 'Desinfecção',     color: '#eab308', desc: 'Cloração / UV' },
  { id: 'efluente',    label: 'Efluente Final',  color: '#2abfdc', desc: 'Classe D/C' },
]

function TabFluxograma() {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <p className="text-[#5a8caa] text-xs">Diagrama de processo — ETE tipo lodo ativado convencional</p>

      {/* Flow diagram */}
      <div className="relative flex flex-col gap-2">
        {ETE_STAGES.map((stage, i) => {
          const isHov = hovered === stage.id
          const isLast = i === ETE_STAGES.length - 1
          return (
            <div key={stage.id} className="flex flex-col items-start">
              <div
                onMouseEnter={() => setHovered(stage.id)}
                onMouseLeave={() => setHovered(null)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl border w-full cursor-default transition-all"
                style={{
                  background:   isHov ? `${stage.color}18` : '#14294e',
                  borderColor:  isHov ? `${stage.color}60` : '#20406a',
                }}
              >
                {/* Step number */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                  style={{ background: `${stage.color}25`, color: stage.color }}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-[#e4f2f8] text-xs font-semibold" style={isHov ? { color: stage.color } : {}}>
                    {stage.label}
                  </p>
                  <p className="text-[#5a8caa] text-[10px]">{stage.desc}</p>
                </div>
                {/* Flow indicator */}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: stage.color, opacity: 0.8 }}
                />
              </div>
              {/* Arrow */}
              {!isLast && (
                <div className="flex items-center ml-7 my-0.5">
                  <div className="w-px h-3 bg-[#20406a]" />
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#20406a] -ml-[3.5px]" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lodo pathway */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl px-4 py-3">
        <p className="text-[#5a8caa] text-[10px] font-semibold uppercase tracking-wider mb-2">Via do Lodo</p>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {['Adensamento', 'Digestão Anaeróbia', 'Desidratação', 'Destinação Final'].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className="text-[#8fb3c8]">{s}</span>
              {i < arr.length - 1 && <span className="text-[#20406a]">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab 3: Sensores IoT ──────────────────────────────────────────────────────

function useSensorData() {
  // Simulate sensor readings that change slightly every render cycle via useMemo seeded by time
  return useMemo(() => {
    const t = Math.floor(Date.now() / 30_000) // bucket by 30s so it's stable within render
    const jitter = (seed: number, range: number) => {
      const x = Math.sin(seed * 12.9898 + t * 78.233) * 43758.5453
      return (x - Math.floor(x)) * range
    }
    return [
      {
        id: 's01', label: 'Vazão entrada', unit: 'm³/h', value: 820 + jitter(1, 40),
        min: 400, max: 1200, warn: 1100, crit: 1150,
        icon: '💧',
      },
      {
        id: 's02', label: 'Pressão rede 1', unit: 'bar', value: 2.4 + jitter(2, 0.6),
        min: 0.5, max: 4, warn: 3.5, crit: 3.8,
        icon: '📊',
      },
      {
        id: 's03', label: 'Nível reservatório', unit: '%', value: 72 + jitter(3, 20),
        min: 0, max: 100, warn: 20, crit: 10,
        icon: '🏗️',
      },
      {
        id: 's04', label: 'pH efluente', unit: '', value: 7.1 + jitter(4, 0.8),
        min: 6, max: 9, warn: 8.5, crit: 8.8,
        icon: '🧪',
      },
      {
        id: 's05', label: 'Turbidez saída', unit: 'NTU', value: 3.2 + jitter(5, 4),
        min: 0, max: 20, warn: 10, crit: 15,
        icon: '🔬',
      },
      {
        id: 's06', label: 'DBO efluente', unit: 'mg/L', value: 18 + jitter(6, 15),
        min: 0, max: 200, warn: 100, crit: 130,
        icon: '🌿',
      },
      {
        id: 's07', label: 'Oxigênio dissolvido', unit: 'mg/L', value: 5.8 + jitter(7, 3),
        min: 0, max: 12, warn: 2, crit: 1,
        icon: '💨',
      },
      {
        id: 's08', label: 'Temperatura', unit: '°C', value: 22 + jitter(8, 6),
        min: 10, max: 40, warn: 35, crit: 38,
        icon: '🌡️',
      },
    ]
  }, [])
}

function SensorCard({ s }: { s: ReturnType<typeof useSensorData>[number] }) {
  const pct = ((s.value - s.min) / (s.max - s.min)) * 100

  const status =
    s.value >= s.crit ? 'critical' :
    s.value >= s.warn ? 'warning'  : 'ok'

  const color =
    status === 'critical' ? '#ef4444' :
    status === 'warning'  ? '#eab308' : '#22c55e'

  return (
    <div
      className="bg-[#14294e] border rounded-xl px-3 py-3 flex flex-col gap-2"
      style={{ borderColor: status !== 'ok' ? `${color}40` : '#20406a' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{s.icon}</span>
          <span className="text-[#8fb3c8] text-[10px] font-medium">{s.label}</span>
        </div>
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
      <div className="flex items-end gap-1">
        <span className="text-[#e4f2f8] text-lg font-bold leading-none" style={{ color }}>
          {s.value.toFixed(1)}
        </span>
        <span className="text-[#5a8caa] text-xs pb-0.5">{s.unit}</span>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-[#20406a] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  )
}

function TabSensores() {
  const sensors = useSensorData()
  const critical = sensors.filter((s) => s.value >= s.crit).length
  const warning  = sensors.filter((s) => s.value >= s.warn && s.value < s.crit).length

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      {/* Summary */}
      <div className="flex gap-2 text-xs">
        <span className="px-2 py-1 rounded-full bg-[#22c55e18] text-[#22c55e] border border-[#22c55e30]">
          {sensors.length - critical - warning} OK
        </span>
        {warning > 0 && (
          <span className="px-2 py-1 rounded-full bg-[#eab30818] text-[#eab308] border border-[#eab30830]">
            {warning} Atenção
          </span>
        )}
        {critical > 0 && (
          <span className="px-2 py-1 rounded-full bg-[#ef444418] text-[#ef4444] border border-[#ef444430]">
            {critical} Crítico
          </span>
        )}
        <span className="ml-auto text-[#5a8caa] text-[10px] flex items-center">
          Atualiza a cada 30s (simulado)
        </span>
      </div>

      {/* Sensor grid */}
      <div className="grid grid-cols-2 gap-2">
        {sensors.map((s) => <SensorCard key={s.id} s={s} />)}
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type SaneTab = 'rede' | 'fluxograma' | 'sensores'

export function BimSaneamentoPanel() {
  const [tab, setTab] = useState<SaneTab>('rede')

  const tabs: Array<{ id: SaneTab; label: string; icon: React.ReactNode }> = [
    { id: 'rede',        label: 'Rede',       icon: <Network size={12} /> },
    { id: 'fluxograma',  label: 'Fluxograma', icon: <GitBranch size={12} /> },
    { id: 'sensores',    label: 'IoT',        icon: <Activity size={12} /> },
  ]

  return (
    <div className="w-[260px] shrink-0 flex flex-col bg-[#112645] border-l border-[#20406a] overflow-hidden h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#20406a]">
        <p className="text-[#2abfdc] text-xs font-semibold">Saneamento</p>
        <p className="text-[#5a8caa] text-[10px]">Análise de rede sanitária</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#20406a]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              tab === t.id
                ? 'text-[#2abfdc] border-b-2 border-[#2abfdc]'
                : 'text-[#6b6b6b] hover:text-[#8fb3c8]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'rede'       && <TabRede />}
        {tab === 'fluxograma' && <TabFluxograma />}
        {tab === 'sensores'   && <TabSensores />}
      </div>
    </div>
  )
}
