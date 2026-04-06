import { useShallow } from 'zustand/react/shallow'
import { RefreshCw, Check, X, MapPin, ArrowRight } from 'lucide-react'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { FleetRoutingMap } from './FleetRoutingMap'
import type { RoutingRecommendation, RoutingPriority } from '@/types'
import { cn } from '@/lib/utils'

// ─── Priority meta ─────────────────────────────────────────────────────────────

const PRIORITY_META: Record<RoutingPriority, { label: string; color: string }> = {
  critical: { label: 'Crítico',  color: '#ef4444' },
  high:     { label: 'Alto',     color: '#f97316' },
  medium:   { label: 'Médio',    color: '#eab308' },
  low:      { label: 'Baixo',    color: '#22c55e' },
}

// ─── Routing card ─────────────────────────────────────────────────────────────

function RoutingCard({
  rec,
  onAccept,
  onDismiss,
}: {
  rec: RoutingRecommendation
  onAccept: () => void
  onDismiss: () => void
}) {
  const acted   = rec.accepted === true || rec.accepted === false
  const pmeta   = PRIORITY_META[rec.priority]

  return (
    <div
      className={cn(
        'bg-[#3d3d3d] border rounded-xl p-4',
        rec.accepted === true  ? 'border-[#22c55e]/40' :
        rec.accepted === false ? 'border-[#525252] opacity-50' :
                                 'border-[#525252]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ backgroundColor: `${pmeta.color}20`, color: pmeta.color }}
            >
              {pmeta.label}
            </span>
            <span className="text-[#f5f5f5] text-sm font-semibold">{rec.equipmentCode}</span>
            <span className="text-[#6b6b6b] text-xs">{rec.equipmentName}</span>
            {rec.accepted === true && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#22c55e]/15 text-[#22c55e]">
                Em execução
              </span>
            )}
          </div>

          {/* Route: from → to */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-[#6b6b6b]">
              <MapPin size={11} className="text-[#ef4444]" />
              {rec.fromSiteName}
            </span>
            <ArrowRight size={12} className="text-[#6b6b6b]" />
            <span className="flex items-center gap-1 text-xs text-[#22c55e]">
              <MapPin size={11} />
              {rec.toSiteName}
            </span>
          </div>

          {/* Reason */}
          <p className="text-[#6b6b6b] text-xs leading-relaxed mb-2">{rec.reason}</p>

          {/* Metrics row */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-[#6b6b6b]">
              Distância: <span className="text-[#f5f5f5]">{rec.estimatedDistanceKm}km</span>
            </span>
            <span className="text-[#6b6b6b]">
              Ganho de utilização:{' '}
              <span className="text-[#22c55e] font-semibold">+{rec.utilizationGainPct}%</span>
            </span>
            <span className="text-[#6b6b6b]">
              Data sugerida:{' '}
              <span className="text-[#f5f5f5]">
                {new Date(rec.suggestedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            </span>
            {rec.bimPhaseRef && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#3b82f6]/15 text-[#3b82f6]">
                BIM 4D: {rec.bimPhaseRef}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {!acted && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={onAccept}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#22c55e]/15 text-[#22c55e] text-xs font-semibold hover:bg-[#22c55e]/25 transition-colors"
            >
              <Check size={12} /> Aceitar
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#525252] text-[#6b6b6b] text-xs font-semibold hover:bg-[#333] transition-colors"
            >
              <X size={12} /> Dispensar
            </button>
          </div>
        )}
        {rec.accepted === true  && <Check size={14} className="text-[#22c55e] shrink-0 mt-0.5" />}
        {rec.accepted === false && <X    size={14} className="text-[#6b6b6b] shrink-0 mt-0.5" />}
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function RoteamentoPanel() {
  const { routingRecs, runRoutingEngine, acceptRouting, dismissRouting } = useOtimizacaoFrotaStore(
    useShallow((s) => ({
      routingRecs:       s.routingRecs,
      runRoutingEngine:  s.runRoutingEngine,
      acceptRouting:     s.acceptRouting,
      dismissRouting:    s.dismissRouting,
    }))
  )

  const pending  = routingRecs.filter((r) => r.accepted === undefined)
  const resolved = routingRecs.filter((r) => r.accepted !== undefined)

  return (
    <div className="flex flex-col gap-4">
      {/* Map */}
      <FleetRoutingMap />

      {/* Engine header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#f5f5f5] text-sm font-semibold">
            Sugestões de Realocação de Frota
          </p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            {pending.length} pendente{pending.length !== 1 ? 's' : ''}
            {resolved.length > 0 && ` · ${resolved.length} resolvida${resolved.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={runRoutingEngine}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-xs font-medium hover:bg-[#484848] transition-colors"
        >
          <RefreshCw size={13} /> Rodar Engine
        </button>
      </div>

      {/* Cards */}
      {routingRecs.length === 0 ? (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-6 text-center">
          <p className="text-[#6b6b6b] text-sm">
            Nenhuma sugestão. Clique em "Rodar Engine" para analisar a frota.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[...pending, ...resolved].map((rec) => (
            <RoutingCard
              key={rec.id}
              rec={rec}
              onAccept={() => acceptRouting(rec.id)}
              onDismiss={() => dismissRouting(rec.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
