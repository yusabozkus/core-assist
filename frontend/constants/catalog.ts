export type ProductCatalogView = "standard" | "compact"

export const PRODUCT_CATALOG_VIEW_STORAGE_KEY = "coreassist:catalog-view"

export const PRODUCT_CATALOG_GRID: Record<ProductCatalogView, string> = {
  standard:
    "grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4",
  compact:
    "grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-3",
}
