import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-[#20406a] bg-[#0d2040] px-3 py-2 text-sm text-[#f5f5f5] shadow-sm transition-shadow placeholder:text-[#6b6b6b] focus-visible:border-[#2abfdc] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2abfdc]/20 disabled:cursor-not-allowed disabled:opacity-50",
          type === "search" &&
            "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          type === "file" &&
            "p-0 pr-3 italic text-[#6b6b6b] file:me-3 file:h-full file:border-0 file:border-r file:border-solid file:border-[#20406a] file:bg-transparent file:px-3 file:text-sm file:font-medium file:not-italic file:text-[#f5f5f5]",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
