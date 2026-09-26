"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"

export function AdminEmailRefresh() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible")
        startTransition(() => router.refresh())
    }
    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refresh)
    }
  }, [router])
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <HugeiconsIcon
        icon={RefreshIcon}
        className={`size-4 ${pending ? "animate-spin" : ""}`}
      />
      {pending ? "Yenileniyor" : "Yenile"}
    </Button>
  )
}
