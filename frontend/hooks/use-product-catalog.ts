"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { getCatalogProducts } from "@/lib/api/catalog"
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
  const lastLoadedKey = useRef(firstKey)
  const controllerRef = useRef<AbortController | null>(null)
  const pageRef = useRef(page)
  const requestKey = `${storeId}|${provider}|${query.trim()}|${revision}`
  const isFiltering =
    query.trim() !== loadedFilters.query || provider !== loadedFilters.provider

  useEffect(() => {
    pageRef.current = page
  }, [page])

  useEffect(() => {
    controllerRef.current?.abort()
    if (requestKey === lastLoadedKey.current) {
      setLoading(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller
    const normalizedQuery = query.trim()
    const replacing = isFiltering
    setLoading(replacing ? "replace" : "refresh")
    setError(null)

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
            signal: controller.signal,
          })
          while (result.nextCursor && result.items.length < targetCount) {
            const next = await getCatalogProducts(storeId, {
              query: normalizedQuery,
              provider,
              limit: Math.min(50, targetCount - result.items.length),
              cursor: result.nextCursor,
              signal: controller.signal,
            })
            result = { ...next, items: [...result.items, ...next.items] }
          }
          if (controller.signal.aborted) return
          lastLoadedKey.current = requestKey
          setPage(result)
          setLoadedFilters({ query: normalizedQuery, provider })
        } catch (caught) {
          if (!controller.signal.aborted)
            setError(
              caught instanceof Error ? caught.message : "Ürünler yüklenemedi."
            )
        } finally {
          if (!controller.signal.aborted) setLoading(null)
        }
      },
      replacing ? 300 : 0
    )

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [requestKey, storeId, query, provider, revision, isFiltering])

  useEffect(() => () => controllerRef.current?.abort(), [])

  const loadMore = useCallback(async () => {
    if (
      !page.nextCursor ||
      loading ||
      error ||
      isFiltering ||
      requestKey !== lastLoadedKey.current
    )
      return
    if (controllerRef.current && !controllerRef.current.signal.aborted)
      controllerRef.current.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading("more")
    setError(null)
    try {
      const result = await getCatalogProducts(storeId, {
        cursor: page.nextCursor,
        query: loadedFilters.query,
        provider: loadedFilters.provider,
        limit: PAGE_SIZE,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
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
      if (!controller.signal.aborted)
        setError(
          caught instanceof Error
            ? caught.message
            : "Diğer ürünler yüklenemedi."
        )
    } finally {
      if (!controller.signal.aborted) setLoading(null)
    }
  }, [
    page.nextCursor,
    loading,
    error,
    isFiltering,
    requestKey,
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
