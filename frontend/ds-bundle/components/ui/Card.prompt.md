# Card Component

## Overview
Compound card component with Header, Title, Description, Content, and Footer parts.

## Color Scheme
- Background: `#112645`
- Border: `#20406a`
- Text Primary: `#f5f5f5`
- Text Secondary: `#a3a3a3`
- Border Radius: `rounded-xl`

## Compound Parts
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>Main content</CardContent>
  <CardFooter>Actions / footer</CardFooter>
</Card>
```

## Styling
- Uses `cn()` utility from `@/lib/utils` for class merging
- Fully forward-ref compatible
