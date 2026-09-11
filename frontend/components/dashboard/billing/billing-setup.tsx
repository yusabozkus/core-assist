"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { prepareBillingWorkspace } from "@/lib/api/billing"
import { billingRoutes } from "@/lib/billing-routes"

export function BillingSetup({
  view,
}: {
  view: "overview" | "plans" | "invoices"
}) {
  const router = useRouter()
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    // The server reuses the account's workspace, including concurrent requests.
    // This only prepares the account; it never starts a checkout or a trial.
    prepareBillingWorkspace(controller.signal)
      .then((workspace) => {
        if (!controller.signal.aborted) {
          router.replace(billingRoutes(workspace.id)[view])
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Abonelik bilgileri hazırlanamadı. Lütfen tekrar deneyin."
          )
        }
      })

    return () => controller.abort()
  }, [attempt, router, view])

  if (error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setError(null)
            setAttempt((current) => current + 1)
          }}
        >
          Tekrar dene
        </Button>
      </div>
    )
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 text-sm text-muted-foreground"
    >
      <HugeiconsIcon
        icon={Loading03Icon}
        className="size-5 animate-spin"
        aria-hidden="true"
      />
      Abonelik bilgileriniz hazırlanıyor…
    </div>
  )
}
