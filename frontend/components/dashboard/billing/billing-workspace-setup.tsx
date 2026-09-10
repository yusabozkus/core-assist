"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBillingWorkspace } from "@/lib/api/billing"
import { billingRoutes } from "@/lib/billing-routes"

export function BillingWorkspaceSetup({
  view,
}: {
  view: "overview" | "plans" | "invoices"
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const workspace = await createBillingWorkspace(name.trim())
      router.replace(billingRoutes(workspace.id)[view])
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Çalışma alanı oluşturulamadı."
      )
      setPending(false)
    }
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="billing-workspace-name">Çalışma alanı adı</Label>
        <Input
          id="billing-workspace-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={80}
          required
          disabled={pending}
          placeholder="Örn. Markam"
          className="bg-card"
        />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Yalnızca kendi çalışma alanınızı oluşturur; ödeme başlatmaz. Başka bir
        çalışma alanının faturaları için sahibi veya yöneticisi tarafından
        yetkilendirilmeniz gerekir.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending || name.trim().length < 2}
        aria-busy={pending}
      >
        {pending ? "Hazırlanıyor…" : "Çalışma alanını oluştur"}
      </Button>
    </form>
  )
}
