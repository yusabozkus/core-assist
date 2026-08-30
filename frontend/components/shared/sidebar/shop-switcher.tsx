"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpDownIcon,
  CheckmarkCircle01Icon,
  PlusSignIcon,
  RefreshIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { selectActiveStore } from "@/app/(dashboard)/dashboard/actions"
import { APP_ROUTES } from "@/constants/site"
import { createStore } from "@/lib/api/stores"
import type { StoreSummary } from "@/types/store"

export type SidebarShop = StoreSummary

export function ShopSwitcher({
  shops,
  activeShopId,
}: {
  shops: SidebarShop[]
  activeShopId: string
}) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [selectedShopId, setSelectedShopId] = React.useState(activeShopId)
  const [selectionError, setSelectionError] = React.useState<string | null>(
    null
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [storeName, setStoreName] = React.useState("")
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [createdStore, setCreatedStore] = React.useState<StoreSummary | null>(
    null
  )
  const [isCreating, setIsCreating] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const activeShop =
    shops.find((shop) => shop.id === selectedShopId) ?? shops[0]

  function handleShopChange(shop: SidebarShop) {
    if (shop.id === selectedShopId || isPending) return

    const previousShopId = selectedShopId
    setSelectedShopId(shop.id)
    setSelectionError(null)

    startTransition(async () => {
      try {
        await selectActiveStore(shop.id)
        router.refresh()
      } catch {
        setSelectedShopId(previousShopId)
        setSelectionError("Mağaza değiştirilemedi.")
      }
    })
  }

  function handleCreateDialogChange(open: boolean) {
    if (!open && isCreating) return

    setIsCreateDialogOpen(open)

    if (!open) {
      setStoreName("")
      setCreateError(null)
      setCreatedStore(null)
    }
  }

  async function handleCreateStore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedName = storeName.trim()
    if (!createdStore && normalizedName.length < 2) {
      setCreateError("Mağaza adı en az 2 karakter olmalıdır.")
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      const store =
        createdStore ?? (await createStore({ name: normalizedName }))

      if (!createdStore) {
        setCreatedStore(store)
      }

      await selectActiveStore(store.id)
      setSelectedShopId(store.id)
      setIsCreateDialogOpen(false)
      setStoreName("")
      setCreatedStore(null)
      router.push(APP_ROUTES.dashboard.channels.root)
      router.refresh()
    } catch (caughtError) {
      setCreateError(
        caughtError instanceof Error
          ? caughtError.message
          : createdStore
            ? "Mağaza oluşturuldu ancak aktif hale getirilemedi. Tekrar deneyin."
            : "Mağaza oluşturulamadı. Lütfen tekrar deneyin."
      )
    } finally {
      setIsCreating(false)
    }
  }

  if (!activeShop) return null

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <HugeiconsIcon icon={Store01Icon} className="size-4" />
                </div>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {activeShop.name}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {isPending ? "Değiştiriliyor..." : "Aktif mağaza"}
                  </span>
                </div>
                <HugeiconsIcon
                  icon={ArrowUpDownIcon}
                  className="ml-auto size-4"
                />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={6}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Mağazalar
              </DropdownMenuLabel>
              {shops.map((shop) => (
                <DropdownMenuItem
                  key={shop.id}
                  onClick={() => handleShopChange(shop)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-7 items-center justify-center rounded-lg border bg-background">
                    <HugeiconsIcon icon={Store01Icon} className="size-3.5" />
                  </div>
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">
                      {shop.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {shop.id === selectedShopId
                        ? "Şu anda aktif"
                        : "Geçiş yap"}
                    </span>
                  </div>
                  {shop.id === selectedShopId ? (
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      className="ml-auto size-4 text-primary"
                    />
                  ) : null}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              {selectionError ? (
                <p className="px-2 py-1 text-xs text-destructive" role="alert">
                  {selectionError}
                </p>
              ) : null}
              <DropdownMenuItem
                className="gap-2 p-2"
                onSelect={() => setIsCreateDialogOpen(true)}
              >
                <div className="flex size-7 items-center justify-center rounded-lg border bg-background">
                  <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                </div>
                <span>Mağaza ekle</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <ResponsiveDialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogChange}
        preventClose={isCreating}
        title="Yeni mağaza ekle"
        description="Mağazanız için bir ad belirleyin. Oluşturulduktan sonra aktif mağaza olarak seçilecektir."
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
              form="sidebar-create-store-form"
              disabled={
                isCreating || (!createdStore && storeName.trim().length < 2)
              }
            >
              {isCreating ? (
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className="size-4 animate-spin"
                />
              ) : (
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
              )}
              {isCreating
                ? "Mağaza oluşturuluyor..."
                : createdStore
                  ? "Aktif seçmeyi tekrar dene"
                  : "Mağazayı oluştur"}
            </Button>
          </>
        )}
      >
        <form
          id="sidebar-create-store-form"
          onSubmit={handleCreateStore}
          className="grid gap-5"
        >
          <div className="grid gap-2">
            <Label htmlFor="sidebar-store-name">Mağaza adı</Label>
            <Input
              id="sidebar-store-name"
              name="name"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              minLength={2}
              maxLength={80}
              placeholder="Örn. North Clothing"
              autoComplete="organization"
              disabled={isCreating || Boolean(createdStore)}
              autoFocus
              required
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Bu ad sidebar, kanal bağlantıları ve raporlarda kullanılacaktır.
            </p>
          </div>

          <div className="min-h-5 text-sm" aria-live="polite">
            {createError ? (
              <p className="text-destructive">{createError}</p>
            ) : null}
          </div>
        </form>
      </ResponsiveDialog>
    </>
  )
}
