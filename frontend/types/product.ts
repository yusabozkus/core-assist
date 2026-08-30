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
  status: "ACTIVE" | "OUT_OF_STOCK" | "UNAVAILABLE" | "ARCHIVED"
  sourceUpdatedAt: string | null
  lastSyncedAt: string | null
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
    status: "ACTIVE" | "ARCHIVED" | "UNAVAILABLE"
    lastSyncedAt: string
    connection: { providerKey: string }
  }>
}

export type CatalogProductListItem = {
  id: string
  title: string
  brand: string | null
  category: string | null
  status: "ACTIVE" | "ARCHIVED"
  updatedAt: string
  imageUrl: string | null
  variantCount: number
  totalStock: number
  minimumPrice: number | null
  maximumPrice: number | null
  currency: string
  providers: Array<{
    providerKey: string
    status: "ACTIVE" | "ARCHIVED" | "UNAVAILABLE"
  }>
}

export type CatalogSummary = {
  products: number
  variants: number
  totalStock: number
}

export type CatalogProductPage = {
  items: CatalogProductListItem[]
  nextCursor: string | null
  total: number
  summary: CatalogSummary
}
