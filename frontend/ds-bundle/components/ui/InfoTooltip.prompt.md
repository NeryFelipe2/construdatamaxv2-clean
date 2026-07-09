# InfoTooltip Component

## Overview
Rich contextual tooltip for KPIs and data labels. Shows explanation, importance, and actions.

## Features
- Click to open on desktop
- Tap to open on mobile
- Multiple content sections: description, why it matters, action hint, efficiency note
- Position: top, bottom, left, right
- Variants: 'icon' (shows ? icon) or 'inline' (wraps children)

## Usage
```tsx
import { InfoTooltip, TOOLTIPS } from '@/components/ui/InfoTooltip'

<InfoTooltip 
  content={TOOLTIPS.receitaBruta}
  position="top"
  variant="icon"
/>

// Inline variant
<InfoTooltip content={TOOLTIPS.custoUnitario} variant="inline">
  <span>Custo Unitário R$/m</span>
</InfoTooltip>
```

## TOOLTIPS Constants
Pre-built tooltips for common KPIs:
- `TOOLTIPS.receitaBruta`
- `TOOLTIPS.custoDirecto`
- `TOOLTIPS.lucroBruto`
- `TOOLTIPS.lucroLiquido`
- `TOOLTIPS.fluxoCaixa`
- `TOOLTIPS.ppc`
- `TOOLTIPS.custoUnitario`
- And more...

## Content Structure
```tsx
interface TooltipContent {
  title: string
  description: string
  whyItMatters?: string
  actionHint?: string
  efficiencyNote?: string
}
```
