"use client"

import { useId, useState, type ReactNode } from "react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  getPreferredEmojis,
  MAX_PREFERRED_EMOJIS,
  parseEmojiEntry,
} from "@/lib/emoji-preferences"
import type {
  AiEmojiPolicy,
  AiResponseLength,
  AiTone,
  StoreKnowledge,
} from "@/types/knowledge"

type Profile = StoreKnowledge["profile"]

type ResponseBehaviorControlsProps = {
  profile: Profile
  onChange: <Key extends keyof Profile>(key: Key, value: Profile[Key]) => void
}

const toneOptions: Array<{ value: AiTone; label: string; detail: string }> = [
  { value: "PROFESSIONAL", label: "Profesyonel", detail: "Ölçülü ve resmî" },
  { value: "FRIENDLY", label: "Samimi", detail: "Yakın ve gündelik" },
  { value: "WARM", label: "Sıcak", detail: "Nazik ve içten" },
  { value: "MINIMAL", label: "Doğrudan", detail: "Dolambaçsız ve net" },
]

const emojiOptions: Array<{ value: AiEmojiPolicy; label: string }> = [
  { value: "NEVER", label: "Kullanma" },
  { value: "WHEN_APPROPRIATE", label: "Uygun olduğunda" },
  { value: "ALWAYS", label: "Her yanıtta" },
]

const responseLengths: Array<{
  value: AiResponseLength
  label: string
  detail: string
}> = [
  { value: "SHORT", label: "Kısa", detail: "1–2 cümle" },
  { value: "BALANCED", label: "Dengeli", detail: "2–4 cümle" },
  { value: "DETAILED", label: "Detaylı", detail: "Gerektiğinde 3–5 cümle" },
]

export function ResponseBehaviorControls({
  profile,
  onChange,
}: ResponseBehaviorControlsProps) {
  const [emojiEntry, setEmojiEntry] = useState("")
  const [emojiFeedback, setEmojiFeedback] = useState<{
    message: string
    type: "error" | "limit"
  } | null>(null)
  const preferredEmojis = getPreferredEmojis(profile.preferredEmoji)
  const responseLengthIndex = Math.max(
    0,
    responseLengths.findIndex(
      (option) => option.value === profile.responseLength
    )
  )

  function addEmojis() {
    const entry = parseEmojiEntry(emojiEntry)
    if (!entry.valid) {
      setEmojiFeedback({
        type: "error",
        message:
          "Yalnızca emoji girin. Birden fazlasını birlikte ekleyebilirsiniz.",
      })
      return
    }

    const next = [...new Set([...preferredEmojis, ...entry.emojis])]
    if (next.length > MAX_PREFERRED_EMOJIS) {
      setEmojiFeedback({
        type: "limit",
        message:
          "Maksimum emoji sayısına ulaştınız. Yeni emoji eklemek için mevcutlardan birini kaldırın.",
      })
      return
    }

    onChange("preferredEmoji", next.join(" "))
    setEmojiEntry("")
    setEmojiFeedback(
      next.length === MAX_PREFERRED_EMOJIS
        ? {
            type: "limit",
            message:
              "Maksimum emoji sayısına ulaştınız. Yeni emoji eklemek için mevcutlardan birini kaldırın.",
          }
        : null
    )
  }

  function removeEmoji(emoji: string) {
    const next = preferredEmojis.filter((item) => item !== emoji)
    onChange("preferredEmoji", next.length ? next.join(" ") : null)
    setEmojiFeedback(null)
  }

  return (
    <div className="divide-y divide-border">
      <SettingRow title="Yanıt tonu" first>
        <ChoiceCards
          ariaLabel="Yanıt tonu"
          value={profile.tone}
          onValueChange={(value) => onChange("tone", value)}
          options={toneOptions}
          className="grid-cols-2"
        />
      </SettingRow>

      <SettingRow title="Yanıt uzunluğu">
        <Slider
          className="mt-4"
          value={[responseLengthIndex]}
          min={0}
          max={responseLengths.length - 1}
          step={1}
          onValueChange={([index]) => {
            const option = responseLengths[index]
            if (option) onChange("responseLength", option.value)
          }}
          aria-label="Yanıt uzunluğu"
        />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {responseLengths.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange("responseLength", option.value)}
              className={cn(
                "rounded-md py-1 text-xs transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                index === 0 && "text-left",
                index === 1 && "text-center",
                index === 2 && "text-right",
                profile.responseLength === option.value
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              )}
            >
              <span className="block">{option.label}</span>
              <span className="block text-[10px] font-normal text-muted-foreground">
                {option.detail}
              </span>
            </button>
          ))}
        </div>
      </SettingRow>

      <div className="mt-2 space-y-1">
        <SettingsSwitchRow
          title="Selamlama"
          description="Açıksa yanıt, seçtiğiniz tona uygun kısa bir selamlama ile başlar."
          checked={profile.greetingEnabled}
          onCheckedChange={(checked) => onChange("greetingEnabled", checked)}
        />
        <SettingsSwitchRow
          title="Kapanış"
          description="Açıksa yanıtın sonuna kısa bir nezaket cümlesi eklenir."
          checked={profile.closingEnabled}
          onCheckedChange={(checked) => onChange("closingEnabled", checked)}
        />
        <SettingsSwitchRow
          title="Boy ve kiloya göre beden tahmini"
          description="Boy ve kilo birlikte verilirse tahmini beden önerir. Otomatik gönderim yalnızca güvenli modun koşulları sağlanırsa yapılır."
          checked={profile.heightWeightSizeRecommendationEnabled}
          onCheckedChange={(checked) =>
            onChange("heightWeightSizeRecommendationEnabled", checked)
          }
        />
      </div>

      <section className="py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label
            htmlFor="response-emoji-policy"
            className="text-sm font-semibold"
          >
            Emoji kullanımı
          </label>
          <Select
            value={profile.emojiPolicy}
            onValueChange={(value) => {
              onChange("emojiPolicy", value as AiEmojiPolicy)
              setEmojiFeedback(null)
            }}
          >
            <SelectTrigger
              id="response-emoji-policy"
              size="sm"
              className="w-44 rounded-lg border-border bg-background"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {emojiOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {profile.emojiPolicy !== "NEVER" ? (
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <div>
              <label
                htmlFor="preferred-response-emojis"
                className="text-sm font-medium text-foreground"
              >
                Kullanılabilecek emojiler
              </label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Yanıtta bunlardan yalnızca biri kullanılır. Boş bırakırsanız AI
                seçer.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  id="preferred-response-emojis"
                  value={emojiEntry}
                  onChange={(event) => {
                    setEmojiEntry(event.target.value)
                    setEmojiFeedback(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.nativeEvent.isComposing)
                      return
                    event.preventDefault()
                    addEmojis()
                  }}
                  placeholder="Emoji yazın veya yapıştırın"
                  maxLength={320}
                  aria-invalid={emojiFeedback?.type === "error"}
                  aria-describedby={
                    emojiFeedback ? "preferred-emojis-feedback" : undefined
                  }
                  className="h-9 rounded-lg bg-background"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addEmojis}
                disabled={!emojiEntry.trim()}
                className="shrink-0"
              >
                Ekle
              </Button>
            </div>
            {emojiFeedback ? (
              <p
                id="preferred-emojis-feedback"
                role={emojiFeedback.type === "error" ? "alert" : "status"}
                className={cn(
                  "text-xs",
                  emojiFeedback.type === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {emojiFeedback.message}
              </p>
            ) : null}
            {preferredEmojis.length > 0 ? (
              <div
                className="flex flex-wrap gap-2"
                aria-label="Seçilen emojiler"
              >
                {preferredEmojis.map((emoji) => (
                  <span
                    key={emoji}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-1 pr-1 pl-2.5"
                  >
                    <span className="text-base leading-none">{emoji}</span>
                    <button
                      type="button"
                      onClick={() => removeEmoji(emoji)}
                      aria-label={`${emoji} emojisini kaldır`}
                      className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function SettingRow({
  title,
  children,
  first = false,
}: {
  title: string
  children: ReactNode
  first?: boolean
}) {
  return (
    <section className={cn("space-y-3 py-6", first && "pt-0")}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function ChoiceCards<Value extends string>({
  ariaLabel,
  value,
  onValueChange,
  options,
  className,
}: {
  ariaLabel: string
  value: Value
  onValueChange: (value: Value) => void
  options: Array<{ value: Value; label: string; detail: string }>
  className?: string
}) {
  const groupName = useId()

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("grid gap-2.5", className)}
    >
      {options.map((option) => {
        const selected = value === option.value

        return (
          <label
            key={option.value}
            className={cn(
              "relative flex min-h-21 cursor-pointer flex-col rounded-xl border px-3.5 py-3 transition-colors",
              selected
                ? "border-primary/60 bg-primary/6"
                : "border-border bg-background hover:border-primary/30 hover:bg-muted/25"
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={selected}
              onChange={() => onValueChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {option.label}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                )}
              >
                {selected ? (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </span>
            </span>
            <span className="mt-1 text-xs leading-4 text-muted-foreground">
              {option.detail}
            </span>
            <span className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" />
          </label>
        )
      })}
    </div>
  )
}

function SettingsSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()

  return (
    <div className="flex items-center justify-between gap-5 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {title}
          </label>
        </div>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={title}
      />
    </div>
  )
}
