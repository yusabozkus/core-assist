"use client"

import { useState } from "react"
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { createContactMessage } from "@/lib/api/contact"
import type { ContactMessageTopic } from "@/types/contact"

const TOPICS: ReadonlyArray<{
  value: ContactMessageTopic
  label: string
}> = [
  { value: "PRODUCT", label: "Ürün hakkında" },
  { value: "PRICING", label: "Planlar ve fiyatlandırma" },
  { value: "PARTNERSHIP", label: "İş ortaklığı" },
  { value: "OTHER", label: "Diğer" },
]

const initialForm = {
  name: "",
  email: "",
  company: "",
  topic: "PRODUCT" as ContactMessageTopic,
  subject: "",
  message: "",
  website: "",
}

export function ContactForm() {
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      await createContactMessage({
        ...form,
        company: form.company.trim() || undefined,
        sourcePage: "/contact",
      })
      setForm(initialForm)
      setSubmitted(true)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Mesajınız gönderilemedi. Lütfen tekrar deneyin."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="flex min-h-[31rem] flex-col items-center justify-center px-6 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-[#e3efdd] text-[#245d46]">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-6" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[#17281f]">
          Mesajınız bize ulaştı
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[#6d796e]">
          Ekibimiz mesajınızı inceleyecek ve verdiğiniz e-posta adresi üzerinden
          sizinle iletişime geçecek.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-7 text-sm font-semibold text-[#245d46] underline decoration-[#245d46]/30 underline-offset-4 hover:decoration-[#245d46]"
        >
          Yeni bir mesaj gönderin
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad soyad" htmlFor="contact-name">
          <input
            id="contact-name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            className={fieldClassName}
            placeholder="Adınız ve soyadınız"
          />
        </Field>
        <Field label="E-posta" htmlFor="contact-email">
          <input
            id="contact-email"
            required
            type="email"
            maxLength={320}
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            className={fieldClassName}
            placeholder="ornek@sirket.com"
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Şirket veya mağaza" htmlFor="contact-company" optional>
          <input
            id="contact-company"
            maxLength={120}
            autoComplete="organization"
            value={form.company}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                company: event.target.value,
              }))
            }
            className={fieldClassName}
            placeholder="Şirket adı"
          />
        </Field>
        <Field label="Konu" htmlFor="contact-topic">
          <select
            id="contact-topic"
            value={form.topic}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                topic: event.target.value as ContactMessageTopic,
              }))
            }
            className={fieldClassName}
          >
            {TOPICS.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {topic.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Mesaj başlığı" htmlFor="contact-subject">
        <input
          id="contact-subject"
          required
          minLength={3}
          maxLength={140}
          value={form.subject}
          onChange={(event) =>
            setForm((current) => ({ ...current, subject: event.target.value }))
          }
          className={fieldClassName}
          placeholder="Size nasıl yardımcı olabiliriz?"
        />
      </Field>

      <Field label="Mesajınız" htmlFor="contact-message">
        <textarea
          id="contact-message"
          required
          minLength={20}
          maxLength={3000}
          rows={7}
          value={form.message}
          onChange={(event) =>
            setForm((current) => ({ ...current, message: event.target.value }))
          }
          className={`${fieldClassName} min-h-40 resize-y py-3`}
          placeholder="İhtiyacınızı veya sorunuzu mümkün olduğunca açık biçimde paylaşın."
        />
        <p className="mt-2 text-right text-[11px] text-[#8a968b] tabular-nums">
          {form.message.length}/3000
        </p>
      </Field>

      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="contact-website">Web sitesi</label>
        <input
          id="contact-website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) =>
            setForm((current) => ({ ...current, website: event.target.value }))
          }
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm leading-6 text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-4 border-t border-[#dfe5da] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-[11px] leading-5 text-[#849086]">
          Bilgileriniz yalnızca mesajınızı değerlendirmek ve size dönüş yapmak
          amacıyla kullanılır.
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="group inline-flex h-11 shrink-0 items-center justify-center gap-3 rounded-xl bg-[#17281f] px-5 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#245d46] focus-visible:ring-2 focus-visible:ring-[#245d46]/30 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        >
          {isSubmitting ? "Gönderiliyor" : "Mesajı gönder"}
          <HugeiconsIcon
            icon={isSubmitting ? Loading03Icon : ArrowRight01Icon}
            className={`size-4 ${isSubmitting ? "animate-spin" : "transition-transform group-hover:translate-x-0.5"}`}
          />
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  optional = false,
  children,
}: {
  label: string
  htmlFor: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#314238]"
      >
        {label}
        {optional ? (
          <span className="font-normal text-[#8a968b]">İsteğe bağlı</span>
        ) : null}
      </label>
      {children}
    </div>
  )
}

const fieldClassName =
  "w-full rounded-xl border border-[#d7dfd3] bg-white px-3.5 text-sm text-[#17281f] shadow-[0_1px_2px_rgba(23,40,31,0.03)] outline-none transition-[border-color,box-shadow] placeholder:text-[#9aa49b] focus:border-[#789886] focus:ring-4 focus:ring-[#245d46]/8 h-11"
