"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { APP_ROUTES } from "@/constants/site"
import type {
  ActivityActorFilter,
  ActivityCategory,
  ActivityPageSize,
  ActivityPeriod,
  ActivityResultFilter,
} from "@/types/activity"

type CategoryOption = { value: ActivityCategory; label: string }

export function ActivityToolbar({
  category,
  period,
  result,
  actor,
  limit,
  q,
  categories,
}: {
  category: ActivityCategory
  period: ActivityPeriod
  result: ActivityResultFilter
  actor: ActivityActorFilter
  limit: ActivityPageSize
  q: string
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paramsRef = useRef(new URLSearchParams(searchParams.toString()))
  const searchPendingRef = useRef(false)

  useEffect(() => {
    paramsRef.current = new URLSearchParams(searchParams.toString())
    if (searchRef.current?.value.trim() === q) {
      searchPendingRef.current = false
    } else if (searchRef.current && !searchPendingRef.current) {
      searchRef.current.value = q
    }
  }, [searchParams, q])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function navigate(key: string, value: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const params = new URLSearchParams(paramsRef.current.toString())
    const searchValue = searchRef.current?.value.trim().slice(0, 80) ?? ""
    if (searchValue) params.set("q", searchValue)
    else params.delete("q")
    if (key === "actor") {
      if (value === "TEAM") params.delete(key)
      else params.set(key, value)
    } else if (
      value &&
      value !== "ALL" &&
      !(key === "limit" && value === "50")
    ) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete("cursor")
    paramsRef.current = params
    const suffix = params.toString()
    router.replace(
      `${APP_ROUTES.dashboard.activity}${suffix ? `?${suffix}` : ""}`,
      {
        scroll: false,
      }
    )
  }

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (searchRef.current) searchRef.current.value = ""
    searchPendingRef.current = false
    paramsRef.current = new URLSearchParams()
    router.replace(APP_ROUTES.dashboard.activity, { scroll: false })
  }

  const hasFilters =
    category !== "ALL" ||
    period !== "ALL" ||
    result !== "ALL" ||
    actor !== "TEAM" ||
    Boolean(q) ||
    limit !== 50

  return (
    <div className="space-y-3" aria-label="İşlem filtreleri">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full sm:w-80 lg:w-72">
          <label htmlFor="activity-search" className="sr-only">
            Kayıtlarda ara
          </label>
          <Input
            ref={searchRef}
            id="activity-search"
            type="search"
            defaultValue={q}
            maxLength={80}
            placeholder="Kişi, e-posta veya işlem ara"
            icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
            className="h-9 rounded-lg bg-card shadow-none"
            onChange={(event) => {
              searchPendingRef.current = true
              const value = event.currentTarget.value
              if (timerRef.current) clearTimeout(timerRef.current)
              timerRef.current = setTimeout(
                () => navigate("q", value.trim()),
                350
              )
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Select
            value={period}
            onValueChange={(value) => navigate("period", value)}
          >
            <SelectTrigger
              aria-label="Dönem"
              className="w-40 rounded-lg border-border bg-card"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm zamanlar</SelectItem>
              <SelectItem value="DAY">Son 24 saat</SelectItem>
              <SelectItem value="WEEK">Son 7 gün</SelectItem>
              <SelectItem value="MONTH">Son 30 gün</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={result}
            onValueChange={(value) => navigate("result", value)}
          >
            <SelectTrigger
              aria-label="Durum"
              className="w-39 rounded-lg border-border bg-card"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm durumlar</SelectItem>
              <SelectItem value="SUCCESS">Tamamlandı</SelectItem>
              <SelectItem value="FAILURE">Başarısız</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={actor}
            onValueChange={(value) => navigate("actor", value)}
          >
            <SelectTrigger
              aria-label="Yapan kişi"
              className="w-40 rounded-lg border-border bg-card"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEAM">Ekip üyeleri</SelectItem>
              <SelectItem value="SYSTEM">Sistem</SelectItem>
              <SelectItem value="ALL">Tümü</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(limit)}
            onValueChange={(value) => navigate("limit", value)}
          >
            <SelectTrigger
              aria-label="Sayfa başına kayıt"
              className="w-29 rounded-lg border-border bg-card"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 kayıt</SelectItem>
              <SelectItem value="100">100 kayıt</SelectItem>
              <SelectItem value="200">200 kayıt</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters ? (
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              Temizle
            </Button>
          ) : null}
        </div>
      </div>
      <nav aria-label="İşlem türü" className="flex gap-1 overflow-x-auto pb-1">
        {categories.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={category === item.value ? "secondary" : "ghost"}
            className="shrink-0 whitespace-nowrap"
            aria-current={category === item.value ? "page" : undefined}
            onClick={() => navigate("category", item.value)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
    </div>
  )
}
