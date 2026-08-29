"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  CheckmarkCircle01Icon,
  PlusSignIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { selectActiveStore } from "@/app/(dashboard)/dashboard/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { createStore } from "@/lib/api/stores"
import type { StoreSummary } from "@/types/store"

type StoreManagementProps = {
  stores: StoreSummary[]
  activeStoreId: string | null
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

export function StoreManagement({
  stores,
  activeStoreId,
}: StoreManagementProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [pendingStoreId, setPendingStoreId] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSwitching, startSwitchTransition] = useTransition()

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedName = name.trim()
    if (normalizedName.length < 2) {
      setCreateError("Mağaza adı en az 2 karakter olmalıdır.")
      return
    }

    setIsCreating(true)
    setCreateError(null)
    setActionError(null)
    setMessage(null)

    try {
      const createdStore = await createStore({ name: normalizedName })
      await selectActiveStore(createdStore.id)
      setName("")
      setIsCreateDialogOpen(false)
      setMessage(`${createdStore.name} oluşturuldu ve aktif mağaza yapıldı.`)
      router.refresh()
    } catch (caughtError) {
      setCreateError(
        caughtError instanceof Error
          ? caughtError.message
          : "Mağaza oluşturulamadı."
      )
    } finally {
      setIsCreating(false)
    }
  }

  function handleActivate(store: StoreSummary) {
    if (store.id === activeStoreId || isSwitching) return

    setPendingStoreId(store.id)
    setActionError(null)
    setMessage(null)

    startSwitchTransition(async () => {
      try {
        await selectActiveStore(store.id)
        setMessage(`${store.name} aktif mağaza yapıldı.`)
        router.refresh()
      } catch (caughtError) {
        setActionError(
          caughtError instanceof Error
            ? caughtError.message
            : "Aktif mağaza değiştirilemedi."
        )
      } finally {
        setPendingStoreId(null)
      }
    })
  }

  function handleCreateDialogChange(open: boolean) {
    if (!open && isCreating) return

    setIsCreateDialogOpen(open)
    setCreateError(null)

    if (!open) {
      setName("")
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold text-foreground">Kayıtlı mağazalar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stores.length} mağaza hesabınıza bağlı
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ResponsiveDialog
            open={isCreateDialogOpen}
            onOpenChange={handleCreateDialogChange}
            title="Yeni mağaza ekle"
            description="Mağazanızı oluşturun ve satış operasyonlarınızı ayrı olarak yönetmeye başlayın."
            trigger={
              <Button type="button" size="sm">
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                Mağaza ekle
              </Button>
            }
            footer={({ close }) => (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={isCreating}
                >
                  Vazgeç
                </Button>
                <Button
                  type="submit"
                  form="create-store-form"
                  disabled={isCreating || name.trim().length < 2}
                >
                  {isCreating ? "Oluşturuluyor..." : "Mağazayı oluştur"}
                </Button>
              </>
            )}
          >
            <form
              id="create-store-form"
              onSubmit={handleCreate}
              className="grid gap-5"
            >
              <div className="grid gap-2">
                <Label htmlFor="store-name">Mağaza adı</Label>
                <Input
                  id="store-name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  placeholder="Örn. İstanbul Mağazası"
                  autoComplete="organization"
                  disabled={isCreating}
                  autoFocus
                  required
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Dashboard ve raporlarda görünecek anlaşılır bir ad kullanın.
                </p>
              </div>
              <div className="min-h-5 text-sm" aria-live="polite">
                {createError ? (
                  <p className="text-destructive">{createError}</p>
                ) : null}
              </div>
            </form>
          </ResponsiveDialog>
        </div>
      </div>

      <div className="divide-y divide-border">
        {stores.map((store) => {
          const isActive = store.id === activeStoreId
          const isPending = pendingStoreId === store.id

          return (
            <div
              key={store.id}
              className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HugeiconsIcon icon={Store01Icon} className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {store.name}
                  </h3>
                  {isActive ? (
                    <Badge variant="success">
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        className="size-3.5"
                      />
                      Şu anda aktif
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <time dateTime={store.createdAt}>
                    {dateFormatter.format(new Date(store.createdAt))}
                  </time>{" "}
                  tarihinde eklendi
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant={isActive ? "secondary" : "outline"}
                disabled={isActive || isSwitching || isCreating}
                onClick={() => handleActivate(store)}
              >
                {isActive
                  ? "Aktif mağaza"
                  : isPending
                    ? "Değiştiriliyor..."
                    : "Aktif yap"}
              </Button>
            </div>
          )
        })}
      </div>

      <div
        className="min-h-12 border-t border-border px-5 py-3 text-sm sm:px-6"
        aria-live="polite"
      >
        {actionError ? <p className="text-destructive">{actionError}</p> : null}
        {message ? (
          <p className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
            {message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
