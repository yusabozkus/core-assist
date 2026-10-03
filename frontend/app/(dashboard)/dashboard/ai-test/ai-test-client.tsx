"use client"

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import {
  AiSparklesIcon,
  Delete02Icon,
  LinkSquare02Icon,
  Loading03Icon,
  Search01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { ProductThumbnail } from "@/components/dashboard/catalog/products/product-thumbnail"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getCatalogProduct, getCatalogProducts } from "@/lib/api/catalog"
import { previewAiAnswer, type AiTestResult } from "@/lib/api/ai-test"
import type {
  CatalogProduct,
  CatalogProductListItem,
  CatalogProductPage,
} from "@/types/product"

type Message = {
  id: number
  question: string
  result?: AiTestResult
  error?: string
}

export function AiTestClient({
  storeId,
  initialPage,
}: {
  storeId: string
  initialPage: CatalogProductPage
}) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(initialPage)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [selectedProduct, setSelectedProduct] =
    useState<CatalogProductListItem | null>(null)
  const [productDetail, setProductDetail] = useState<CatalogProduct | null>(
    null
  )
  const [providerKey, setProviderKey] = useState("")
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isAnswering, setIsAnswering] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const requestRef = useRef<AbortController | null>(null)
  const moreRequestRef = useRef<AbortController | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const nextIdRef = useRef(1)

  useEffect(() => {
    moreRequestRef.current?.abort()
    moreRequestRef.current = null
    setIsLoadingMore(false)
    const query = search.trim()
    if (!query) {
      setPage(initialPage)
      setSearchError("")
      setIsSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsSearching(true)
      setSearchError("")
      try {
        setPage(
          await getCatalogProducts(storeId, {
            query,
            limit: 12,
            signal: controller.signal,
          })
        )
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchError(
            error instanceof Error ? error.message : "Ürünler yüklenemedi."
          )
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [initialPage, search, storeId])

  useEffect(() => {
    const chat = chatScrollRef.current
    chat?.scrollTo({ top: chat.scrollHeight, behavior: "smooth" })
  }, [messages, isAnswering])

  useEffect(() => {
    if (!selectedProduct) return

    const controller = new AbortController()
    void getCatalogProduct(storeId, selectedProduct.id, controller.signal)
      .then((product) => {
        if (!controller.signal.aborted) setProductDetail(product)
      })
      .catch(() => {
        if (!controller.signal.aborted) setProductDetail(null)
      })

    return () => controller.abort()
  }, [selectedProduct, storeId])

  useEffect(
    () => () => {
      requestRef.current?.abort()
      moreRequestRef.current?.abort()
    },
    []
  )

  function selectProduct(product: CatalogProductListItem) {
    requestRef.current?.abort()
    requestRef.current = null
    setIsAnswering(false)
    setSelectedProduct(product)
    setProductDetail(null)
    setProviderKey(product.providers[0]?.providerKey ?? "")
    setMessages([])
    setQuestion("")
  }

  function selectProvider(value: string) {
    requestRef.current?.abort()
    requestRef.current = null
    setIsAnswering(false)
    setProviderKey(value)
    setMessages([])
  }

  async function loadMore() {
    if (!page.nextCursor || isLoadingMore) return
    const controller = new AbortController()
    moreRequestRef.current = controller
    setIsLoadingMore(true)
    setSearchError("")
    try {
      const next = await getCatalogProducts(storeId, {
        query: search.trim(),
        cursor: page.nextCursor,
        limit: 12,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        setPage((current) => ({
          ...next,
          items: [...current.items, ...next.items],
        }))
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setSearchError(
          error instanceof Error ? error.message : "Ürünler yüklenemedi."
        )
      }
    } finally {
      if (moreRequestRef.current === controller) {
        moreRequestRef.current = null
        setIsLoadingMore(false)
      }
    }
  }

  async function sendQuestion(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const text = question.trim()
    if (!selectedProduct || text.length < 2 || isAnswering) return

    const id = nextIdRef.current++
    const controller = new AbortController()
    requestRef.current = controller
    setQuestion("")
    setMessages((current) => [...current, { id, question: text }])
    setIsAnswering(true)
    try {
      const result = await previewAiAnswer(
        storeId,
        {
          productId: selectedProduct.id,
          providerKey: providerKey || undefined,
          question: text,
        },
        controller.signal
      )
      if (!controller.signal.aborted) {
        setMessages((current) =>
          current.map((message) =>
            message.id === id ? { ...message, result } : message
          )
        )
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessages((current) =>
          current.map((message) =>
            message.id === id
              ? {
                  ...message,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Yanıt oluşturulamadı.",
                }
              : message
          )
        )
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setIsAnswering(false)
      }
    }
  }

  function onQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      void sendQuestion()
    }
  }

  const marketplaceUrl =
    productDetail && productDetail.id === selectedProduct?.id
      ? getMarketplaceUrl(productDetail, providerKey)
      : null

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-7xl flex-col gap-5 overflow-hidden px-4 py-5 sm:px-6 md:h-[calc(100dvh-4.5rem)] lg:px-8">
      <div className="shrink-0">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <HugeiconsIcon icon={AiSparklesIcon} className="size-4" />
          Geçici geliştirme aracı
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          AI yanıt testi
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ürün seçin ve müşteri sorularını deneyin. Yanıtlar kaydedilmez veya
          pazaryerine gönderilmez.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Stok sorularında canlı pazaryeri doğrulaması yapılmaz; gönderim kararı
          inceleme gerektirebilir.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,2fr)] gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <section
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card"
          aria-label="Ürün seçimi"
        >
          <div className="border-b border-border p-4">
            <h2 className="mb-3 text-sm font-semibold">Ürünler</h2>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün adı veya kodu ara"
              icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
              aria-label="Ürün ara"
            />
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
            {searchError ? (
              <p className="p-3 text-sm text-destructive" role="alert">
                {searchError}
              </p>
            ) : null}
            {isSearching ? (
              <p className="p-3 text-sm text-muted-foreground">Aranıyor…</p>
            ) : null}
            {!isSearching && page.items.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Ürün bulunamadı.
              </p>
            ) : null}
            {page.items.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => selectProduct(product)}
                aria-pressed={selectedProduct?.id === product.id}
                className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/70 ${selectedProduct?.id === product.id ? "bg-primary/10 ring-1 ring-primary/25" : ""}`}
              >
                <ProductThumbnail
                  title={product.title}
                  imageUrl={product.imageUrl}
                  sizes="48px"
                  className="size-12 rounded-lg bg-white"
                  imageClassName="object-contain"
                />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm leading-5 font-medium">
                    {product.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {[
                      product.brand,
                      product.providers
                        .map((item) => item.providerKey)
                        .join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Katalog ürünü"}
                  </span>
                </span>
              </button>
            ))}
            {page.nextCursor ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Yükleniyor…" : "Daha fazla ürün"}
              </Button>
            ) : null}
          </div>
        </section>

        <section
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card"
          aria-label="AI test sohbeti"
        >
          <div className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">
                {selectedProduct?.title ?? "Önce bir ürün seçin"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Her soru ayrı değerlendirilir · Test yanıtı
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selectedProduct ? (
                marketplaceUrl ? (
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5"
                  >
                    <a
                      href={marketplaceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Ürünü pazaryerinde aç"
                    >
                      <span className="hidden sm:inline">Pazaryerinde aç</span>
                      <HugeiconsIcon
                        icon={LinkSquare02Icon}
                        className="size-4"
                      />
                    </a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5"
                    disabled
                    title="Bu ürünün pazaryeri bağlantısı bulunamadı"
                  >
                    <span className="hidden sm:inline">Pazaryerinde aç</span>
                    <HugeiconsIcon icon={LinkSquare02Icon} className="size-4" />
                  </Button>
                )
              ) : null}
              {selectedProduct && selectedProduct.providers.length > 1 ? (
                <select
                  value={providerKey}
                  onChange={(event) => selectProvider(event.target.value)}
                  aria-label="Pazaryeri kanalı"
                  className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                >
                  {selectedProduct.providers.map((item) => (
                    <option key={item.providerKey} value={item.providerKey}>
                      {item.providerKey}
                    </option>
                  ))}
                </select>
              ) : null}
              {messages.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sohbeti temizle"
                  title="Sohbeti temizle"
                  onClick={() => setMessages([])}
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div
            ref={chatScrollRef}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-muted/15 px-4 py-6 sm:px-6"
          >
            {messages.length === 0 ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <HugeiconsIcon icon={AiSparklesIcon} className="size-6" />
                </span>
                <p className="text-sm font-medium">
                  {selectedProduct
                    ? "Bu ürün için ilk sorunuzu yazın"
                    : "Soldan test edilecek ürünü seçin"}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  Taslak yanıtı ve otomatik gönderime uygunluk kararını burada
                  göreceksiniz.
                </p>
              </div>
            ) : null}
            {messages.map((message) => (
              <div key={message.id} className="space-y-3">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm whitespace-pre-wrap text-primary-foreground">
                  {message.question}
                </div>
                <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-border bg-card p-4 shadow-xs sm:max-w-[85%]">
                  {message.result ? (
                    <AnswerResult result={message.result} />
                  ) : null}
                  {message.error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {message.error}
                    </p>
                  ) : null}
                  {!message.result && !message.error ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        className="size-4 animate-spin"
                      />{" "}
                      Yanıt hazırlanıyor…
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(event) => void sendQuestion(event)}
            className="shrink-0 border-t border-border bg-card p-3 sm:p-4"
          >
            <div className="flex items-end gap-2">
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={onQuestionKeyDown}
                placeholder={
                  selectedProduct
                    ? "Müşteri sorusunu yazın…"
                    : "Önce ürün seçin"
                }
                aria-label="Test sorusu"
                disabled={!selectedProduct || isAnswering}
                maxLength={1000}
                rows={2}
                className="max-h-40 min-h-16 overflow-y-auto"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Soruyu test et"
                disabled={
                  !selectedProduct || question.trim().length < 2 || isAnswering
                }
              >
                <HugeiconsIcon icon={SentIcon} className="size-5" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Enter ile gönder · Shift + Enter ile satır ekle
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}

function AnswerResult({ result }: { result: AiTestResult }) {
  if (result.decision === "DO_NOT_REPLY") {
    return (
      <p className="text-sm text-muted-foreground">
        Yanıt verilmez · Uygunsuz içerik politikası
      </p>
    )
  }

  return (
    <>
      <p className="text-sm leading-6 whitespace-pre-wrap">{result.answer}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
        <span
          className={`rounded-full px-2.5 py-1 font-medium ${result.decision === "READY_FOR_SEND" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}
        >
          {result.decision === "READY_FOR_SEND"
            ? "Gönderime hazır"
            : "İnceleme gerekli"}
        </span>
        <span className="text-muted-foreground">
          Güven %{Math.round(result.confidence * 100)}
        </span>
        <span className="text-muted-foreground">
          Otomatik gönderim ölçütü:{" "}
          {result.autoSend.wouldAutoSend ? "uygun" : "uygun değil"}
        </span>
      </div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          Karar ayrıntıları
        </summary>
        <div className="mt-2 space-y-2 leading-5">
          <p>Yorum: {result.interpretation}</p>
          <p>
            Yanıt kapsamı: {result.answerability} · Model: {result.model}
          </p>
          {result.missingInformation.length > 0 ? (
            <p>Eksik bilgi: {result.missingInformation.join("; ")}</p>
          ) : null}
          {result.risks.length > 0 ? (
            <p>Riskler: {result.risks.join(", ")}</p>
          ) : null}
          {result.autoSend.reasons.length > 0 ? (
            <p>
              Otomatik gönderim gerekçeleri:{" "}
              {result.autoSend.reasons.join(", ")}
            </p>
          ) : null}
          {result.evidence.length > 0 ? (
            <div>
              <p className="font-medium text-foreground">
                Kullanılan kaynaklar
              </p>
              <ul className="mt-1 list-inside list-disc">
                {result.evidence.map((item) => (
                  <li key={item.id}>
                    {item.label}: {item.value}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </>
  )
}

function getMarketplaceUrl(product: CatalogProduct, providerKey: string) {
  const sources = product.externalProducts
    .filter(
      (source) =>
        source.connection.providerKey === providerKey &&
        isSafeExternalUrl(source.externalUrl)
    )
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "ACTIVE" ? -1 : 1
      }
      return (
        new Date(right.lastSyncedAt).getTime() -
        new Date(left.lastSyncedAt).getTime()
      )
    })

  return sources[0]?.externalUrl ?? null
}

function isSafeExternalUrl(value: string | null): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.pathname !== "/"
  } catch {
    return false
  }
}
