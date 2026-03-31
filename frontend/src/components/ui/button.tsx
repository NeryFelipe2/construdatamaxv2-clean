import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#2abfdc] text-black shadow-sm hover:bg-[#1a9ab8]",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-500",
        outline: "border border-[#20406a] bg-transparent text-[#a3a3a3] hover:bg-[#1a3662] hover:text-[#f5f5f5]",
        secondary: "bg-[#1a3662] text-[#f5f5f5] shadow-sm hover:bg-[#20406a]",
        ghost: "hover:bg-[#1a3662] text-[#a3a3a3] hover:text-[#f5f5f5]",
        link: "text-[#2abfdc] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
