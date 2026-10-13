# ConstrudaDataMax UI Primitives

Design system component library for ConstruDataMax v2 - a construction management platform for sanitation projects.

## Components

### Primitivos de UI

| Component | Description | File |
|-----------|-------------|------|
| **Button** | Multi-variant button with CVA | `button.tsx` |
| **Card** | Compound card (Header, Title, Content, Footer) | `card.tsx` |
| **Input** | Styled input with focus states | `input.tsx` |
| **Popover** | Radix-based popover | `popover.tsx` |
| **HoverCard** | Radix-based hover card | `hover-card.tsx` |
| **InfoTooltip** | Rich contextual tooltips for KPIs | `InfoTooltip.tsx` |
| **InsightBanner** | Automated insight banners | `InsightBanner.tsx` |
| **StatCard** | Statistics display cards | `StatCard.tsx` |

## Color Palette

### Brand Colors
- **Primary**: `#2abfdc` (Cyan)
- **Primary Hover**: `#1a9ab8`

### Dark Theme
- **Base Background**: `#0a1628`
- **Elevated**: `#112645`
- **Surface**: `#14294e`
- **Input**: `#0d2040`

### Borders
- **Default**: `#20406a`
- **Light**: `#2a4a6e`

### Semantic
- **Success**: `#22c55e` (Green)
- **Warning**: `#fbbf24` (Amber)
- **Danger**: `#ef4444` (Red)
- **Info**: `#2abfdc` (Cyan)

## Design Principles

1. **Dark-first**: All components designed for dark mode
2. **Semantic color**: Colors carry meaning (success/warning/danger)
3. **Accessible**: Focus states, ARIA labels, keyboard navigation
4. **Composable**: Compound components for flexibility
5. **Tailwind-native**: Utility classes via `cn()` helper

## Usage

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Título</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Digite aqui..." />
        <Button variant="default">Enviar</Button>
      </CardContent>
    </Card>
  )
}
```

## Tech Stack

- **Framework**: React 19
- **Styling**: Tailwind CSS v4
- **Variants**: class-variance-authority
- **Primitives**: Radix UI (Popover, HoverCard)
- **Icons**: Lucide React
- **Build**: Vite

## Project

- **Version**: 0.1.0
- **Type**: Frontend for ConstruDataMax construction management platform
- **Domain**: Sanitation project management (sewage collection networks)
