# Popover Component

## Overview
Wrapper around Radix UI Popover primitive.

## Dependencies
- `@radix-ui/react-popover`

## Exports
```tsx
import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
```

## Usage
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button>Open</Button>
  </PopoverTrigger>
  <PopoverContent align="center" sideOffset={4}>
    <h4>Título</h4>
    <p>Conteúdo do popover...</p>
  </PopoverContent>
</Popover>
```

## Props
- `align`: 'start' | 'center' | 'end' (default: 'center')
- `sideOffset`: number (default: 4)
- Standard Radix Content props available

## Animation Classes
- Fade in/out transitions
- Zoom in/out transitions
- Slide from direction
