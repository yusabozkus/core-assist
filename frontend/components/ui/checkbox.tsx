"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, onChange, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState<boolean>(
      Boolean(checked ?? defaultChecked ?? false)
    )

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(Boolean(checked))
      }
    }, [checked])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.checked
      setIsChecked(next)
      onChange?.(e)
      onCheckedChange?.(next)
    }

    return (
      <div className="relative inline-flex items-center justify-center">
        <input
          type="checkbox"
          ref={ref}
          checked={isChecked}
          onChange={handleChange}
          className="peer sr-only"
          {...props}
        />
        <div
          onClick={() => {
            const next = !isChecked
            setIsChecked(next)
            onCheckedChange?.(next)
          }}
          className={cn(
            "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-input bg-transparent transition-colors peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            isChecked
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:border-foreground/50",
            className
          )}
        >
          {isChecked && (
            <svg
              className="size-3 stroke-current stroke-[2.5]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
