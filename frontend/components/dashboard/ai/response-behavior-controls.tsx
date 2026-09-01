"use client"

import { useId } from "react"

import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
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

const toneOptions: Array<{ value: AiTone; label: string }> = [
  { value: "PROFESSIONAL", label: "Profesyonel" },
  { value: "FRIENDLY", label: "Samimi" },
  { value: "WARM", label: "Sıcak" },
  { value: "MINIMAL", label: "Kısa ve doğrudan" },
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
  const responseLengthIndex = Math.max(
    0,
    responseLengths.findIndex(
      (option) => option.value === profile.responseLength
    )
  )
  const responseLength = responseLengths[responseLengthIndex]

  return (
    <div className="divide-y divide-border">
      <section className="space-y-3.5 pb-6">
        <SettingHeading
          title="Yanıt tonu"
          description="Müşteriye verilen cevapların genel iletişim karakterini belirler."
        />
        <SegmentedControl
          ariaLabel="Yanıt tonu"
          value={profile.tone}
          onValueChange={(value) => onChange("tone", value)}
          options={toneOptions}
          className="grid-cols-2 sm:grid-cols-4"
        />
      </section>

      <section className="space-y-5 py-6">
        <div className="flex items-start justify-between gap-4">
          <SettingHeading
            title="Yanıt uzunluğu"
            description="AI, sorunun gerektirdiği bilgiyi seçtiğiniz hedef uzunlukta aktarır."
          />
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-foreground">
              {responseLength.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {responseLength.detail}
            </p>
          </div>
        </div>
        <div className="px-1">
          <Slider
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
          <div className="mt-3 grid grid-cols-3 text-xs text-muted-foreground">
            {responseLengths.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange("responseLength", option.value)}
                className={cn(
                  "rounded-sm py-1 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  index === 0 && "text-left",
                  index === 1 && "text-center",
                  index === 2 && "text-right",
                  profile.responseLength === option.value &&
                    "font-medium text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3 py-6">
        <SettingHeading
          title="Mesaj yapısı"
          description="Yanıtın başlangıç ve bitiş biçimini ayrı ayrı yönetin."
        />
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
          <SettingsSwitchRow
            title="Selamlama"
            description="Cevaba “Merhaba” veya “Merhabalar” ile başlar."
            checked={profile.greetingEnabled}
            onCheckedChange={(checked) => onChange("greetingEnabled", checked)}
          />
          <SettingsSwitchRow
            title="Kapanış"
            description="Yanıtı kısa ve nazik bir kapanış cümlesiyle tamamlar."
            checked={profile.closingEnabled}
            onCheckedChange={(checked) => onChange("closingEnabled", checked)}
          />
        </div>
      </section>

      <section className="space-y-3.5 pt-6">
        <SettingHeading
          title="Emoji kullanımı"
          description="Emojinin cevaplarda ne sıklıkta kullanılacağını belirleyin. Bu seçim özel talimatlardan önceliklidir."
        />
        <SegmentedControl
          ariaLabel="Emoji kullanımı"
          value={profile.emojiPolicy}
          onValueChange={(value) => onChange("emojiPolicy", value)}
          options={emojiOptions}
          className="grid-cols-3"
        />

        {profile.emojiPolicy !== "NEVER" ? (
          <div className="animate-in pt-1 duration-200 fade-in slide-in-from-top-1">
            <label
              htmlFor="preferred-response-emoji"
              className="text-sm font-medium text-foreground"
            >
              Tercih edilen emoji
            </label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {profile.emojiPolicy === "ALWAYS"
                ? "Her yanıtın sonunda bu emoji bir kez kullanılır."
                : "AI emoji kullanmayı seçerse öncelikle bu emojiyi kullanır."}
            </p>
            <Input
              id="preferred-response-emoji"
              value={profile.preferredEmoji ?? ""}
              onChange={(event) =>
                onChange(
                  "preferredEmoji",
                  normalizePreferredEmoji(event.target.value)
                )
              }
              placeholder="🙂"
              inputMode="text"
              maxLength={16}
              className="mt-2.5 h-10 max-w-48 rounded-lg bg-background text-base"
              aria-label="Tercih edilen emoji"
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}

function SettingHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function SegmentedControl<Value extends string>({
  ariaLabel,
  value,
  onValueChange,
  options,
  className,
}: {
  ariaLabel: string
  value: Value
  onValueChange: (value: Value) => void
  options: Array<{ value: Value; label: string }>
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "grid rounded-lg border border-border bg-muted p-1",
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "min-w-0 rounded-md px-2.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-sm",
              selected
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
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
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()

  return (
    <div className="flex items-center justify-between gap-5 px-4 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {title}
        </label>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
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

function normalizePreferredEmoji(value: string) {
  return (
    value
      .trim()
      .match(
        /(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?)*)/u
      )?.[0] ?? null
  )
}
