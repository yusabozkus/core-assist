import Link from "next/link"
import Image from "next/image"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  BubbleChatDoneIcon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  CreditCardIcon,
  Package01Icon,
  PlugSocketIcon,
  RefreshIcon,
  Settings02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { getServerActivity } from "@/lib/api/activity.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"
import { getInitials } from "@/lib/utils"
import type {
  ActivityActorFilter,
  ActivityCategory,
  ActivityItem,
  ActivityPage,
  ActivityPageSize,
  ActivityPeriod,
  ActivityResultFilter,
} from "@/types/activity"
import { ActivityToolbar } from "./activity-toolbar"

export const dynamic = "force-dynamic"

const categories: { value: ActivityCategory; label: string }[] = [
  { value: "ALL", label: "Tüm işlemler" },
  { value: "ANSWERS", label: "Yanıtlar" },
  { value: "SETTINGS", label: "AI ve ayarlar" },
  { value: "CATALOG", label: "Mağaza ve katalog" },
  { value: "CHANNELS", label: "Kanallar" },
  { value: "TEAM", label: "Ekip" },
  { value: "BILLING", label: "Faturalama" },
]

const categoryDetails: Record<
  Exclude<ActivityCategory, "ALL">,
  { label: string; icon: IconSvgElement }
> = {
  ANSWERS: { label: "Yanıt", icon: BubbleChatDoneIcon },
  SETTINGS: { label: "AI ve ayarlar", icon: Settings02Icon },
  CATALOG: { label: "Mağaza ve katalog", icon: Package01Icon },
  CHANNELS: { label: "Kanallar", icon: PlugSocketIcon },
  TEAM: { label: "Ekip", icon: UserGroupIcon },
  BILLING: { label: "Faturalama", icon: CreditCardIcon },
}

type SearchParams = Record<string, string | string[] | undefined>

export default async function ActivityPageRoute({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { activeStore } = await getOperationalStoreContext()
  const params = await searchParams
  const period = parsePeriod(first(params.period))
  const result = parseResult(first(params.result))
  const actor = parseActor(first(params.actor))
  const limit = parseLimit(first(params.limit))
  const q = (first(params.q) ?? "").trim().slice(0, 80)
  const requestedCursor = first(params.cursor)
  let cursor =
    requestedCursor &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestedCursor
    )
      ? requestedCursor
      : undefined
  let category = parseCategory(first(params.category))
  let page: ActivityPage | null = null

  try {
    page = await getServerActivity(activeStore.id, {
      category,
      period,
      result,
      actor,
      q,
      cursor,
      limit,
    })
    if (
      !page.canViewAccountEvents &&
      (category === "TEAM" || category === "BILLING")
    ) {
      category = "ALL"
      cursor = undefined
      page = await getServerActivity(activeStore.id, {
        category,
        period,
        result,
        actor,
        q,
        limit,
      })
    }
  } catch {
    page = null
  }

  const visibleCategories = page?.canViewAccountEvents
    ? categories
    : categories.filter(
        (item) => item.value !== "TEAM" && item.value !== "BILLING"
      )
  function href(overrides: Record<string, string | undefined> = {}) {
    const next = new URLSearchParams({
      category,
      period,
      result,
      actor,
      limit: String(limit),
    })
    if (q) next.set("q", q)
    if (cursor) next.set("cursor", cursor)
    for (const [key, value] of Object.entries(overrides)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    return `${APP_ROUTES.dashboard.activity}?${next}`
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="mb-1.5 truncate text-xs font-medium text-muted-foreground">
            {activeStore.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            İşlem Geçmişi
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Mağazanızdaki önemli işlemleri ve değişiklikleri takip edin.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="w-fit bg-card">
          <Link href={href()}>
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
            Yenile
          </Link>
        </Button>
      </header>

      <ActivityToolbar
        category={category}
        period={period}
        result={result}
        actor={actor}
        limit={limit}
        q={q}
        categories={visibleCategories}
      />

      <section
        className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
        aria-label="İşlem kayıtları"
      >
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Kayıtlar</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                En yeni işlemler önce gösterilir.
              </p>
            </div>
            {page && page.items.length > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Bu sayfada {page.items.length} kayıt
              </span>
            ) : null}
          </div>
        </div>

        {page === null ? (
          <ActivityEmpty
            icon={AlertCircleIcon}
            title="Kayıtlar yüklenemedi"
            description="Bağlantıyı kontrol edip tekrar deneyin."
            actionLabel="Tekrar dene"
            href={href()}
          />
        ) : page.items.length === 0 ? (
          <ActivityEmpty
            icon={Clock01Icon}
            title="Bu görünümde kayıt yok"
            description="Filtreleri değiştirerek diğer işlemlere bakabilirsiniz."
            actionLabel="Varsayılan görünümü göster"
            href={APP_ROUTES.dashboard.activity}
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(10rem,0.65fr)_6rem_9rem] items-center gap-4 border-b border-border bg-muted/30 px-5 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase lg:grid">
              <span>İşlem</span>
              <span>Kim tarafından</span>
              <span>Zaman</span>
              <span>Sonuç</span>
            </div>
            <div>
              {page.items.map((item, index) => {
                const showDay =
                  index === 0 ||
                  dayKey(page!.items[index - 1].createdAt) !==
                    dayKey(item.createdAt)
                return (
                  <div key={item.id}>
                    {showDay ? (
                      <div className="border-b border-border/70 bg-muted/15 px-4 py-2 text-xs font-medium text-muted-foreground sm:px-5">
                        {dayLabel(item.createdAt)}
                      </div>
                    ) : null}
                    <ActivityRow item={item} />
                  </div>
                )
              })}
            </div>
            {page.nextCursor || cursor ? (
              <div className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
                {cursor ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={href({ cursor: undefined })}>
                      En yeni kayıtlar
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                {page.nextCursor ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={href({ cursor: page.nextCursor })}>
                      Daha eski kayıtlar
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const failure = item.result === "FAILURE"
  const category = categoryDetails[item.category]

  return (
    <Link
      href={item.href}
      className="group grid gap-3 border-b border-border/70 px-4 py-4 transition-colors last:border-0 hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none sm:px-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(10rem,0.65fr)_6rem_9rem] lg:items-center lg:gap-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${failure ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}
        >
          <HugeiconsIcon
            icon={failure ? AlertCircleIcon : category.icon}
            className="size-4"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground group-hover:text-primary">
              {item.title}
            </span>
            <Badge
              variant="outline"
              className="px-2 py-0 text-[10px] font-medium text-muted-foreground"
            >
              {category.label}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {item.summary}
          </p>
          <div className="mt-3 lg:hidden">
            <ActorIdentity item={item} />
          </div>
        </div>
      </div>
      <div className="hidden min-w-0 lg:block">
        <ActorIdentity item={item} />
      </div>
      <time
        dateTime={item.createdAt}
        className="hidden text-xs text-muted-foreground tabular-nums lg:block"
      >
        {timeLabel(item.createdAt)}
      </time>
      <div className="flex items-center justify-between gap-2 pl-12 lg:pl-0">
        <Badge
          variant={failure ? "warning" : "success"}
          className="px-2 py-0.5 text-[11px]"
        >
          <HugeiconsIcon
            icon={failure ? AlertCircleIcon : CheckmarkCircle01Icon}
            className="size-3"
          />
          {failure ? "Başarısız" : "Tamamlandı"}
        </Badge>
        <span className="flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
          {timeLabel(item.createdAt)}
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="hidden size-3.5 text-muted-foreground group-hover:text-primary lg:block"
        />
      </div>
    </Link>
  )
}

function ActorIdentity({ item }: { item: ActivityItem }) {
  const isSystem = item.actorType === "SYSTEM"

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {isSystem ? (
        <Image
          src="/logo/icon.png"
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <Avatar className="size-8">
          {item.actorAvatarUrl ? (
            <AvatarImage src={item.actorAvatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="text-[11px] font-semibold">
            {getInitials(item.actorName)}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">
          {item.actorName}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {isSystem ? "Sistem işlemi" : (item.actorEmail ?? "Kullanıcı hesabı")}
        </p>
      </div>
    </div>
  )
}

function ActivityEmpty({
  icon,
  title,
  description,
  actionLabel,
  href,
}: {
  icon: IconSvgElement
  title: string
  description: string
  actionLabel: string
  href: string
}) {
  return (
    <div className="flex flex-col items-center px-5 py-16 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-5" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
        {description}
      </p>
      <Button asChild variant="outline" size="sm" className="mt-5">
        <Link href={href}>{actionLabel}</Link>
      </Button>
    </div>
  )
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseCategory(value?: string): ActivityCategory {
  return categories.some((item) => item.value === value)
    ? (value as ActivityCategory)
    : "ALL"
}

function parsePeriod(value?: string): ActivityPeriod {
  return ["DAY", "WEEK", "MONTH"].includes(value ?? "")
    ? (value as ActivityPeriod)
    : "ALL"
}

function parseResult(value?: string): ActivityResultFilter {
  return value === "SUCCESS" || value === "FAILURE" ? value : "ALL"
}

function parseActor(value?: string): ActivityActorFilter {
  return value === "SYSTEM" || value === "ALL" ? value : "TEAM"
}

function parseLimit(value?: string): ActivityPageSize {
  const parsed = Number(value)
  return parsed === 100 || parsed === 200 ? parsed : 50
}

function dayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
