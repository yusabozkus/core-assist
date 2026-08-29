import { Badge } from "@/components/ui/badge"
import { StoreManagement } from "./store-management"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function StoresPage() {
  const { stores, activeStore } = await getActiveStoreContext()

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="mb-8">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Mağazalar
          </h1>
          <Badge variant="default" className="bg-white border border-border">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {stores.filter((store) => store.status === "ACTIVE").length} aktif
          </Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Satış operasyonlarınızı ayrı mağazalarda yönetin ve dashboard üzerinde
          çalışacağınız mağazayı seçin.
        </p>
      </div>

      <StoreManagement
        stores={stores}
        activeStoreId={activeStore?.id ?? null}
      />
    </div>
  )
}
