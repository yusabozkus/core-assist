"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  AiSparklesIcon,
  ArrowRight01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { LandingDemoProductArt } from "@/components/landing/landing-demo-product-art"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  askLandingDemoQuestion,
  getLandingDemoProducts,
  getLandingDemoUsage,
  LandingDemoApiError,
  type LandingDemoProduct,
  type LandingDemoUsage,
} from "@/lib/api/landing-demo"

type Message = {
  id: string
  role: "customer" | "assistant"
  text: string
  sources?: string[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AssistantIdentity() {
  return (
    <span className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#4d7959]">
      <Image
        src="/logo/icon.png"
        alt=""
        width={18}
        height={18}
        className="size-[18px] rounded-[5px] object-contain"
      />
      Core Asistan
    </span>
  )
}

function formatDemoReset(resetAt: string) {
  return `${new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(resetAt))} itibarıyla`
}

export function LandingAiDemoDialog({ open, onOpenChange }: Props) {
  const reduceMotion = useReducedMotion()
  const [products, setProducts] = useState<LandingDemoProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<"chat" | "products">("products")
  const [messagesByProduct, setMessagesByProduct] = useState<
    Record<string, Message[]>
  >({})
  const [question, setQuestion] = useState("")
  const [answerError, setAnswerError] = useState("")
  const [sending, setSending] = useState(false)
  const [usage, setUsage] = useState<LandingDemoUsage | null>(null)
  const requestAbort = useRef<AbortController | null>(null)
  const usageVersion = useRef(0)
  const chatViewport = useRef<HTMLDivElement | null>(null)
  const questionInput = useRef<HTMLTextAreaElement | null>(null)

  const product = products.find((item) => item.id === selectedId) ?? null
  const messages = product ? (messagesByProduct[product.id] ?? []) : []

  useEffect(() => {
    if (!open || products.length > 0) return

    const controller = new AbortController()
    getLandingDemoProducts(controller.signal)
      .then((items) => {
        if (items.length === 0) throw new Error("Demo ürünleri bulunamadı.")
        setProducts(items)
        setSelectedId((previous) => previous ?? items[0].id)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(
          error instanceof Error ? error.message : "Demo ürünleri yüklenemedi."
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [open, products.length, loadAttempt])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const version = usageVersion.current
    getLandingDemoUsage(controller.signal)
      .then((currentUsage) => {
        if (!controller.signal.aborted && usageVersion.current === version) {
          setUsage(currentUsage)
        }
      })
      .catch(() => {
        // The answer endpoint still enforces the quota if this read fails.
      })
    return () => controller.abort()
  }, [open])

  useEffect(() => {
    if (open && view === "chat") {
      const viewport = chatViewport.current
      viewport?.scrollTo({
        top: viewport.scrollHeight,
        behavior: reduceMotion ? "auto" : "smooth",
      })
    }
  }, [messages.length, sending, open, view, reduceMotion])

  async function sendQuestion(value: string) {
    const text = value.trim()
    if (!product || !text || sending || usage?.remaining === 0) return

    const productId = product.id
    const customerMessageId = crypto.randomUUID()
    const controller = new AbortController()
    requestAbort.current = controller
    setQuestion("")
    requestAnimationFrame(() => questionInput.current?.focus())
    setAnswerError("")
    setSending(true)
    setMessagesByProduct((current) => ({
      ...current,
      [productId]: [
        ...(current[productId] ?? []),
        { id: customerMessageId, role: "customer", text },
      ],
    }))

    try {
      const result = await askLandingDemoQuestion(
        productId,
        text,
        controller.signal
      )
      if (controller.signal.aborted) return
      usageVersion.current += 1
      setUsage(result.usage)
      setMessagesByProduct((current) => ({
        ...current,
        [productId]: [
          ...(current[productId] ?? []),
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: result.answer,
            sources: result.sources,
          },
        ],
      }))
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessagesByProduct((current) => ({
          ...current,
          [productId]: (current[productId] ?? []).filter(
            (message) => message.id !== customerMessageId
          ),
        }))
        setQuestion((current) => current || text)
        if (
          error instanceof LandingDemoApiError &&
          error.code === "DEMO_LIMIT_REACHED" &&
          error.usage
        ) {
          usageVersion.current += 1
          setUsage(error.usage)
        } else {
          setAnswerError(
            error instanceof Error ? error.message : "Yanıt hazırlanamadı."
          )
        }
      }
    } finally {
      if (!controller.signal.aborted) setSending(false)
      if (requestAbort.current === controller) requestAbort.current = null
    }
  }

  function selectProduct(id: string) {
    setSelectedId(id)
    setQuestion("")
    setAnswerError("")
    setView("chat")
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          requestAbort.current?.abort()
          setSending(false)
          setView("products")
        }
        onOpenChange(nextOpen)
      }}
      title={view === "products" ? "Demo ürününü seçin" : "AI yanıt demosu"}
      description={
        view === "products"
          ? "Örnek koleksiyondan bir ürünle başlayın."
          : "Sorunuzu yazın, yanıtı canlı görün."
      }
      contentClassName={`p-0! text-[#193427] shadow-[0_32px_110px_-34px_rgba(17,45,31,0.4)] overscroll-contain transition-[max-width,height] duration-300 ease-out motion-reduce:transition-none ${view === "products" ? "h-[min(80svh,680px)] sm:h-[min(88svh,690px)] sm:max-w-[450px]!" : "h-[min(84svh,720px)] sm:h-[min(92svh,740px)] sm:max-w-[760px]!"}`}
      scrollClassName={
        view === "products"
          ? "flex flex-col overflow-y-auto overscroll-contain sm:overflow-hidden!"
          : "flex flex-col overflow-hidden! overscroll-contain"
      }
      headerClassName={`border-[#e4ebe4] bg-white px-4 pt-3 pb-2 sm:px-5 sm:py-4 ${view === "chat" ? "pr-24! sm:pr-48!" : "pr-14!"}`}
      titleClassName={
        view === "chat" ? "text-[15px] leading-5 sm:text-base" : undefined
      }
      descriptionClassName={
        view === "chat"
          ? "mt-0.5 text-[11px] leading-4 sm:mt-1 sm:text-[13px] sm:leading-5"
          : undefined
      }
      bodyClassName={
        view === "products"
          ? "flex min-h-0 flex-none flex-col overflow-visible! p-0! sm:flex-1 sm:overflow-hidden!"
          : "flex min-h-0 flex-1 flex-col overflow-hidden! p-0!"
      }
      headerActions={
        products.length > 0 && view === "chat" ? (
          <button
            type="button"
            onClick={() => setView("products")}
            disabled={sending}
            aria-label="Ürün seç"
            title="Ürün seç"
            className="inline-flex size-8 items-center justify-center rounded-full border border-[#e0e9df] bg-[#f5f8f2] text-[11px] font-semibold text-[#315e45] transition-colors hover:bg-[#e9f1e6] disabled:opacity-50 sm:h-8 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-xs"
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-4 sm:size-3.5" />
            <span className="sr-only sm:not-sr-only">Ürün seç</span>
          </button>
        ) : null
      }
    >
      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-[#65786a]">
          <span className="size-5 animate-spin rounded-full border-2 border-[#c9d9ca] border-t-[#2c684b]" />
          Demo hazırlanıyor…
        </div>
      ) : loadError ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-[#566c5a]">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setLoadError("")
              setLoadAttempt((attempt) => attempt + 1)
            }}
            className="rounded-full bg-[#214d36] px-4 py-2 text-sm font-semibold text-white"
          >
            Tekrar dene
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {view === "products" ? (
            <motion.div
              key="products"
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex h-auto min-h-0 flex-col px-4 sm:h-full sm:px-5"
            >
              <div
                data-vaul-no-drag
                className="no-scrollbar min-h-0 flex-none space-y-2.5 overflow-visible overscroll-contain py-4 pr-1 sm:flex-1 sm:overflow-y-auto"
              >
                {products.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectProduct(item.id)}
                    className="group flex w-full min-w-0 items-center gap-3.5 rounded-2xl border border-[#e1e9e0] bg-white p-3 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#a8c6ac] hover:shadow-[0_10px_28px_-18px_rgba(28,70,44,.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#367d52] sm:gap-4 sm:p-3.5"
                  >
                    <LandingDemoProductArt
                      kind={item.art}
                      className="size-[86px] shrink-0 rounded-xl sm:size-[96px]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold tracking-wide text-[#6d8b72] uppercase">
                        {item.category} · {item.color}
                      </span>
                      <span className="mt-1 block truncate text-[15px] font-semibold text-[#203b2a]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[#758478]">
                        {item.subtitle}
                      </span>
                      <span className="mt-1.5 block text-[11px] font-medium text-[#43805c]">
                        {item.highlights.join(" · ")}
                      </span>
                    </span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-4 shrink-0 text-[#80a18a] transition-transform group-hover:translate-x-0.5"
                    />
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 pb-1.5 text-[11px] leading-4 text-[#8a998b]">
                <span>
                  Ürünler, stok bilgileri ve mağaza politikaları örnektir.
                </span>
                {usage ? (
                  <span className="font-semibold text-[#547b5e]">
                    {usage.remaining}/{usage.limit} soru hakkı
                  </span>
                ) : null}
              </div>
            </motion.div>
          ) : product ? (
            <motion.div
              key="chat"
              initial={reduceMotion ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="flex items-center gap-3 border-b border-[#e4ebe4] bg-white px-4 py-3 sm:px-6">
                <LandingDemoProductArt
                  kind={product.art}
                  className="size-16 shrink-0 rounded-xl sm:size-[72px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[#1e3c2b]">
                    {product.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#728376]">
                    {product.subtitle}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {product.highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="rounded-full bg-[#edf3e9] px-2 py-0.5 text-[10px] font-semibold text-[#54745b]"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div
                data-vaul-no-drag
                ref={chatViewport}
                className="themed-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f5f7f2] px-4 py-5 sm:px-7"
                aria-live="polite"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-start justify-center">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e6efe2] text-[#397653]">
                      <HugeiconsIcon icon={AiSparklesIcon} className="size-5" />
                    </div>
                    <p className="mt-4 text-lg font-semibold tracking-tight text-[#254b34]">
                      Bir soru sorun, yanıtı görün.
                    </p>
                    <p className="mt-1 max-w-[360px] text-sm leading-6 text-[#708173]">
                      Müşterinin yazabileceği bir soruyu deneyin veya aşağıdaki
                      örneklerden seçin.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {product.examples.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => void sendQuestion(example)}
                          disabled={sending || usage?.remaining === 0}
                          className="rounded-full border border-[#d9e5d7] bg-white px-3 py-1.5 text-xs font-medium text-[#3a6649] transition-colors hover:border-[#a9c8ab] hover:bg-[#f5faf1] disabled:opacity-50"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22 }}
                        className={
                          message.role === "customer"
                            ? "flex justify-end"
                            : "flex justify-start"
                        }
                      >
                        <div className="max-w-[88%] sm:max-w-[78%]">
                          {message.role === "assistant" ? (
                            <AssistantIdentity />
                          ) : null}
                          <div
                            className={
                              message.role === "customer"
                                ? "rounded-[19px] rounded-br-[5px] bg-[#28543b] px-4 py-2.5 text-sm leading-6 text-white shadow-sm"
                                : "rounded-[19px] rounded-bl-[5px] border border-[#e1e9df] bg-white px-4 py-3 text-sm leading-6 text-[#304537] shadow-[0_5px_22px_-17px_rgba(22,55,33,.6)]"
                            }
                          >
                            {message.text}
                          </div>
                          {message.role === "assistant" &&
                          message.sources?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {message.sources.map((source) => (
                                <span
                                  key={source}
                                  className="rounded-full border border-[#dbe6d7] bg-[#eef4ea] px-2 py-0.5 text-[10px] font-medium text-[#63806a]"
                                >
                                  {source}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                    ))}
                    {sending ? (
                      <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22 }}
                        className="flex justify-start"
                        role="status"
                      >
                        <div className="w-[min(80vw,280px)]">
                          <AssistantIdentity />
                          <div className="rounded-[19px] rounded-bl-[5px] border border-[#dfeadf] bg-white px-4 py-3.5 shadow-[0_8px_28px_-18px_rgba(22,55,33,.45)]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-[#45674d]">
                                Yanıt hazırlanıyor
                              </span>
                              <motion.span
                                aria-hidden="true"
                                className="size-2 rounded-full bg-[#61aa73]"
                                animate={
                                  reduceMotion
                                    ? undefined
                                    : {
                                        opacity: [0.45, 1, 0.45],
                                        scale: [0.8, 1.1, 0.8],
                                      }
                                }
                                transition={{ duration: 1.5, repeat: Infinity }}
                              />
                            </div>
                            <div className="mt-3 space-y-2" aria-hidden="true">
                              {["w-full", "w-[84%]", "w-[61%]"].map(
                                (width, index) => (
                                  <span
                                    key={width}
                                    className={`relative block h-1.5 overflow-hidden rounded-full bg-[#edf3eb] ${width}`}
                                  >
                                    <motion.span
                                      className="absolute inset-0 bg-gradient-to-r from-transparent via-[#a7d2ae]/80 to-transparent"
                                      initial={false}
                                      animate={
                                        reduceMotion
                                          ? undefined
                                          : { x: ["-100%", "100%"] }
                                      }
                                      transition={{
                                        duration: 1.7,
                                        delay: index * 0.14,
                                        ease: "easeInOut",
                                        repeat: Infinity,
                                        repeatDelay: 0.25,
                                      }}
                                    />
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="border-t border-[#e2e9e1] bg-white px-4 pt-3 pb-4 sm:px-6">
                {answerError ? (
                  <p
                    role="alert"
                    className="mb-2 rounded-xl bg-[#fff3ea] px-3 py-2 text-xs text-[#9a552f]"
                  >
                    {answerError}
                  </p>
                ) : null}
                {usage?.remaining === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce6dc] bg-[#f5f8f2] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#315740]">
                        Demo soru hakkınız doldu
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-[#6f8272]">
                        {usage.resetAt
                          ? `${formatDemoReset(usage.resetAt)} yeniden deneyebilirsiniz.`
                          : "24 saat içinde yeniden deneyebilirsiniz."}
                      </p>
                    </div>
                    <Link
                      href="/login"
                      className="rounded-full bg-[#245b3e] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#33764f]"
                    >
                      Uygulamayı keşfet
                    </Link>
                  </div>
                ) : (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void sendQuestion(question)
                    }}
                    className="flex items-end gap-2 rounded-2xl border border-[#dce6dc] bg-[#fafcf8] p-1.5 pl-3 transition-colors focus-within:border-[#83b28c]"
                  >
                    <textarea
                      ref={questionInput}
                      autoFocus
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault()
                          void sendQuestion(question)
                        }
                      }}
                      rows={2}
                      maxLength={240}
                      placeholder="Müşterinizin sorusunu yazın…"
                      aria-label="Demo sorusu"
                      className="max-h-28 min-h-12 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-[#24432e] outline-none placeholder:text-[#98a99a]"
                    />
                    <button
                      type="submit"
                      disabled={sending || !question.trim()}
                      aria-label="Soruyu gönder"
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#245b3e] text-white transition-[background,transform] hover:bg-[#33764f] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="size-5"
                      />
                    </button>
                  </form>
                )}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-[#8a998b]">
                  <span>
                    Ürün, stok ve mağaza politikaları örnektir. Yanıtlar
                    pazaryerine gönderilmez.
                  </span>
                  {usage && usage.remaining > 0 ? (
                    <span className="font-semibold text-[#547b5e]">
                      {usage.remaining}/{usage.limit} soru kaldı · 24 saatlik
                      sınır
                    </span>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}
    </ResponsiveDialog>
  )
}
