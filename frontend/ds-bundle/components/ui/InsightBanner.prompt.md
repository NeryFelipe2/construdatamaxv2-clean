# InsightBanner Component

## Overview
Banner component for displaying automated insights with different severity types.

## Insight Types
- **success**: Green - positive metrics (`bg-emerald-500/5`)
- **warning**: Amber - attention needed (`bg-amber-500/5`)
- **info**: Cyan - informational (`bg-cyan-500/5`)
- **efficiency**: Purple - platform efficiency (`bg-purple-500/5`)
- **guarantee**: Blue - data guarantee (`bg-blue-500/5`)

## Exports
```tsx
import { InsightBanner, InsightsPanel, generateDreInsights, generateFluxoCaixaInsights, generateCustoTrechoInsights } from '@/components/ui/InsightBanner'
```

## Single Banner Usage
```tsx
<InsightBanner 
  insight={{
    id: '1',
    type: 'success',
    title: 'Margem saudável',
    message: 'Margem bruta em 25%.',
    metric: { label: 'Margem', value: '25%', trend: 'up' },
    detail: 'Additional details here...',
    action: { label: 'Ver mais', onClick: () => {} }
  }}
  onDismiss={(id) => handleDismiss(id)}
/>
```

## Panel Usage
```tsx
<InsightsPanel insights={insights} title="Insights da Plataforma" />

// Or generate insights automatically
const insights = generateDreInsights({
  margemBruta: 25,
  margemLiquida: 10,
  lucroLiquido: 250000,
  totalReceita: 2500000
})
```

## Insight Structure
```tsx
interface Insight {
  id: string
  type: InsightType
  title: string
  message: string
  detail?: string
  metric?: { label: string; value: string; trend?: 'up' | 'down' }
  action?: { label: string; onClick?: () => void }
}
```
