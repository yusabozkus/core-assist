"use client"

import { useMemo, useState } from "react"
import {
  AlertCircleIcon,
  Cancel01Icon,
  Invoice03Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { BillingPageHeader } from "@/components/dashboard/billing/billing-page-header"
import { InvoiceDetailDialog } from "@/components/dashboard/billing/invoice-detail-dialog"
import { InvoiceHistory } from "@/components/dashboard/billing/invoice-history"
import { InvoiceSummary } from "@/components/dashboard/billing/invoice-summary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatBillingDate,
  formatBillingPeriod,
  getBillingPlanName,
} from "@/lib/billing"
import type {
  BillingHistory,
  InvoiceRecord,
  InvoiceStatus,
} from "@/types/billing"

type StatusFilter = "all" | InvoiceStatus

export function InvoicesClient({
  storeId,
  history,
}: {
  storeId: string
  history: BillingHistory | null
}) {
  const invoices = useMemo(() => history?.invoices ?? [], [history])
  const years = useMemo(
    () =>
      [...new Set(invoices.map((invoice) => invoiceYear(invoice.issuedAt)))]
        .filter(Boolean)
        .sort((left, right) => Number(right) - Number(left)),
    [invoices]
  )
  const [year, setYear] = useState("all")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(
    null
  )

  const periodInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          year === "all" || invoiceYear(invoice.issuedAt) === year
      ),
    [invoices, year]
  )
  const filteredInvoices = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("tr-TR")
    return periodInvoices.filter(
      (invoice) =>
        (status === "all" || invoice.status === status) &&
        (!search ||
          [
            invoice.number,
            getBillingPlanName(invoice.plan),
            formatBillingPeriod(invoice.periodStart, invoice.periodEnd),
            formatBillingDate(invoice.issuedAt),
          ].some((value) =>
            value.toLocaleLowerCase("tr-TR").includes(search)
          ))
    )
  }, [periodInvoices, query, status])

  function resetFilters() {
    setYear("all")
    setStatus("all")
    setQuery("")
  }

  return (
    <main className="mx-auto w-full max-w-[1120px] space-y-6 px-5 py-8 sm:px-8 lg:px-10">
      <BillingPageHeader active="invoices" />
      <InvoiceSummary invoices={periodInvoices} year={year} />

      <section
        aria-labelledby="invoice-history-title"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <h2 id="invoice-history-title" className="text-sm font-semibold">
              Fatura geçmişi
            </h2>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {periodInvoices.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">En yeniden eskiye</p>
        </div>

        {history === null ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              className="size-8 text-amber-600/70 dark:text-amber-400/70"
            />
            <h3 className="mt-5 text-sm font-semibold">
              Fatura geçmişi alınamadı
            </h3>
            <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
              Paddle ile bağlantı kurulamadı. Sayfayı yenileyerek yeniden
              deneyebilirsiniz.
            </p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
            <HugeiconsIcon
              icon={Invoice03Icon}
              className="size-8 text-muted-foreground/60"
            />
            <h3 className="mt-5 text-sm font-semibold">Henüz faturanız yok</h3>
            <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
              Paddle üzerinden tamamlanan ilk ödemenizin faturası burada
              görüntülenecek.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center sm:px-6">
              <div className="w-full sm:max-w-xs">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Fatura ara"
                  placeholder="Fatura numarası veya plan ara…"
                  className="h-9 rounded-lg border-border bg-background text-xs shadow-none"
                  icon={
                    <HugeiconsIcon icon={Search01Icon} className="size-3.5" />
                  }
                  endIcon={
                    query ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Aramayı temizle"
                        className="rounded-sm p-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <HugeiconsIcon
                          icon={Cancel01Icon}
                          className="size-3.5"
                        />
                      </button>
                    ) : undefined
                  }
                />
              </div>
              <div className="flex gap-2">
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger
                    aria-label="Fatura yılı"
                    className="h-9 min-w-28 flex-1 rounded-lg border-border bg-card text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm yıllar</SelectItem>
                    {years.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as StatusFilter)}
                >
                  <SelectTrigger
                    aria-label="Fatura durumu"
                    className="h-9 min-w-36 flex-1 rounded-lg border-border bg-card text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm durumlar</SelectItem>
                    <SelectItem value="paid">Ödendi</SelectItem>
                    <SelectItem value="partially_refunded">
                      Kısmen iade
                    </SelectItem>
                    <SelectItem value="refunded">İade edildi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <InvoiceHistory
              invoices={filteredInvoices}
              onSelect={setSelectedInvoice}
              onReset={resetFilters}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/15 px-5 py-3 sm:px-6">
              <p
                role="status"
                aria-live="polite"
                className="text-xs text-muted-foreground"
              >
                {filteredInvoices.length} fatura gösteriliyor
              </p>
              {(query || status !== "all" || year !== "all") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-muted-foreground"
                  onClick={resetFilters}
                >
                  Filtreleri temizle
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      <p className="text-xs leading-5 text-muted-foreground">
        Fatura belgeleri Paddle tarafından hazırlanır ve güvenli, süreli bir
        indirme bağlantısı üzerinden sunulur.
      </p>

      <InvoiceDetailDialog
        storeId={storeId}
        invoice={selectedInvoice}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoice(null)
        }}
      />
    </main>
  )
}

function invoiceYear(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : String(date.getFullYear())
}
