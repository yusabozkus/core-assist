import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  endIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, endIcon, ...props }, ref) => {
    return (
      <div className="relative flex w-full items-center">
        {icon && (
          <div className="pointer-events-none absolute left-4 flex items-center justify-center text-muted-foreground/70 transition-colors">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-2xl border border-border/90 bg-card/70 px-4 py-2 text-sm text-foreground shadow-2xs transition-all duration-200 placeholder:text-muted-foreground/50 hover:border-border focus-visible:border-foreground/40 focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-card dark:shadow-xs dark:placeholder:text-muted-foreground/60 dark:hover:border-foreground/20",
            icon && "pl-11",
            endIcon && "pr-11",
            className
          )}
          ref={ref}
          {...props}
        />
        {endIcon && (
          <div className="absolute right-3.5 flex items-center justify-center text-muted-foreground transition-colors">
            {endIcon}
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
