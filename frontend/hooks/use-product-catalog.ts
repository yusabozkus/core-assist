"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { getCatalogProducts } from "@/lib/api/catalog"
import { useListRequests } from "@/hooks/use-list-requests"
import type { CatalogProductPage } from "@/types/product"

const PAGE_SIZE = 12

export function useProductCatalog(
  storeId: string,
  initialPage: CatalogProductPage
) {
  const [query, setQuery] = useState("")
  const [provider, setProvider] = useState("ALL")
  const [page, setPage] = useState(initialPage)
  const [loadedFilters, setLoadedFilters] = useState({
    query: "",
    provider: "ALL",
  })
  const [loading, setLoading] = useState<"replace" | "more" | "refresh" | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const firstKey = `${storeId}|ALL||0`
  const pageRef = useRef(page)
  const normalizedQuery = query.trim()
  const requestKey = `${storeId}|${provider}|${normalizedQuery}|${revision}`
  const requests = useListRequests(requestKey, firstKey)
  const isFiltering =
    normalizedQuery !== loadedFilters.query ||
    provider !== loadedFilters.provider

  useEffect(() => {
    pageRef.current = page
  }, [page])

  useEffect(() => {
    let disposed = false
    const request = requests.isReady(requestKey)
      ? null
      : requests.begin(requestKey, "first")
    const replacing = isFiltering
    queueMicrotask(() => {
      if (disposed) return
      setLoading(request ? (replacing ? "replace" : "refresh") : null)
      setError(null)
    })
    if (!request)
      return () => {
        disposed = true
      }

    const timeout = window.setTimeout(
      async () => {
        try {
          // Refresh all visible pages so stock updates do not discard loaded products.
          const targetCount = replacing
            ? PAGE_SIZE
            : Math.max(PAGE_SIZE, pageRef.current.items.length)
          let result = await getCatalogProducts(storeId, {
            query: normalizedQuery,
            provider,
            limit: Math.min(50, targetCount),
            signal: request.signal,
          })
          while (result.nextCursor && result.items.length < targetCount) {
            if (!requests.isCurrent(request)) return
            const next = await getCatalogProducts(storeId, {
              query: normalizedQuery,
              provider,
              limit: Math.min(50, targetCount - result.items.length),
              cursor: result.nextCursor,
              signal: request.signal,
            })
            result = { ...next, items: [...result.items, ...next.items] }
          }
          if (!requests.commit(request)) return
          setPage(result)
          setLoadedFilters({ query: normalizedQuery, provider })
        } catch (caught) {
          if (requests.isCurrent(request))
            setError(
              caught instanceof Error ? caught.message : "Ürünler yüklenemedi."
            )
        } finally {
          if (requests.finish(request)) setLoading(null)
        }
      },
      replacing ? 300 : 0
    )

    return () => {
      disposed = true
      window.clearTimeout(timeout)
      requests.cancel(request)
    }
  }, [
    requestKey,
    requests,
    storeId,
    normalizedQuery,
    provider,
    revision,
    isFiltering,
  ])

  const loadMore = useCallback(async () => {
    if (!page.nextCursor || loading || error || isFiltering) return
    const request = requests.begin(requestKey, "more")
    if (!request) return
    setLoading("more")
    setError(null)
    try {
      const result = await getCatalogProducts(storeId, {
        cursor: page.nextCursor,
        query: loadedFilters.query,
        provider: loadedFilters.provider,
        limit: PAGE_SIZE,
        signal: request.signal,
      })
      if (!requests.isCurrent(request)) return
      setPage((current) => ({
        ...result,
        items: [
          ...new Map(
            [...current.items, ...result.items].map((product) => [
              product.id,
              product,
            ])
          ).values(),
        ],
      }))
    } catch (caught) {
      if (requests.isCurrent(request))
        setError(
          caught instanceof Error
            ? caught.message
            : "Diğer ürünler yüklenemedi."
        )
    } finally {
      if (requests.finish(request)) setLoading(null)
    }
  }, [
    page.nextCursor,
    loading,
    error,
    isFiltering,
    requestKey,
    requests,
    loadedFilters,
    storeId,
  ])

  const refresh = useCallback(() => setRevision((current) => current + 1), [])

  return {
    query,
    setQuery,
    provider,
    setProvider,
    page,
    loading,
    error,
    loadedFilters,
    loadMore,
    refresh,
    revision,
    isFiltering,
  }
}
