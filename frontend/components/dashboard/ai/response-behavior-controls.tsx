"use client"

import { useId, type ReactNode } from "react"

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
  { value: "MINIMAL", label: "Doğrudan" },
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
      <SettingRow
        title="Yanıt tonu"
        description="Cevapların müşteride bıraktığı genel iletişim hissini belirler."
        first
      >
        <SegmentedControl
          ariaLabel="Yanıt tonu"
          value={profile.tone}
          onValueChange={(value) => onChange("tone", value)}
          options={toneOptions}
          className="grid-cols-2 sm:grid-cols-4"
        />
      </SettingRow>

      <SettingRow
        title="Yanıt uzunluğu"
        description="AI, gerekli bilgiyi bu hedef uzunluğa göre özetler."
      >
        <div className="px-1 py-1">
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Hedef cevap uzunluğu
            </p>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">
                {responseLength.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {responseLength.detail}
              </p>
            </div>
          </div>
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
          <div className="mt-3 grid grid-cols-3 text-[11px] text-muted-foreground">
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
                    "font-semibold text-primary"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </SettingRow>

      <div className="">
        <SettingsSwitchRow
          title="Selamlama kullan"
          description="Yanıtı kısa bir selamlama ile başlatır."
          checked={profile.greetingEnabled}
          onCheckedChange={(checked) => onChange("greetingEnabled", checked)}
        />
        <SettingsSwitchRow
          title="Kapanış kullan"
          description="Yanıtı nazik bir kapanış cümlesiyle tamamlar."
          checked={profile.closingEnabled}
          onCheckedChange={(checked) => onChange("closingEnabled", checked)}
        />
        <SettingsSwitchRow
          title="Boy ve kiloya göre beden önerisi"
          description="Boy ve kilo birlikte verilirse listelenen bedenlerden tahmini bir öneri hazırlar. Yalnızca Güvenli otomatik modunda ve güven eşiği sağlanırsa gönderir."
          checked={profile.heightWeightSizeRecommendationEnabled}
          onCheckedChange={(checked) =>
            onChange("heightWeightSizeRecommendationEnabled", checked)
          }
        />
      </div>

      <SettingRow
        title="Emoji kullanımı"
        description="Emojinin yanıtlarda ne sıklıkta yer alacağını belirleyin."
        last
      >
        <div className="space-y-4">
          <SegmentedControl
            ariaLabel="Emoji kullanımı"
            value={profile.emojiPolicy}
            onValueChange={(value) => onChange("emojiPolicy", value)}
            options={emojiOptions}
            className="grid-cols-3"
          />

          {profile.emojiPolicy !== "NEVER" ? (
            <div className="grid animate-in gap-3 border-l-2 border-primary/35 bg-primary/4 px-3.5 py-3 duration-200 fade-in slide-in-from-top-1 sm:grid-cols-[1fr_7rem] sm:items-center">
              <div>
                <label
                  htmlFor="preferred-response-emoji"
                  className="text-sm font-medium text-foreground"
                >
                  Tercih edilen emoji
                </label>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {profile.emojiPolicy === "ALWAYS"
                    ? "Her yanıtın sonunda yalnızca bir kez kullanılır."
                    : "Uygun bir yanıtta öncelikli olarak kullanılır."}
                </p>
              </div>
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
                className="h-10 bg-card text-center text-lg"
                aria-label="Tercih edilen emoji"
              />
            </div>
          ) : null}
        </div>
      </SettingRow>
    </div>
  )
}

function SettingRow({
  title,
  description,
  children,
  first = false,
  last = false,
}: {
  title: string
  description: string
  children: ReactNode
  first?: boolean
  last?: boolean
}) {
  return (
    <section className={cn("space-y-4 py-6", first && "pt-0", last && "pb-0")}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
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
              "min-w-0 rounded-md px-2.5 py-2 text-xs font-medium transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-sm",
              selected
                ? "bg-card text-foreground shadow-xs ring-1 ring-border/70"
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
    <div className="flex items-center justify-between gap-5 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {title}
        </label>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className={cn(
            "hidden text-[11px] font-medium sm:block",
            checked ? "text-primary" : "text-muted-foreground"
          )}
        >
          {checked ? "Açık" : "Kapalı"}
        </span>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label={title}
        />
      </div>
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
