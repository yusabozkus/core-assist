export type CatalogProductVariant = {
  id: string
  title: string | null
  sku: string
  barcode: string | null
  color: string | null
  size: string | null
  price: number
  currency: string
  stock: number
}

export type CatalogProduct = {
  id: string
  title: string
  description: string | null
  brand: string | null
  category: string | null
  status: "ACTIVE" | "ARCHIVED"
  updatedAt: string
  variants: CatalogProductVariant[]
  attributes: Array<{ id: string; name: string; value: string }>
  images: Array<{ id: string; url: string; position: number }>
  externalProducts: Array<{
    externalId: string
    externalUrl: string | null
    lastSyncedAt: string
    connection: { providerKey: string }
  }>
}
