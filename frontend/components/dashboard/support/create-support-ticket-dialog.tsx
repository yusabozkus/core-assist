"use client"

import { useState } from "react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createSupportTicket } from "@/lib/api/support"
import { cn } from "@/lib/utils"
import type {
  SupportTicketCategory,
  SupportTicketDetail,
  SupportTicketImpact,
} from "@/types/support"
import {
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_IMPACT_OPTIONS,
} from "./support-ticket-presentation"

const initialForm = {
  category: "CHANNELS" as SupportTicketCategory,
  impact: "QUESTION" as SupportTicketImpact,
  subject: "",
  message: "",
}

export function CreateSupportTicketDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string | null
  storeName: string | null
  onCreated: (ticket: SupportTicketDetail) => void
}) {
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedCategory = SUPPORT_CATEGORY_OPTIONS.find(
    (option) => option.value === form.category
  )

  function close() {
    if (isSubmitting) return
    setForm(initialForm)
    setError(null)
    onOpenChange(false)
  }

  async function submit() {
    const subject = form.subject.trim()
    const message = form.message.trim()
    if (subject.length < 6) {
      setError("Konu en az 6 karakter olmalı.")
      return
    }
    if (message.length < 20) {
      setError("Sorununuzu en az 20 karakterle açıklayın.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const ticket = await createSupportTicket({
        ...form,
        ...(storeId ? { storeId } : {}),
        subject,
        message,
        pagePath: window.location.pathname,
      })
      setForm(initialForm)
      onOpenChange(false)
      onCreated(ticket)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Destek talebi oluşturulamadı. Lütfen tekrar deneyin."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close()
      }}
      preventClose={isSubmitting}
      title="Yeni destek talebi"
      description={
        storeName
          ? `${storeName} mağazası için destek ekibine ulaşın.`
          : "Müşteri hesabınız için destek ekibine ulaşın."
      }
      contentClassName="sm:max-w-2xl"
      footer={({ close: closeDialog }) => (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => {
              close()
              closeDialog()
            }}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => void submit()}
          >
            {isSubmitting ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-4 animate-spin"
              />
            ) : null}
            {isSubmitting ? "Oluşturuluyor" : "Talebi oluştur"}
          </Button>
        </>
      )}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="support-category">Kategori</Label>
          <Select
            value={form.category}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                category: value as SupportTicketCategory,
              }))
            }
          >
            <SelectTrigger
              id="support-category"
              className="h-11 w-full rounded-xl border-border bg-card"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {SUPPORT_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs leading-5 text-muted-foreground">
            {selectedCategory?.description}
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Sorunun etkisi</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {SUPPORT_IMPACT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    impact: option.value,
                  }))
                }
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  form.impact === option.value
                    ? "border-primary/40 bg-primary/5 ring-2 ring-primary/10"
                    : "border-border bg-card hover:bg-muted/50"
                )}
              >
                <span className="block text-xs font-semibold">
                  {option.label}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="support-subject">Konu</Label>
          <Input
            id="support-subject"
            value={form.subject}
            maxLength={120}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subject: event.target.value,
              }))
            }
            placeholder="Sorunu kısa bir başlıkla özetleyin"
            className="h-11 rounded-xl bg-card"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="support-message">Açıklama</Label>
            <span className="text-[11px] text-muted-foreground">
              {form.message.length}/5000
            </span>
          </div>
          <Textarea
            id="support-message"
            value={form.message}
            maxLength={5000}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                message: event.target.value,
              }))
            }
            placeholder="Ne yapmaya çalıştığınızı ve karşılaştığınız durumu açıklayın..."
            className="min-h-36 resize-none rounded-xl border-border bg-card"
          />
          <p className="text-[11px] leading-5 text-muted-foreground">
            {storeName ? "Mağaza, " : ""}Plan ve bulunduğunuz sayfa bilgisi
            talebe otomatik eklenir. Şifre veya API anahtarı paylaşmayın.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-xs leading-5 text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
