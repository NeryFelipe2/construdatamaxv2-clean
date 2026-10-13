// InsightBanner types for ConstrudaDataMax UI
import type { ReactNode } from 'react'

export type InsightType = 'success' | 'warning' | 'info' | 'efficiency' | 'guarantee'

export interface Insight {
  id: string
  type: InsightType
  title: string
  message: string
  detail?: string
  metric?: { label: string; value: string; trend?: 'up' | 'down' }
  action?: { label: string; onClick?: () => void }
}

export interface InsightBannerProps {
  insight: Insight
  onDismiss?: (id: string) => void
}

export interface InsightsPanelProps {
  insights: Insight[]
  title?: string
  collapsible?: boolean
}

export interface InsightGenerators {
  generateDreInsights: (data: { margemBruta: number; margemLiquida: number; lucroLiquido: number; totalReceita: number }) => Insight[]
  generateFluxoCaixaInsights: (data: { saldoAtual: number; mesBreakeven: string; totalRecebido: number; totalGasto: number }) => Insight[]
  generateCustoTrechoInsights: (data: { variacaoMedia: number; totalTrechos: number; trechosAbaixo: number }) => Insight[]
}
