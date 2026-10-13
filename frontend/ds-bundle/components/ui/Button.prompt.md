# Button Component

## Overview
Button component with CVA (class-variance-authority) for variants and sizes. Uses Tailwind CSS.

## Variants
- **default**: Primary action - `bg-[#2abfdc]` (cyan)
- **destructive**: Delete/danger actions - `bg-red-600`
- **outline**: Secondary bordered - `border border-[#20406a]`
- **secondary**: Dark background - `bg-[#1a3662]`
- **ghost**: Transparent with hover - `hover:bg-[#1a3662]`
- **link**: Text link style - `text-[#2abfdc] underline`

## Sizes
- **default**: `h-9 px-4 py-2`
- **sm**: `h-8 rounded-lg px-3 text-xs`
- **lg**: `h-10 rounded-lg px-8`
- **icon**: `h-9 w-9` (square)

## Usage
```tsx
import { Button } from '@/components/ui/button'

<Button variant="default" size="default">Click me</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Secondary action</Button>
```

## Compound Export
```tsx
export { Button, buttonVariants }
```
