"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Analytics01Icon,
  CustomerSupportIcon,
  DashboardSquare01Icon,
  InboxIcon,
  Package01Icon,
  PlugSocketIcon,
  RefreshIcon,
  Settings02Icon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { APP_ROUTES } from "@/constants/site"
import { globalSearch } from "@/lib/api/search"
import { canAccessDashboardPage } from "@/lib/dashboard-access"
import { cn } from "@/lib/utils"
import type { ProductQuestionStatus } from "@/types/question"
import type { GlobalSearchResponse } from "@/types/search"
import type { StoreAccessLevel } from "@/types/store"

const SEARCH_DEBOUNCE_MS = 250

type SearchPage = {
  title: string
  description: string
  url: string
  icon: IconSvgElement
  keywords: string
}

const SEARCH_PAGES: SearchPage[] = [
  {
    title: "Genel Bakış",
    description: "Mağaza özeti ve önemli metrikler",
    url: APP_ROUTES.dashboard.root,
    icon: DashboardSquare01Icon,
    keywords: "dashboard ana sayfa özet metrik",
  },
  {
    title: "Gelen Kutusu",
    description: "Müşteri sorularını inceleyin ve yanıtlayın",
    url: APP_ROUTES.dashboard.inbox,
    icon: InboxIcon,
    keywords: "soru cevap mesaj inbox",
  },
  {
    title: "Ürünler",
    description: "Ürün kataloğunu görüntüleyin",
    url: APP_ROUTES.dashboard.catalog.products,
    icon: Package01Icon,
    keywords: "ürün katalog sku barkod",
  },
  {
    title: "Stok Takibi",
    description: "Ürün ve varyant stoklarını takip edin",
    url: APP_ROUTES.dashboard.catalog.inventory,
    icon: Package01Icon,
    keywords: "stok envanter varyant tükenen azalan",
  },
  {
    title: "Satış Kanalları",
    description: "Pazaryeri bağlantılarını yönetin",
    url: APP_ROUTES.dashboard.channels.root,
    icon: PlugSocketIcon,
    keywords: "trendyol hepsiburada bağlantı entegrasyon",
  },
  {
    title: "Senkron Geçmişi",
    description: "Katalog ve soru senkronizasyonlarını inceleyin",
    url: APP_ROUTES.dashboard.channels.sync,
    icon: RefreshIcon,
    keywords: "senkronizasyon geçmiş hata katalog soru",
  },
  {
    title: "Yanıt Ayarları",
    description: "AI davranışını ve otomasyonu yönetin",
    url: APP_ROUTES.dashboard.automations.root,
    icon: WorkflowSquare01Icon,
    keywords: "ai yapay zeka yanıt otomasyon ton emoji talimat",
  },
  {
    title: "Mağaza Bilgileri",
    description: "AI için mağaza bilgilerini güncelleyin",
    url: APP_ROUTES.dashboard.automations.knowledge,
    icon: WorkflowSquare01Icon,
    keywords: "bilgi bankası politika sss kargo iade değişim",
  },
  {
    title: "AI Performansı",
    description: "AI yanıt kalitesini ve kullanımını inceleyin",
    url: APP_ROUTES.dashboard.analytics,
    icon: Analytics01Icon,
    keywords: "analiz performans güven taslak grafik",
  },
  {
    title: "Mağaza Ayarları",
    description: "Seçili mağazayı yönetin",
    url: APP_ROUTES.dashboard.settings.root,
    icon: Settings02Icon,
    keywords: "ayar mağaza adı arşiv sil",
  },
  {
    title: "Hesap Ayarları",
    description: "Profil ve hesap bilgilerinizi yönetin",
    url: APP_ROUTES.dashboard.settings.profile,
    icon: Settings02Icon,
    keywords: "profil kullanıcı hesap isim eposta",
  },
  {
    title: "Yardım Merkezi",
    description: "Kullanım yanıtlarını bulun ve desteğe ulaşın",
    url: APP_ROUTES.dashboard.support,
    icon: CustomerSupportIcon,
    keywords: "yardım destek sorun sss iletişim",
  },
]

type GlobalSearchProps = {
  storeId: string
  accessLevel?: StoreAccessLevel
  open: boolean
  onOpenChange: (open: boolean) => void
}

type RemoteSearchState = {
  query: string
  status: "searching" | "success" | "error"
  results: GlobalSearchResponse | null
  error: string | null
}

export function GlobalSearch({
  storeId,
  accessLevel,
  open,
  onOpenChange,
}: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState | null>(
    null
  )
  const normalizedQuery = normalizeSearchText(query)
  const searchQuery = query.trim()
  const canSearch = open && searchQuery.length >= 2
  const currentSearch =
    canSearch && remoteSearch?.query === searchQuery ? remoteSearch : null
  const results = currentSearch?.results ?? null
  const error = currentSearch?.error ?? null
  const isSearching =
    canSearch && (!currentSearch || currentSearch.status === "searching")
  const canViewInbox = canAccessDashboardPage(
    APP_ROUTES.dashboard.inbox,
    accessLevel
  )

  const pageResults = useMemo(() => {
    const accessiblePages = SEARCH_PAGES.filter((page) =>
      canAccessDashboardPage(page.url, accessLevel)
    )
    if (!normalizedQuery) return accessiblePages.slice(0, 6)

    return accessiblePages
      .filter((page) =>
        normalizeSearchText(
          `${page.title} ${page.description} ${page.keywords}`
        ).includes(normalizedQuery)
      )
      .slice(0, 5)
  }, [normalizedQuery, accessLevel])

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
        const response = await globalSearch(
          storeId,
          searchQuery,
          controller.signal
        )

        if (!controller.signal.aborted) {
          setRemoteSearch({
            query: searchQuery,
            status: "success",
            results: response,
            error: null,
          })
        }
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
  }, [canSearch, searchQuery, storeId])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery("")
      setRemoteSearch(null)
    }

    onOpenChange(nextOpen)
  }

  function navigate(url: string) {
    handleOpenChange(false)
    router.push(url)
  }

  const hasDynamicResults = Boolean(
    results &&
    (results.products.length > 0 ||
      (canViewInbox && results.questions.length > 0))
  )
  const showEmpty =
    query.trim().length >= 2 &&
    !isSearching &&
    !error &&
    pageResults.length === 0 &&
    !hasDynamicResults

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Genel arama"
      description="Sayfalara ulaşın; ürün, SKU, barkod veya müşteri sorusu arayın."
      contentClassName="sm:max-w-2xl"
      bodyClassName="p-0"
    >
      <Command shouldFilter={false} className="rounded-none bg-transparent p-0">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Ürün, SKU, barkod, soru veya sayfa ara..."
          autoFocus
        />
        <CommandList className="max-h-[min(27rem,58svh)] px-1 pb-2">
          {pageResults.length > 0 ? (
            <CommandGroup heading={query ? "Sayfalar" : "Hızlı erişim"}>
              {pageResults.map((page) => (
                <SearchItem
                  key={page.url}
                  icon={page.icon}
                  title={page.title}
                  description={page.description}
                  onSelect={() => navigate(page.url)}
                />
              ))}
            </CommandGroup>
          ) : null}

          {isSearching ? <SearchLoading /> : null}

          {!isSearching && results?.products.length ? (
            <CommandGroup heading="Ürünler">
              {results.products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`product:${product.id}`}
                  onSelect={() =>
                    navigate(
                      `${APP_ROUTES.dashboard.catalog.products}?product=${product.id}`
                    )
                  }
                  className="py-2.5"
                >
                  <ResultIcon imageUrl={product.imageUrl}>
                    <HugeiconsIcon icon={Package01Icon} className="size-4" />
                  </ResultIcon>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {product.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                      {[
                        product.brand,
                        product.category,
                        product.matchedIdentifier,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <CommandShortcut>Ürün</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {!isSearching && canViewInbox && results?.questions.length ? (
            <CommandGroup heading="Müşteri soruları">
              {results.questions.map((question) => (
                <CommandItem
                  key={question.id}
                  value={`question:${question.id}`}
                  onSelect={() =>
                    navigate(
                      `${APP_ROUTES.dashboard.inbox}?question=${question.id}`
                    )
                  }
                  className="py-2.5"
                >
                  <ResultIcon providerKey={question.providerKey}>
                    <HugeiconsIcon icon={InboxIcon} className="size-4" />
                  </ResultIcon>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {question.question}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                      {question.customerName ?? "Pazaryeri müşterisi"}
                      {question.productTitle
                        ? ` · ${question.productTitle}`
                        : ""}
                    </span>
                  </span>
                  <QuestionStatus status={question.status} />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {query.trim().length === 1 ? (
            <SearchNotice>Aramak için en az 2 karakter yazın.</SearchNotice>
          ) : null}
          {error ? <SearchNotice error>{error}</SearchNotice> : null}
          {showEmpty ? (
            <SearchNotice>
              “{query.trim()}” için ürün, soru veya sayfa bulunamadı.
            </SearchNotice>
          ) : null}
        </CommandList>
      </Command>
    </ResponsiveDialog>
  )
}

function SearchItem({
  icon,
  title,
  description,
  onSelect,
}: {
  icon: IconSvgElement
  title: string
  description: string
  onSelect: () => void
}) {
  return (
    <CommandItem value={`page:${title}`} onSelect={onSelect} className="py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
          {description}
        </span>
      </span>
      <CommandShortcut>Sayfa</CommandShortcut>
    </CommandItem>
  )
}

function ResultIcon({
  providerKey,
  imageUrl,
  children,
}: {
  providerKey?: string | null
  imageUrl?: string | null
  children: React.ReactNode
}) {
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card text-muted-foreground">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="36px"
          className="object-cover"
        />
      ) : providerKey ? (
        <ProviderLogo
          provider={providerKey}
          className="size-7 rounded-md border-0 shadow-none"
          imageClassName="size-4"
        />
      ) : (
        children
      )}
    </span>
  )
}

function QuestionStatus({ status }: { status: ProductQuestionStatus }) {
  const details: Record<
    ProductQuestionStatus,
    { label: string; className: string }
  > = {
    PENDING: {
      label: "Bekliyor",
      className: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    DRAFTED: {
      label: "İncelemede",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    ANSWERED: {
      label: "Yanıtlandı",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    IGNORED: {
      label: "Engellendi",
      className: "bg-muted text-muted-foreground",
    },
  }

  return (
    <span
      className={cn(
        "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        details[status].className
      )}
    >
      {details[status].label}
    </span>
  )
}

function SearchLoading() {
  return (
    <div className="space-y-2 px-3 py-4" aria-label="Aranıyor">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex animate-pulse items-center gap-3">
          <span className="size-9 rounded-lg bg-muted" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3 w-2/3 rounded bg-muted" />
            <span className="block h-2.5 w-1/2 rounded bg-muted/70" />
          </span>
        </div>
      ))}
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
