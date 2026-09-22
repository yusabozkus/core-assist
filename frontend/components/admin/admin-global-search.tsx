"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CreditCardIcon,
  CustomerSupportIcon,
  Loading03Icon,
  RefreshIcon,
  SearchIcon,
  Store01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { ADMIN_SEARCH_NAVIGATION } from "@/constants/admin"
import { APP_ROUTES } from "@/constants/site"
import { searchAdmin } from "@/lib/api/admin-search"
import { cn } from "@/lib/utils"
import type { AdminSearchResponse } from "@/types/admin-search"

const SEARCH_DEBOUNCE_MS = 250

type RemoteSearchState = {
  query: string
  status: "searching" | "success" | "error"
  results: AdminSearchResponse | null
  error: string | null
}

export function AdminGlobalSearch({ className }: { className?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState | null>(
    null
  )
  const searchQuery = query.trim()
  const normalizedQuery = normalizeSearchText(searchQuery)
  const canSearch = open && searchQuery.length >= 2
  const currentSearch =
    canSearch && remoteSearch?.query === searchQuery ? remoteSearch : null
  const results = currentSearch?.results ?? null
  const error = currentSearch?.error ?? null
  const isSearching =
    canSearch && (!currentSearch || currentSearch.status === "searching")

  const pageResults = useMemo(() => {
    if (!normalizedQuery) return ADMIN_SEARCH_NAVIGATION.slice(0, 6)
    return ADMIN_SEARCH_NAVIGATION.filter((item) =>
      normalizeSearchText(`${item.title} ${item.description}`).includes(
        normalizedQuery
      )
    ).slice(0, 5)
  }, [normalizedQuery])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLocaleLowerCase("tr-TR") !== "k") return
      if (!event.metaKey && !event.ctrlKey) return

      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!canSearch) return

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setRemoteSearch({
        query: searchQuery,
        status: "searching",
        results: null,
        error: null,
      })

      try {
        const response = await searchAdmin(searchQuery, controller.signal)
        if (controller.signal.aborted) return
        setRemoteSearch({
          query: searchQuery,
          status: "success",
          results: response,
          error: null,
        })
      } catch (caughtError) {
        if (controller.signal.aborted) return
        setRemoteSearch({
          query: searchQuery,
          status: "error",
          results: null,
          error:
            caughtError instanceof Error
              ? caughtError.message
              : "Arama şu anda tamamlanamadı.",
        })
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [canSearch, searchQuery])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery("")
      setRemoteSearch(null)
    }
    setOpen(nextOpen)
  }

  function navigate(url: string) {
    handleOpenChange(false)
    router.push(url)
  }

  const hasRemoteResults = Boolean(
    results &&
    (results.accounts.length ||
      results.stores.length ||
      results.tickets.length ||
      results.syncRuns.length ||
      results.paddleRecords.length)
  )
  const showEmpty =
    canSearch &&
    !isSearching &&
    !error &&
    pageResults.length === 0 &&
    !hasRemoteResults

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-9 w-full items-center gap-2 rounded-xl border border-border/80 bg-card/70 px-3 text-left text-sm text-muted-foreground shadow-xs transition-colors hover:border-border hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className
        )}
        aria-label="Yönetim panelinde ara"
      >
        <HugeiconsIcon
          icon={SearchIcon}
          strokeWidth={2}
          className="size-4 shrink-0"
        />
        <span className="min-w-0 flex-1 truncate">
          Müşteri, ticket veya Paddle kaydı ara
        </span>
        <kbd className="hidden h-5 items-center rounded-md border border-border bg-muted px-1.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline-flex">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Admin genel arama"
        description="Müşteri hesaplarını, mağazaları, ticketları, senkronizasyonları ve Paddle kayıtlarını bulun."
        className="sm:max-w-2xl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="E-posta, müşteri, mağaza, ticket veya Paddle ID ara..."
          />
          <CommandList className="max-h-[min(30rem,65svh)] px-1 pb-2">
            {pageResults.length ? (
              <CommandGroup heading={query ? "Sayfalar" : "Hızlı erişim"}>
                {pageResults.map((item) => (
                  <SearchResultItem
                    key={item.url}
                    icon={item.icon}
                    title={item.title}
                    description={item.description}
                    shortcut="Sayfa"
                    value={`page:${item.url}`}
                    onSelect={() => navigate(item.url)}
                  />
                ))}
              </CommandGroup>
            ) : null}

            {isSearching ? <SearchLoading /> : null}

            {!isSearching && results?.accounts.length ? (
              <CommandGroup heading="Müşteri hesapları">
                {results.accounts.map((account) => {
                  const matchedMember =
                    account.matchedMember?.email !== account.ownerEmail
                      ? account.matchedMember
                      : null
                  return (
                    <SearchResultItem
                      key={account.id}
                      icon={UserGroupIcon}
                      title={account.name}
                      description={
                        matchedMember
                          ? `${matchedMember.name} · ${matchedMember.email}`
                          : `${account.ownerName} · ${account.ownerEmail} · ${account.storeCount} mağaza`
                      }
                      shortcut="Müşteri"
                      value={`account:${account.id}`}
                      onSelect={() =>
                        navigate(APP_ROUTES.admin.customer(account.id))
                      }
                    />
                  )
                })}
              </CommandGroup>
            ) : null}

            {!isSearching && results?.stores.length ? (
              <CommandGroup heading="Mağazalar">
                {results.stores.map((store) => (
                  <SearchResultItem
                    key={store.id}
                    icon={Store01Icon}
                    title={store.name}
                    description={`${store.workspaceName} · ${store.ownerEmail}`}
                    shortcut={store.status === "ACTIVE" ? "Aktif" : "Pasif"}
                    value={`store:${store.id}`}
                    onSelect={() =>
                      navigate(APP_ROUTES.admin.customer(store.workspaceId))
                    }
                  />
                ))}
              </CommandGroup>
            ) : null}

            {!isSearching && results?.tickets.length ? (
              <CommandGroup heading="Destek talepleri">
                {results.tickets.map((ticket) => (
                  <SearchResultItem
                    key={ticket.id}
                    icon={CustomerSupportIcon}
                    title={`${ticket.code} · ${ticket.subject}`}
                    description={`${ticket.workspaceName}${ticket.storeName ? ` · ${ticket.storeName}` : ""}`}
                    shortcut={supportStatusLabel(ticket.status)}
                    value={`ticket:${ticket.id}`}
                    onSelect={() =>
                      navigate(APP_ROUTES.admin.supportTicket(ticket.id))
                    }
                  />
                ))}
              </CommandGroup>
            ) : null}

            {!isSearching && results?.syncRuns.length ? (
              <CommandGroup heading="Senkronizasyonlar">
                {results.syncRuns.map((run) => (
                  <SearchResultItem
                    key={run.id}
                    icon={RefreshIcon}
                    title={`Senkronizasyon ${shortId(run.id)}`}
                    description={`${run.storeName} · ${providerLabel(run.providerKey)} · ${syncKindLabel(run.kind)}`}
                    shortcut={syncStatusLabel(run.status)}
                    value={`sync:${run.id}`}
                    onSelect={() =>
                      navigate(
                        `${APP_ROUTES.admin.operations}?q=${encodeURIComponent(run.id)}`
                      )
                    }
                  />
                ))}
              </CommandGroup>
            ) : null}

            {!isSearching && results?.paddleRecords.length ? (
              <CommandGroup heading="Paddle kayıtları">
                {results.paddleRecords.map((record) => (
                  <SearchResultItem
                    key={record.id}
                    icon={CreditCardIcon}
                    title={record.reference}
                    description={`${paddleKindLabel(record.kind)} · ${record.workspaceName} · ${record.ownerEmail}`}
                    shortcut={record.plan ?? "Paddle"}
                    value={`paddle:${record.id}`}
                    mono
                    onSelect={() =>
                      navigate(
                        APP_ROUTES.admin.billingWorkspace(record.workspaceId)
                      )
                    }
                  />
                ))}
              </CommandGroup>
            ) : null}

            {searchQuery.length === 1 ? (
              <SearchNotice>Aramak için en az 2 karakter yazın.</SearchNotice>
            ) : null}
            {error ? <SearchNotice error>{error}</SearchNotice> : null}
            {showEmpty ? (
              <SearchNotice>
                “{searchQuery}” için yönetim kaydı bulunamadı.
              </SearchNotice>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

function SearchResultItem({
  icon,
  title,
  description,
  shortcut,
  value,
  mono = false,
  onSelect,
}: {
  icon: IconSvgElement
  title: string
  description: string
  shortcut: string
  value: string
  mono?: boolean
  onSelect: () => void
}) {
  return (
    <CommandItem value={value} onSelect={onSelect} className="py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-medium",
            mono && "font-mono text-xs"
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
          {description}
        </span>
      </span>
      <CommandShortcut>{shortcut}</CommandShortcut>
    </CommandItem>
  )
}

function SearchLoading() {
  return (
    <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
      <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
      Kayıtlar aranıyor
    </div>
  )
}

function SearchNotice({
  children,
  error = false,
}: {
  children: React.ReactNode
  error?: boolean
}) {
  return (
    <div
      className={cn(
        "px-5 py-10 text-center text-sm text-muted-foreground",
        error && "text-destructive"
      )}
    >
      {children}
    </div>
  )
}

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .trim()
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

function supportStatusLabel(
  status: AdminSearchResponse["tickets"][number]["status"]
) {
  if (status === "OPEN") return "Açık"
  if (status === "IN_PROGRESS") return "İnceleniyor"
  if (status === "WAITING_CUSTOMER") return "Müşteri bekleniyor"
  if (status === "RESOLVED") return "Çözüldü"
  return "Kapalı"
}

function syncStatusLabel(
  status: AdminSearchResponse["syncRuns"][number]["status"]
) {
  if (status === "RUNNING") return "Çalışıyor"
  if (status === "COMPLETED") return "Tamamlandı"
  return "Başarısız"
}

function syncKindLabel(kind: AdminSearchResponse["syncRuns"][number]["kind"]) {
  if (kind === "FULL") return "Katalog"
  if (kind === "INVENTORY") return "Stok"
  return "Sorular"
}

function paddleKindLabel(
  kind: AdminSearchResponse["paddleRecords"][number]["kind"]
) {
  if (kind === "CUSTOMER") return "Müşteri kimliği"
  if (kind === "SUBSCRIPTION") return "Abonelik kimliği"
  if (kind === "TRANSACTION") return "İşlem kimliği"
  return "Fiyat kimliği"
}

function providerLabel(providerKey: string) {
  if (providerKey.toLocaleLowerCase("tr-TR") === "trendyol") return "Trendyol"
  if (providerKey.toLocaleLowerCase("tr-TR") === "hepsiburada") {
    return "Hepsiburada"
  }
  return providerKey
}
