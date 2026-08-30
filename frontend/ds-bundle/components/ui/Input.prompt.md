# Input Component

## Overview
Styled input component with focus states and variants for search/file types.

## Default Styles
- Background: `#0d2040`
- Border: `#20406a`
- Text: `#f5f5f5`
- Focus: `border-[#2abfdc]` + `ring-[#2abfdc]/20`
- Height: `h-9`
- Border Radius: `rounded-lg`

## Type Variants
- `type="text"`: Standard input
- `type="search"`: Includes custom webkit pseudo-element removal
- `type="file"`: Styled file input with border separator
- All standard HTML input types supported

## Usage
```tsx
import { Input } from '@/components/ui/input'

<Input type="text" placeholder="Digite aqui..." />
<Input type="search" placeholder="Buscar..." />
<Input type="file" />
```

## Features
- Forward ref support
- Full disabled state styling
- Custom placeholder color: `#6b6b6b`
