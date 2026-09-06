"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { InvoiceDetailDialog } from "@/components/dashboard/billing/invoice-detail-dialog"
import {
  InvoiceHistory,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/components/dashboard/billing/invoice-history"
import { InvoiceSummary } from "@/components/dashboard/billing/invoice-summary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { APP_ROUTES } from "@/constants/site"

type StatusFilter = "all" | InvoiceStatus

const invoices: readonly InvoiceRecord[] = [
  createInvoice("0192", "15 Ağustos – 15 Eylül 2026", "15 Ağustos 2026"),
  createInvoice("0171", "15 Temmuz – 15 Ağustos 2026", "15 Temmuz 2026"),
  createInvoice("0148", "15 Haziran – 15 Temmuz 2026", "15 Haziran 2026"),
  createInvoice("0126", "15 Mayıs – 15 Haziran 2026", "15 Mayıs 2026"),
  createInvoice("0104", "15 Nisan – 15 Mayıs 2026", "15 Nisan 2026"),
  createInvoice("0081", "15 Mart – 15 Nisan 2026", "15 Mart 2026"),
  createInvoice("0057", "15 Şubat – 15 Mart 2026", "15 Şubat 2026"),
  createInvoice("0032", "15 Ocak – 15 Şubat 2026", "15 Ocak 2026"),
  createInvoice(
    "0418",
    "15 Aralık 2025 – 15 Ocak 2026",
    "15 Aralık 2025",
    "2025",
    "Starter",
    2300
  ),
  createInvoice(
    "0391",
    "15 Kasım – 15 Aralık 2025",
    "15 Kasım 2025",
    "2025",
    "Starter",
    2300,
    "refunded"
  ),
] as const

function createInvoice(
  sequence: string,
  period: string,
  issuedAt: string,
  year = "2026",
  plan = "Growth",
  subtotal = 6000,
  status: InvoiceStatus = "paid"
): InvoiceRecord {
  const tax = subtotal * 0.2

  return {
    id: `${year}-${sequence}`,
    number: `CA-${year}-${sequence}`,
    plan: `${plan} · Aylık plan`,
    period,
    issuedAt,
    year,
    subtotal,
    tax,
    total: subtotal + tax,
    status,
    paymentMethod: "Visa •••• 4242",
  }
}

export function InvoicesClient() {
  const [year, setYear] = useState("2026")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(
    null
  )

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          invoice.year === year &&
          (status === "all" || invoice.status === status)
      ),
    [year, status]
  )

  const paidTotal = invoices
    .filter((invoice) => invoice.year === "2026" && invoice.status === "paid")
    .reduce((total, invoice) => total + invoice.total, 0)

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-3xl">
            Faturalar
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Abonelik ödemelerinizi, fatura dönemlerinizi ve geçmiş kayıtlarınızı
            görüntüleyin.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={APP_ROUTES.dashboard.settings.billing}>
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Aboneliğe dön
          </Link>
        </Button>
      </header>

      <InvoiceSummary paidTotal={paidTotal} />

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold tracking-[-0.015em]">
                Fatura geçmişi
              </h2>
              <Badge variant="secondary">{filteredInvoices.length} kayıt</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Oluşturulan faturaları inceleyin ve PDF olarak indirin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="rounded-xl border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(value) => setStatus(value as StatusFilter)}
            >
              <SelectTrigger className="rounded-xl border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                <SelectItem value="all">Tüm durumlar</SelectItem>
                <SelectItem value="paid">Ödendi</SelectItem>
                <SelectItem value="refunded">İade edildi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <InvoiceHistory
          invoices={filteredInvoices}
          onSelect={setSelectedInvoice}
        />
      </section>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoice(null)
        }}
      />
    </main>
  )
}
