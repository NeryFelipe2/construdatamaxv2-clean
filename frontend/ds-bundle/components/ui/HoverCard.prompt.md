# HoverCard Component

## Overview
Wrapper around Radix UI HoverCard primitive. Shows content on hover.

## Dependencies
- `@radix-ui/react-hover-card`

## Exports
```tsx
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'
```

## Usage
```tsx
<HoverCard>
  <HoverCardTrigger asChild>
    <span className="cursor-pointer">Passe o mouse</span>
  </HoverCardTrigger>
  <HoverCardContent align="center" sideOffset={4}>
    <h4>Informações</h4>
    <p>Conteúdo que aparece no hover...</p>
  </HoverCardContent>
</HoverCard>
```

## Props
- `align`: 'start' | 'center' | 'end' (default: 'center')
- `sideOffset`: number (default: 4)

## Styling
- Same color scheme as Card: `bg-[#112645]`, `border-[#20406a]`
- Width: `w-64` default
