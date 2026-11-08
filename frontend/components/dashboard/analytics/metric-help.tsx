"use client"

import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function MetricHelp({
  label,
  description,
}: {
  label: string
  description: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} nasıl hesaplanır?`}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-w-[calc(100vw-2rem)] gap-2 rounded-lg text-xs"
      >
        <p className="font-medium">{label}</p>
        <p className="leading-5 text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  )
}
