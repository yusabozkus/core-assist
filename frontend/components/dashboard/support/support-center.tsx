"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Clock01Icon,
  CustomerSupportIcon,
  InboxIcon,
  PlusSignIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useBillingUsage } from "@/components/dashboard/billing/billing-usage-provider"
import { CreateSupportTicketDialog } from "@/components/dashboard/support/create-support-ticket-dialog"
import { SupportTicketsPanel } from "@/components/dashboard/support/support-tickets-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { APP_ROUTES } from "@/constants/site"
import { canAccessDashboardPage } from "@/lib/dashboard-access"
import { cn } from "@/lib/utils"
import type { StoreBillingUsageOverview } from "@/types/billing"
import type { StoreAccessLevel } from "@/types/store"
import type {
  SupportTicketDetail,
  SupportTicketList,
  SupportTicketSummary,
} from "@/types/support"

type SupportCategory = "all" | "channels" | "ai" | "catalog" | "account"

type SupportArticle = {
  id: string
  category: Exclude<SupportCategory, "all">
  title: string
  summary: string
  answer: string
  action?: { label: string; href: string }
}

const categories: Array<{ value: SupportCategory; label: string }> = [
  { value: "all", label: "Tümü" },
  { value: "channels", label: "Kanallar" },
  { value: "ai", label: "AI ve Gelen Kutusu" },
  { value: "catalog", label: "Ürün ve Stok" },
  { value: "account", label: "Hesap ve Ödeme" },
]

const articles: SupportArticle[] = [
  {
    id: "connect-channel",
    category: "channels",
    title: "Pazaryeri bağlantısını nasıl kurarım?",
    summary: "Trendyol veya Hepsiburada hesabınızı mağazanıza bağlayın.",
    answer:
      "Bağlı Kanallar sayfasından pazaryerinizi seçin ve istenen mağaza bilgilerini girin. Bağlantı doğrulandıktan sonra ilk katalog ve soru senkronizasyonunu aynı sayfadan başlatabilirsiniz.",
    action: {
      label: "Bağlı Kanallara git",
      href: APP_ROUTES.dashboard.channels.root,
    },
  },
  {
    id: "sync-status",
    category: "channels",
    title: "Senkronizasyon neden tamamlanmadı?",
    summary: "Bekleyen veya başarısız kanal işlemlerini kontrol edin.",
    answer:
      "Büyük katalogların ilk aktarımı birkaç dakika sürebilir. İşlem başarısızsa Senkron Geçmişi'ndeki hata ayrıntısını kontrol edin ve yeniden deneyin. Devam eden hatalarda işlem kimliğini destek talebinize ekleyin.",
    action: {
      label: "Senkron geçmişini aç",
      href: APP_ROUTES.dashboard.channels.sync,
    },
  },
  {
    id: "draft-not-created",
    category: "ai",
    title: "AI neden taslak oluşturmadı?",
    summary: "Kota, ürün eşleşmesi ve eksik bilgi durumlarını inceleyin.",
    answer:
      "Taslak; soru ilgili ürünle eşleşmediğinde, gerekli ürün bilgisi bulunmadığında veya AI soru kotası dolduğunda bekleyebilir. Sorunun durumunu Gelen Kutusu'nda açarak sistemin bekleme nedenini görebilirsiniz.",
    action: { label: "Gelen Kutusunu aç", href: APP_ROUTES.dashboard.inbox },
  },
  {
    id: "auto-send",
    category: "ai",
    title: "Bir yanıt neden otomatik gönderilmedi?",
    summary: "Güven eşiği ve inceleme kurallarının nasıl çalıştığını görün.",
    answer:
      "Yanıt güven eşiğinin altındaysa, kritik bir konu içeriyorsa veya doğrulanması gereken bilgi eksikse otomatik gönderilmez. Bu davranışı Yanıt Ayarları'ndan değiştirebilirsiniz; riskli yanıtlar yine incelemeye ayrılır.",
    action: {
      label: "Yanıt ayarlarını aç",
      href: APP_ROUTES.dashboard.automations.root,
    },
  },
  {
    id: "stock-difference",
    category: "catalog",
    title: "Stok bilgisi neden pazaryerinden farklı?",
    summary: "Son kontrol zamanı ve ortak stok politikasını doğrulayın.",
    answer:
      "Stok değeri son başarılı senkronizasyondaki bilgiyi gösterir. Önce stokları güncelleyin; ürün iki kanalda satılıyorsa mağazanın ortak veya kanala özel stok politikasının doğru seçildiğinden emin olun.",
    action: {
      label: "Stok Takibini aç",
      href: APP_ROUTES.dashboard.catalog.inventory,
    },
  },
  {
    id: "shared-products",
    category: "catalog",
    title: "İki pazaryerindeki aynı ürün nasıl eşleşir?",
    summary: "Ortak ürün ve kanal kayıtlarının nasıl gösterildiğini öğrenin.",
    answer:
      "Aynı barkod veya güvenilir ürün kimliğiyle gelen kayıtlar tek katalog ürünü altında birleştirilir. Ürün kartında bağlı iki pazaryeri de görünür; fiyat ve stok bilgileri seçtiğiniz stok politikasına göre yönetilir.",
    action: {
      label: "Ürünleri görüntüle",
      href: APP_ROUTES.dashboard.catalog.products,
    },
  },
  {
    id: "plan-limits",
    category: "account",
    title: "Plan limitime ulaşırsam ne olur?",
    summary: "AI kotası ile mağaza, kullanıcı ve ürün limitlerini ayırt edin.",
    answer:
      "AI kotası dolduğunda yeni soruları almaya ve manuel yanıtlamaya devam edebilirsiniz; yeni AI taslakları dönem yenilenene veya plan yükseltilene kadar durur. Diğer limitler yeni mağaza, kullanıcı veya aktif ürün eklenmesini sınırlar.",
    action: {
      label: "Plan kullanımını gör",
      href: APP_ROUTES.dashboard.settings.billing,
    },
  },
  {
    id: "invoices",
    category: "account",
    title: "Faturalarımı ve aboneliğimi nereden yönetirim?",
    summary: "Plan, ödeme yöntemi ve fatura kayıtlarına ulaşın.",
    answer:
      "Plan ve Faturalama sayfasında mevcut planınızı, kullanımınızı ve yenileme durumunu görebilirsiniz. Faturalar sekmesinden tamamlanan ödemelerin belgelerine ulaşabilirsiniz.",
    action: {
      label: "Plan ve Faturalama'yı aç",
      href: APP_ROUTES.dashboard.settings.billing,
    },
  },
]

const planSupport: Record<
  StoreBillingUsageOverview["plan"],
  { name: string; level: string; responseTarget: string; setupCall: boolean }
> = {
  STARTER: {
    name: "Starter",
    level: "Standart ticket desteği",
    responseTarget: "2 iş günü",
    setupCall: false,
  },
  GROWTH: {
    name: "Growth",
    level: "Öncelikli ticket desteği",
    responseTarget: "1 iş günü",
    setupCall: false,
  },
  BUSINESS: {
    name: "Business",
    level: "Öncelikli destek",
    responseTarget: "Aynı iş günü",
    setupCall: true,
  },
}

export function SupportCenter({
  storeId,
  storeName,
  accessLevel,
  initialView,
  initialTickets,
}: {
  storeId: string | null
  storeName: string | null
  accessLevel?: StoreAccessLevel
  initialView: "help" | "tickets"
  initialTickets: SupportTicketList
}) {
  const router = useRouter()
  const { usage } = useBillingUsage()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<SupportCategory>("all")
  const [openArticleId, setOpenArticleId] = useState<string | null>(null)
  const [view, setView] = useState(initialView)
  const [tickets, setTickets] = useState(initialTickets)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const support = planSupport[usage?.plan ?? "STARTER"]
  const normalizedQuery = normalizeSearch(query)

  const visibleArticles = useMemo(
    () =>
      articles.filter((article) => {
        if (category !== "all" && article.category !== category) return false
        if (!normalizedQuery) return true

        return normalizeSearch(
          `${article.title} ${article.summary} ${article.answer}`
        ).includes(normalizedQuery)
      }),
    [category, normalizedQuery]
  )

  const activeTicketCount =
    tickets.counts.OPEN +
    tickets.counts.IN_PROGRESS +
    tickets.counts.WAITING_CUSTOMER

  function changeView(nextView: "help" | "tickets") {
    setView(nextView)
    router.replace(
      nextView === "tickets"
        ? "/dashboard/support?view=tickets"
        : "/dashboard/support",
      { scroll: false }
    )
  }

  function handleCreated(ticket: SupportTicketDetail) {
    setTickets((current) => mergeTicket(current, ticket))
    router.push(`/dashboard/support/tickets/${ticket.id}`)
  }

  const pageHeader = (
    <>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-primary">Yardım Merkezi</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Size nasıl yardımcı olabiliriz?
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Kullanım yanıtlarını bulun veya destek ekibiyle doğrudan iletişime
            geçin.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          Yeni destek talebi
        </Button>
      </header>

      <div className="mt-7 flex border-b border-border">
        <ViewTab active={view === "help"} onClick={() => changeView("help")}>
          Yardım konuları
        </ViewTab>
        <ViewTab
          active={view === "tickets"}
          onClick={() => changeView("tickets")}
        >
          Destek taleplerim
          {activeTicketCount ? (
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {activeTicketCount}
            </span>
          ) : null}
        </ViewTab>
      </div>

      <CreateSupportTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        storeId={storeId}
        storeName={storeName}
        onCreated={handleCreated}
      />
    </>
  )

  if (view === "tickets") {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        {pageHeader}
        <SupportTicketsPanel tickets={tickets} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      {pageHeader}

      <section className="relative mt-7 overflow-hidden rounded-2xl border border-border bg-card px-5 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-primary/7 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold tracking-wide text-primary">
            BİLGİ MERKEZİ
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
            Aradığınız cevaba hızlıca ulaşın
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Kurulumdan günlük kullanıma kadar Core Asistan ile ilgili en çok
            ihtiyaç duyulan yanıtları tek yerde bulabilirsiniz.
          </p>
          <div className="mt-6 max-w-2xl">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kanal, senkronizasyon, AI veya fatura ara..."
              aria-label="Yardım konularında ara"
              icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
              endIcon={
                query ? (
                  <button
                    type="button"
                    className="pointer-events-auto flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => setQuery("")}
                    aria-label="Aramayı temizle"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                  </button>
                ) : null
              }
              className="h-12 bg-background shadow-sm"
            />
          </div>
        </div>
      </section>

      <div className="mt-10">
        <section className="min-w-0">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Yardım konuları
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                En sık karşılaşılan işlemler için adım adım kısa çözümler.
              </p>
            </div>
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 sm:max-w-[520px]">
              {categories.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                    category === item.value
                      ? "bg-card text-foreground shadow-sm dark:bg-primary/15 dark:text-primary dark:shadow-none dark:ring-1 dark:ring-primary/25"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {visibleArticles.map((article) => {
              const isOpen = openArticleId === article.id

              return (
                <article
                  key={article.id}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow]",
                    isOpen
                      ? "border-primary/20 shadow-sm"
                      : "border-border hover:border-primary/15"
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-5 px-5 py-5 text-left sm:px-6 sm:py-6"
                    onClick={() => setOpenArticleId(isOpen ? null : article.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground sm:text-[15px]">
                        {article.title}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                        {article.summary}
                      </span>
                    </span>
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        className={cn(
                          "size-3.5 transition-transform duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                    </span>
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-border px-5 pt-5 pb-6 sm:px-6">
                        <p className="text-sm leading-6 text-muted-foreground">
                          {article.answer}
                        </p>
                        {article.action &&
                        canAccessDashboardPage(
                          article.action.href,
                          accessLevel,
                          usage?.canManageBilling
                        ) ? (
                          <Button
                            asChild
                            variant="link"
                            size="sm"
                            className="mt-2 h-auto px-0"
                          >
                            <Link href={article.action.href}>
                              {article.action.label}
                              <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                className="size-3.5"
                              />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}

            {visibleArticles.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-5 py-16 text-center">
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Search01IconView />
                </span>
                <p className="mt-3 text-sm font-medium">Sonuç bulunamadı</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  Farklı bir ifade deneyin veya destek ekibine ulaşın.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon
                  icon={CustomerSupportIcon}
                  className="size-4.5"
                />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">
                    Aradığınız yanıtı bulamadınız mı?
                  </h2>
                  <Badge variant="outline">{support.name}</Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Sorununuzu ve karşılaştığınız adımları paylaşın. Destek ekibi
                  {storeName
                    ? " mağaza bağlamınızla birlikte talebinizi inceleyecek."
                    : " müşteri hesabınız üzerinden talebinizi inceleyecek."}
                </p>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon icon={InboxIcon} className="size-3.5" />
                    {support.level}
                  </span>
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                    Hedef yanıt: {support.responseTarget}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button type="button" onClick={() => setCreateDialogOpen(true)}>
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                Destek talebi oluştur
              </Button>
              {support.setupCall ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Kurulum görüşmesi iste
                </Button>
              ) : null}
            </div>
          </div>
          <div className="border-t border-border bg-muted/35 px-6 py-3 sm:px-8">
            <p className="text-[11px] leading-5 text-muted-foreground">
              Yardım içerikleri ve temel destek tüm planlarda açıktır. Planınız
              yalnızca yanıt önceliğini belirler.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Search01IconView() {
  return <HugeiconsIcon icon={Search01Icon} className="size-4" />
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-10 items-center px-3 text-xs font-medium transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
        active
          ? "text-foreground after:bg-primary"
          : "text-muted-foreground after:bg-transparent hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function mergeTicket(
  current: SupportTicketList,
  ticket: SupportTicketDetail
): SupportTicketList {
  const previous = current.items.find((item) => item.id === ticket.id)
  const counts = { ...current.counts }
  if (!previous) counts[ticket.status] += 1
  else if (previous.status !== ticket.status) {
    counts[previous.status] = Math.max(0, counts[previous.status] - 1)
    counts[ticket.status] += 1
  }
  const summary = toTicketSummary(ticket)
  const items = [
    summary,
    ...current.items.filter((item) => item.id !== ticket.id),
  ]
    .sort(
      (left, right) =>
        new Date(right.lastMessageAt).getTime() -
        new Date(left.lastMessageAt).getTime()
    )
    .slice(0, 100)

  return {
    items,
    counts,
    total: previous ? current.total : current.total + 1,
  }
}

function toTicketSummary(ticket: SupportTicketDetail): SupportTicketSummary {
  return ticket
}
