"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
} from "react"
import Image from "next/image"
import {
  Delete02Icon,
  Image01Icon,
  ImageAdd01Icon,
  Loading03Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { getApiUrl } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type { SupportAttachment } from "@/types/support"

const MAX_IMAGES = 3
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

export type SelectedSupportImage = {
  file: File
  url: string
}

export function visibleSupportMessageBody(
  body: string,
  attachments: SupportAttachment[]
) {
  return attachments?.length && body.trim() === "Görsel eklendi" ? "" : body
}

export function isLongSupportMessage(body: string) {
  return body.replace(/\s+/g, " ").trim().length > 120
}

export function useSupportImageSelection() {
  const [images, setImages] = useState<SelectedSupportImage[]>([])
  const urlsRef = useRef(new Set<string>())

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  const addImages = useCallback(
    (selected: FileList | File[] | null) => {
      if (!selected?.length) return null
      const files = Array.from(selected)
      if (images.length + files.length > MAX_IMAGES) {
        return "Bir mesajda en fazla 3 görsel ekleyebilirsiniz."
      }
      if (
        files.some(
          (file) => file.size > MAX_BYTES || !ALLOWED_TYPES.has(file.type)
        )
      ) {
        return "PNG, JPEG veya WebP görselleri seçin (her biri en fazla 5 MB)."
      }

      const next = files.map((file) => {
        const url = URL.createObjectURL(file)
        urlsRef.current.add(url)
        return { file, url }
      })
      setImages((current) => [...current, ...next])
      return null
    },
    [images.length]
  )

  const removeImage = useCallback(
    (url: string) => {
      if (!images.some((image) => image.url === url)) return
      URL.revokeObjectURL(url)
      urlsRef.current.delete(url)
      setImages((current) => current.filter((image) => image.url !== url))
    },
    [images]
  )

  const clearImages = useCallback(() => {
    for (const image of images) {
      URL.revokeObjectURL(image.url)
      urlsRef.current.delete(image.url)
    }
    setImages([])
  }, [images])

  return { images, addImages, removeImage, clearImages }
}

export function handleSupportImagePaste(
  event: ClipboardEvent<HTMLTextAreaElement>,
  addImages: (files: File[]) => string | null,
  onError: (message: string | null) => void
) {
  const clipboardFiles = Array.from(event.clipboardData.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
  const files = clipboardFiles.length
    ? clipboardFiles
    : Array.from(event.clipboardData.files).filter((file) =>
        file.type.startsWith("image/")
      )

  if (!files.length) return
  event.preventDefault()
  onError(addImages(files))
}

export function SupportImagePicker({
  count,
  onSelect,
  onError,
  disabled,
}: {
  count: number
  onSelect: (files: FileList | File[] | null) => string | null
  onError: (message: string | null) => void
  disabled: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function selectFiles(selected: FileList | null) {
    onError(onSelect(selected))
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => selectFiles(event.target.files)}
      />
      <button
        type="button"
        aria-label="Görsel ekle"
        title="Görsel ekle"
        disabled={disabled || count >= MAX_IMAGES}
        onClick={() => inputRef.current?.click()}
        className="pointer-events-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
      >
        <HugeiconsIcon icon={ImageAdd01Icon} className="size-4.5" />
      </button>
    </>
  )
}

export function SupportImagePreviews({
  images,
  onRemove,
  disabled,
  floating = true,
}: {
  images: SelectedSupportImage[]
  onRemove: (url: string) => void
  disabled: boolean
  floating?: boolean
}) {
  if (!images.length) return null
  return (
    <div
      className={cn(
        "pointer-events-none flex flex-wrap gap-2 bg-transparent px-1",
        floating && "absolute inset-x-0 bottom-full z-20 pb-2"
      )}
    >
      {images.map(({ file, url }) => (
        <div key={url} className="relative size-20 shrink-0 sm:size-24">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${file.name} görselini yeni sekmede aç`}
            title={file.name}
            className="pointer-events-auto relative block size-full overflow-hidden rounded-xl border border-border bg-transparent shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Image
              src={url}
              alt={file.name}
              fill
              unoptimized
              sizes="96px"
              className="object-cover"
            />
          </a>
          <button
            type="button"
            aria-label={`${file.name} görselini kaldır`}
            title="Görseli kaldır"
            disabled={disabled}
            onClick={() => onRemove(url)}
            className="pointer-events-auto absolute top-1 right-1 z-10 flex size-6 items-center justify-center rounded-full bg-background/95 text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function SupportImageAttachments({
  ticketId,
  attachments,
  admin = false,
  embedded = false,
  expanded = false,
}: {
  ticketId: string
  attachments: SupportAttachment[]
  admin?: boolean
  embedded?: boolean
  expanded?: boolean
}) {
  if (!attachments?.length) return null
  const prefix = admin ? "/admin/support/tickets" : "/support/tickets"
  return (
    <div
      className={cn(
        "grid",
        embedded
          ? "w-full gap-px bg-border/80"
          : "w-[min(20rem,75vw)] max-w-full gap-1",
        attachments.length === 1
          ? "grid-cols-1"
          : embedded && expanded && attachments.length === 3
            ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-2"
      )}
    >
      {attachments.map((attachment, index) => {
        const url = getApiUrl(
          `${prefix}/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachment.id)}`
        )
        return (
          <SupportAttachmentTile
            key={attachment.id}
            url={url}
            index={index}
            hasDivider={attachments.length > 1}
            className={cn(
              "group relative block overflow-hidden",
              embedded ? "border-0" : "rounded-xl border border-border/70",
              attachments.length === 1
                ? embedded && expanded
                  ? "aspect-[4/3] sm:aspect-video"
                  : "aspect-[4/3]"
                : attachments.length === 3 && index === 2
                  ? embedded && expanded
                    ? "col-span-2 aspect-[2/1] sm:col-span-1 sm:aspect-square"
                    : "col-span-2 aspect-[2/1]"
                  : embedded && expanded && attachments.length === 2
                    ? "aspect-square sm:aspect-[4/3]"
                    : "aspect-square"
            )}
          />
        )
      })}
    </div>
  )
}

function SupportAttachmentTile({
  url,
  index,
  hasDivider,
  className,
}: {
  url: string
  index: number
  hasDivider: boolean
  className: string
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [attempt, setAttempt] = useState(0)
  const imageUrl = attempt ? `${url}?retry=${attempt}` : url

  return (
    <div className={className}>
      {status !== "error" ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${index + 1}. destek görselini tam boy aç`}
          aria-hidden={status !== "ready"}
          tabIndex={status === "ready" ? 0 : -1}
          className={cn(
            "absolute inset-0 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
            status !== "ready" && "pointer-events-none"
          )}
        >
          <Image
            src={imageUrl}
            alt="Destek mesajına eklenen görsel"
            fill
            unoptimized
            sizes="(max-width: 640px) 75vw, 320px"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
            className={cn(
              "object-cover transition-[opacity,transform] duration-200 group-hover:scale-[1.02]",
              status === "ready" ? "opacity-100" : "opacity-0"
            )}
          />
          {hasDivider ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 ring-1 ring-white/70 ring-inset"
            />
          ) : null}
        </a>
      ) : null}

      {status === "loading" ? (
        <div
          role="status"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted/70 p-2 text-center text-muted-foreground"
        >
          <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
          <span className="text-[10px] leading-tight sm:text-xs">
            Görsel yükleniyor
          </span>
        </div>
      ) : null}

      {status === "error" ? (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted p-1.5 text-center text-muted-foreground"
        >
          <HugeiconsIcon icon={Image01Icon} className="size-4" />
          <span className="text-[10px] leading-tight sm:text-xs">
            Görsel yüklenemedi
          </span>
          <button
            type="button"
            aria-label={`${index + 1}. görseli yeniden yükle`}
            onClick={() => {
              setAttempt((current) => current + 1)
              setStatus("loading")
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-3" />
            Tekrar dene
          </button>
        </div>
      ) : null}
    </div>
  )
}
