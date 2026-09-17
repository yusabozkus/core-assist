import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  CreditCardIcon,
  InboxIcon,
  Package01Icon,
  RefreshIcon,
  Store01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { cn, getInitials } from "@/lib/utils"
import type { AdminCustomerDetail } from "@/types/admin-customer"
import {
  ADMIN_SUPPORT_PRIORITY,
  ADMIN_SUPPORT_STATUS,
} from "@/components/admin/support/admin-support-presentation"
import {
  ADMIN_CUSTOMER_SUBSCRIPTION_STATUS,
  adminPlanLabel,
  formatAdminCustomerDate,
  formatAdminCustomerDay,
  providerLabel,
} from "./admin-customer-presentation"

export function AdminCustomerDetailView({
  customer,
}: {
  customer: AdminCustomerDetail
}) {
  const subscriptionStatus = customer.subscription
    ? ADMIN_CUSTOMER_SUBSCRIPTION_STATUS[customer.subscription.status]
    : null
  const aiUsed = customer.usage?.aiQuestions ?? 0
  const aiLimit = customer.limits?.aiQuestions ?? 0
  const aiPercentage = percentage(aiUsed, aiLimit)

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 shrink-0"
          >
            <Link
              href={APP_ROUTES.admin.customers}
              aria-label="Müşterilere dön"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Çalışma alanı
              </p>
              {subscriptionStatus ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0 text-[9px]",
                    subscriptionStatus.className
                  )}
                >
                  {subscriptionStatus.label}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="px-2 py-0 text-[9px] text-muted-foreground"
                >
                  Abonelik yok
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "px-2 py-0 text-[9px]",
                  customer.onboardingCompleted
                    ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300"
                )}
              >
                {customer.onboardingCompleted
                  ? "Kurulum tamamlandı"
                  : "Kurulum bekliyor"}
              </Badge>
            </div>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              {customer.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {customer.owner.name} · {customer.owner.email}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-7 gap-y-2 text-xs sm:flex sm:items-center sm:gap-7">
          <HeaderFact
            label="Hesap açılışı"
            value={formatAdminCustomerDay(customer.createdAt)}
          />
          <HeaderFact
            label="Son etkinlik"
            value={formatAdminCustomerDate(customer.lastActiveAt)}
          />
          <HeaderFact label="Workspace ID" value={shortId(customer.id)} mono />
        </div>
      </div>

      {!customer.subscription?.hasAccess ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/7 px-4 py-3">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
          />
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Abonelik erişimi kapalı
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Yeni AI üretimi ve senkronizasyonlar çalışmaz. Kayıtlı verilere
              erişim korunur.
            </p>
          </div>
        </div>
      ) : null}

      <section className="mt-6 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-5">
        <OverviewMetric
          label="AI soruları"
          value={`${aiUsed.toLocaleString("tr-TR")} / ${aiLimit ? aiLimit.toLocaleString("tr-TR") : "—"}`}
          helper={aiLimit ? `%${aiPercentage} kullanıldı` : "Kota bulunmuyor"}
          icon={CheckmarkCircle01Icon}
          progress={aiPercentage}
        />
        <OverviewMetric
          label="Aktif mağaza"
          value={customer.counts.activeStores.toLocaleString("tr-TR")}
          helper={`${customer.counts.stores.toLocaleString("tr-TR")} kayıtlı mağaza`}
          icon={Store01Icon}
        />
        <OverviewMetric
          label="Aktif ürün"
          value={customer.counts.activeProducts.toLocaleString("tr-TR")}
          helper={`${customer.stores.length} mağazada`}
          icon={Package01Icon}
        />
        <OverviewMetric
          label="Ürün soruları"
          value={customer.questionCounts.total.toLocaleString("tr-TR")}
          helper={`${customer.questionCounts.pending} bekleyen · ${customer.questionCounts.answered} yanıtlanan`}
          icon={InboxIcon}
        />
        <OverviewMetric
          label="Ekip"
          value={customer.counts.members.toLocaleString("tr-TR")}
          helper={`${customer.pendingInvitations.length} bekleyen davet`}
          icon={UserGroupIcon}
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Section
            title="Mağazalar ve kanallar"
            description="Katalog kapasitesi ve bağlantıların son çalışma durumu."
          >
            {customer.stores.length ? (
              <div className="divide-y divide-border">
                {customer.stores.map((store) => (
                  <StoreRow key={store.id} store={store} />
                ))}
              </div>
            ) : (
              <EmptyState text="Bu çalışma alanında mağaza bulunmuyor." />
            )}
          </Section>

          <div className="grid gap-6 2xl:grid-cols-2">
            <Section
              title="Son destek talepleri"
              description="Müşteriyle yürütülen en güncel destek görüşmeleri."
              action={
                customer.recentSupportTickets.length ? (
                  <Link
                    href={`${APP_ROUTES.admin.support}?q=${encodeURIComponent(customer.name)}`}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Tümünü görüntüle
                  </Link>
                ) : null
              }
            >
              {customer.recentSupportTickets.length ? (
                <div className="divide-y divide-border">
                  {customer.recentSupportTickets.map((ticket) => (
                    <SupportTicketRow key={ticket.id} ticket={ticket} />
                  ))}
                </div>
              ) : (
                <EmptyState text="Bu müşterinin destek talebi bulunmuyor." />
              )}
            </Section>

            <Section
              title="Son senkronizasyonlar"
              description="Katalog, stok ve soru işlemlerinin son sonuçları."
            >
              {customer.recentSyncRuns.length ? (
                <div className="divide-y divide-border">
                  {customer.recentSyncRuns.map((run) => (
                    <SyncRunRow key={run.id} run={run} />
                  ))}
                </div>
              ) : (
                <EmptyState text="Henüz senkronizasyon kaydı bulunmuyor." />
              )}
            </Section>
          </div>
        </div>

        <aside className="space-y-6">
          <Section
            title="Abonelik"
            description="Plan, dönem ve kullanım özeti."
          >
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">
                    {adminPlanLabel(customer.subscription?.plan)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {customer.subscription
                      ? customer.subscription.cycle === "MONTHLY"
                        ? "Aylık faturalama"
                        : "Yıllık faturalama"
                      : "Aktif plan bulunmuyor"}
                  </p>
                </div>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HugeiconsIcon icon={CreditCardIcon} className="size-4" />
                </span>
              </div>

              <div className="space-y-2.5 border-t border-border pt-4">
                <DetailRow
                  label="Dönem başlangıcı"
                  value={formatAdminCustomerDay(
                    customer.subscription?.currentPeriodStart
                  )}
                />
                <DetailRow
                  label="Dönem sonu"
                  value={formatAdminCustomerDay(
                    customer.subscription?.currentPeriodEnd
                  )}
                />
                <DetailRow
                  label="AI kullanımı"
                  value={`${aiUsed.toLocaleString("tr-TR")} / ${aiLimit ? aiLimit.toLocaleString("tr-TR") : "—"}`}
                />
                <DetailRow
                  label="İptal planlandı"
                  value={
                    customer.subscription?.cancelAtPeriodEnd ? "Evet" : "Hayır"
                  }
                />
              </div>
            </div>
          </Section>

          <Section
            title="Ekip"
            description="Hesaba erişimi bulunan kullanıcılar."
          >
            <div className="divide-y divide-border">
              {customer.members.map((member) => (
                <MemberRow key={member.id} member={member} />
              ))}
              {customer.pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs font-medium">
                      {invitation.email}
                    </p>
                    <Badge
                      variant="outline"
                      className="border-amber-500/25 bg-amber-500/8 px-2 py-0 text-[9px] text-amber-700 dark:text-amber-300"
                    >
                      Davet bekliyor
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {roleLabel(invitation.role)} ·{" "}
                    {formatAdminCustomerDay(invitation.expiresAt)} tarihine
                    kadar
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Hesap bilgileri"
            description="Kimlik ve doğrulama özeti."
          >
            <div className="space-y-3 p-4">
              <DetailRow label="Hesap sahibi" value={customer.owner.name} />
              <DetailRow label="E-posta" value={customer.owner.email} />
              <DetailRow
                label="E-posta durumu"
                value={
                  customer.owner.emailVerified ? "Doğrulandı" : "Doğrulanmadı"
                }
                danger={!customer.owner.emailVerified}
              />
              <DetailRow
                label="Giriş yöntemleri"
                value={
                  customer.owner.providers.map(providerLabel).join(", ") || "—"
                }
              />
              <DetailRow
                label="Onboarding"
                value={formatAdminCustomerDate(
                  customer.owner.onboardingCompletedAt
                )}
              />
            </div>
          </Section>
        </aside>
      </div>
    </main>
  )
}

function StoreRow({ store }: { store: AdminCustomerDetail["stores"][number] }) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{store.name}</p>
            <Badge
              variant="outline"
              className={cn(
                "px-2 py-0 text-[9px]",
                store.status === "ACTIVE"
                  ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground"
              )}
            >
              {store.status === "ACTIVE" ? "Aktif" : "Pasif"}
            </Badge>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {store.inventoryPolicy === "SHARED"
              ? "Ortak stok yönetimi"
              : store.inventoryPolicy === "CHANNEL_SPECIFIC"
                ? "Kanal bazlı stok yönetimi"
                : "Stok politikası belirlenmedi"}
          </p>
        </div>
        <div className="flex gap-6 text-xs">
          <CapacityFact label="Ürün" value={store.counts.products} />
          <CapacityFact label="Soru" value={store.counts.questions} />
          <CapacityFact label="Destek" value={store.counts.supportTickets} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {store.channels.length ? (
          store.channels.map((channel) => (
            <span
              key={channel.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px]",
                channel.status === "ERROR" &&
                  "border-destructive/25 bg-destructive/5 text-destructive"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full bg-muted-foreground",
                  channel.status === "CONNECTED" && "bg-emerald-500",
                  channel.status === "PENDING" && "bg-amber-500",
                  channel.status === "ERROR" && "bg-destructive"
                )}
              />
              {providerLabel(channel.providerKey)}
              <span className="text-muted-foreground">
                {channelStatusLabel(channel.status)}
              </span>
              {channel.lastSyncAt ? (
                <span className="hidden text-muted-foreground sm:inline">
                  · {formatAdminCustomerDay(channel.lastSyncAt)}
                </span>
              ) : null}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Bağlı satış kanalı bulunmuyor.
          </span>
        )}
      </div>
    </div>
  )
}

function SupportTicketRow({
  ticket,
}: {
  ticket: AdminCustomerDetail["recentSupportTickets"][number]
}) {
  const status = ADMIN_SUPPORT_STATUS[ticket.status]
  const priority = ADMIN_SUPPORT_PRIORITY[ticket.priority]

  return (
    <Link
      href={APP_ROUTES.admin.supportTicket(ticket.id)}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/35"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[9px]">
          <span className="font-semibold text-muted-foreground">
            {ticket.code}
          </span>
          <span className={priority.className}>{priority.label}</span>
        </div>
        <p className="mt-1 truncate text-xs font-medium">{ticket.subject}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {ticket.messageCount} mesaj ·{" "}
          {formatAdminCustomerDay(ticket.updatedAt)}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn("shrink-0 px-2 py-0 text-[9px]", status.className)}
      >
        {status.label}
      </Badge>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}

function SyncRunRow({
  run,
}: {
  run: AdminCustomerDetail["recentSyncRuns"][number]
}) {
  const failed = run.status === "FAILED"
  const running = run.status === "RUNNING"

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          failed && "bg-destructive/10 text-destructive",
          running && "bg-primary/10 text-primary"
        )}
      >
        <HugeiconsIcon
          icon={failed ? AlertCircleIcon : RefreshIcon}
          className={cn("size-3.5", running && "animate-spin")}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-xs font-medium">
            {providerLabel(run.connection.providerKey)} ·{" "}
            {syncKindLabel(run.kind)}
          </p>
          <span
            className={cn(
              "shrink-0 text-[9px] font-medium text-muted-foreground",
              failed && "text-destructive",
              running && "text-primary"
            )}
          >
            {syncStatusLabel(run.status)}
          </span>
        </div>
        <p className="mt-1 truncate text-[10px] text-muted-foreground">
          {run.connection.store.name} · {formatAdminCustomerDate(run.startedAt)}
        </p>
        {run.errorMessage ? (
          <p className="mt-1 line-clamp-1 text-[10px] text-destructive">
            {run.errorMessage}
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {run.productsProcessed.toLocaleString("tr-TR")} ürün ·{" "}
            {run.questionsProcessed.toLocaleString("tr-TR")} soru
          </p>
        )}
      </div>
    </div>
  )
}

function MemberRow({
  member,
}: {
  member: AdminCustomerDetail["members"][number]
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={member.user.image ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {getInitials(member.user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{member.user.name}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {member.user.email}
        </p>
      </div>
      <span className="shrink-0 text-[9px] font-medium text-muted-foreground">
        {roleLabel(member.role)}
      </span>
    </div>
  )
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {description}
          </p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function OverviewMetric({
  label,
  value,
  helper,
  icon,
  progress,
}: {
  label: string
  value: string
  helper: string
  icon: IconSvgElement
  progress?: number
}) {
  return (
    <div className="border-b border-border p-4 last:border-b-0 xl:border-r xl:border-b-0 xl:last:border-r-0 sm:[&:nth-child(odd)]:border-r">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 truncate text-lg font-semibold tabular-nums">
            {value}
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <HugeiconsIcon icon={icon} className="size-3.5" />
        </span>
      </div>
      {progress !== undefined ? (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full bg-primary",
              progress >= 90 && "bg-amber-500",
              progress >= 100 && "bg-destructive"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      <p className="mt-1.5 truncate text-[9px] text-muted-foreground">
        {helper}
      </p>
    </div>
  )
}

function HeaderFact({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-medium", mono && "font-mono text-[10px]")}>
        {value}
      </p>
    </div>
  )
}

function DetailRow({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-[11px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 text-right font-medium break-words",
          danger && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function CapacityFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="font-semibold tabular-nums">
        {value.toLocaleString("tr-TR")}
      </p>
      <p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-5 py-10 text-center text-xs text-muted-foreground">
      {text}
    </div>
  )
}

function percentage(used: number, limit: number) {
  return limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

function roleLabel(role: "OWNER" | "ADMIN" | "MEMBER") {
  if (role === "OWNER") return "Hesap sahibi"
  if (role === "ADMIN") return "Yönetici"
  return "Üye"
}

function channelStatusLabel(status: string) {
  if (status === "CONNECTED") return "Bağlı"
  if (status === "PENDING") return "Bekliyor"
  if (status === "ERROR") return "Hata"
  return "Bağlantı kesildi"
}

function syncKindLabel(kind: string) {
  if (kind === "FULL") return "Katalog"
  if (kind === "INVENTORY") return "Stok"
  return "Sorular"
}

function syncStatusLabel(status: string) {
  if (status === "COMPLETED") return "Tamamlandı"
  if (status === "FAILED") return "Başarısız"
  return "Çalışıyor"
}
