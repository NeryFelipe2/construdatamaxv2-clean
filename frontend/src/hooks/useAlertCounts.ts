/**
 * Aggregates critical alert counts per module for sidebar badges.
 * Reads from stores with lightweight selectors — zero extra subscriptions
 * beyond what CommandCenterPanel already uses.
 */
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useTorreStore }           from '@/store/torreDeControleStore'
import { useGestao360Store }       from '@/store/gestao360Store'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useMaoDeObraStore }       from '@/store/maoDeObraStore'
import { useFrotaVeicularStore }   from '@/store/frotaVeicularStore'

export interface AlertCounts {
  [route: string]: number
}

export function useAlertCounts(): AlertCounts {
  const healthAlerts = useOtimizacaoFrotaStore((s) =>
    s.healthScores.filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high').length
  )
  const siteRisks = useTorreStore((s) =>
    s.sites.reduce((acc, site) =>
      acc + site.risks.filter((r) => r.status === 'active' && (r.level === 'critical' || r.level === 'high')).length, 0)
  )
  const changeOrders = useGestao360Store((s) =>
    s.changeOrders.filter((co) => co.status === 'submitted').length
  )
  const maintOrders = useGestaoEquipamentosStore((s) =>
    s.orders.filter((o) => {
      if (o.status === 'completed' || o.status === 'cancelled') return false
      return new Date(o.scheduledDate + 'T00:00:00') < new Date()
    }).length
  )
  const occurrences = useMaoDeObraStore((s) =>
    s.occurrences.filter((o) => o.type === 'accident').length
  )
  const fleetAlerts = useFrotaVeicularStore((s) =>
    s.alerts.filter(
      (a) => a.isActive && (a.severity === 'critical' || a.severity === 'high'),
    ).length
  )

  return {
    '/app/otimizacao-frota':    healthAlerts,
    '/app/torre-de-controle':   siteRisks,
    '/app/gestao-360':          changeOrders,
    '/app/gestao-equipamentos': maintOrders,
    '/app/mao-de-obra':         occurrences + fleetAlerts,
  }
}
