# StatCard Component

## Overview
Statistics display card with label, value, icon, and optional subtext.

## Variants
| Variant  | Icon BG              | Value Color   |
|----------|---------------------|---------------|
| default  | `bg-[#1a3662]`     | `text-[#f5f5f5]` |
| accent   | `bg-[#2abfdc]/15`  | `text-[#2abfdc]` |
| success  | `bg-[#22c55e]/15`  | `text-[#22c55e]` |
| warning  | `bg-[#fbbf24]/15`  | `text-[#fbbf24]` |
| danger   | `bg-[#ef4444]/15`  | `text-[#ef4444]` |

## Usage
```tsx
import { StatCard } from '@/components/shared/StatCard'
import { DollarSign, TrendingUp, Percent, Target } from 'lucide-react'

<StatCard
  label="Receita"
  value="R$ 2.5M"
  sub="este mês"
  icon={DollarSign}
  variant="success"
/>

// Using accent prop (shorthand for variant="accent")
<StatCard
  label="Margem"
  value="28%"
  icon={Percent}
  accent
/>
```

## Props
```tsx
interface StatCardProps {
  label: string      // Uppercase label text
  value: string      // Main value (supports formatting like "R$ 2.5M")
  sub?: string       // Subtitle/secondary text
  icon: LucideIcon   // Icon component from lucide-react
  accent?: boolean   // Shorthand for variant="accent"
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
  className?: string
}
```
