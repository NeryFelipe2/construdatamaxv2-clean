import type { EquipmentStatus, AlertSeverity } from '@/types'

export const STATUS_CONFIG: Record<
  EquipmentStatus,
  { label: string; color: string; colorMuted: string }
> = {
  active:      { label: 'Ativo',      color: '#22c55e', colorMuted: 'rgba(34,197,94,0.13)'  },
  idle:        { label: 'Parado',     color: '#f59e0b', colorMuted: 'rgba(245,158,11,0.13)' },
  maintenance: { label: 'Manutenção', color: '#3b82f6', colorMuted: 'rgba(59,130,246,0.13)' },
  alert:       { label: 'Alerta',     color: '#ef4444', colorMuted: 'rgba(239,68,68,0.13)'  },
  offline:     { label: 'Inativo',    color: '#6b6b6b', colorMuted: 'rgba(107,107,107,0.13)'},
}

export const ALERT_CONFIG: Record<
  AlertSeverity,
  { label: string; color: string; colorMuted: string }
> = {
  critical: { label: 'Crítico', color: '#ef4444', colorMuted: 'rgba(239,68,68,0.1)'  },
  warning:  { label: 'Aviso',   color: '#f59e0b', colorMuted: 'rgba(245,158,11,0.1)' },
  info:     { label: 'Info',    color: '#3b82f6', colorMuted: 'rgba(59,130,246,0.1)' },
}
