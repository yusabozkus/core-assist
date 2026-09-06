"use client"

import { useState, type ReactNode } from "react"
import {
  AiSparklesIcon,
  ArrowDown01Icon,
  CheckmarkCircle01Icon,
  PlusSignIcon,
  RefreshIcon,
  Settings02Icon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { AiResponsePreview } from "@/components/dashboard/ai/ai-response-preview"
import { AutomationModeSelector } from "@/components/dashboard/ai/automation-mode-selector"
import { ResponseBehaviorControls } from "@/components/dashboard/ai/response-behavior-controls"
import {
  CollectionItem,
  FeedbackBanner,
  type SaveFeedback,
  SettingsField,
} from "@/components/dashboard/ai/settings-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { updateStoreKnowledge } from "@/lib/api/knowledge"
import { cn } from "@/lib/utils"
import type { AiInstruction, StoreKnowledge } from "@/types/knowledge"

type Props = {
  storeId: string
  storeName: string
  initialKnowledge: StoreKnowledge
}

export function AiResponseSettings({
  storeId,
  storeName,
  initialKnowledge,
}: Props) {
  const [knowledge, setKnowledge] = useState(initialKnowledge)
  const [profileDraft, setProfileDraft] = useState(initialKnowledge.profile)
  const [automationModeDraft, setAutomationModeDraft] = useState(
    initialKnowledge.profile.automationMode
  )
  const [instructionDialogOpen, setInstructionDialogOpen] = useState(false)
  const [autoReplyConfirmationOpen, setAutoReplyConfirmationOpen] =
    useState(false)
  const [instructionDraft, setInstructionDraft] = useState("")
  const [isSavingBehavior, setIsSavingBehavior] = useState(false)
  const [isSavingAutomation, setIsSavingAutomation] = useState(false)
  const [isSavingInstruction, setIsSavingInstruction] = useState(false)
  const [removingInstruction, setRemovingInstruction] = useState<number>()
  const [behaviorFeedback, setBehaviorFeedback] = useState<SaveFeedback>()
  const [automationFeedback, setAutomationFeedback] = useState<SaveFeedback>()
  const [instructionFeedback, setInstructionFeedback] = useState<SaveFeedback>()
  const behaviorHasChanges = hasBehaviorChanges(knowledge.profile, profileDraft)
  const automationHasChanges =
    automationModeDraft !== knowledge.profile.automationMode ||
    profileDraft.minimumAutoSendConfidence !==
      knowledge.profile.minimumAutoSendConfidence
  const isSaving = isSavingBehavior || isSavingAutomation || isSavingInstruction
  const hasUnsavedChanges = behaviorHasChanges || automationHasChanges

  function updateProfile<Key extends keyof StoreKnowledge["profile"]>(
    key: Key,
    value: StoreKnowledge["profile"][Key]
  ) {
    setProfileDraft((current) => ({ ...current, [key]: value }))
    setBehaviorFeedback(undefined)
  }

  async function saveBehavior() {
    setIsSavingBehavior(true)
    setBehaviorFeedback(undefined)
    try {
      const profile = profileDraft
      const updated = await updateStoreKnowledge(storeId, {
        tone: profile.tone,
        responseLength: profile.responseLength,
        greetingEnabled: profile.greetingEnabled,
        closingEnabled: profile.closingEnabled,
        emojiPolicy: profile.emojiPolicy,
        preferredEmoji: profile.preferredEmoji,
      })
      setKnowledge(updated)
      setProfileDraft(updated.profile)
      setBehaviorFeedback({
        type: "success",
        message: "Yanıt davranışı kaydedildi.",
      })
    } catch (error) {
      setBehaviorFeedback(toErrorFeedback(error))
    } finally {
      setIsSavingBehavior(false)
    }
  }

  function requestAutomationModeSave() {
    if (automationModeDraft === "SAFE_AUTO") {
      setAutoReplyConfirmationOpen(true)
      return
    }

    void saveAutomationMode()
  }

  async function saveAutomationMode() {
    setIsSavingAutomation(true)
    setAutomationFeedback(undefined)
    try {
      const updated = await updateStoreKnowledge(storeId, {
        automationMode: automationModeDraft,
        minimumAutoSendConfidence: profileDraft.minimumAutoSendConfidence,
      })
      setKnowledge(updated)
      setProfileDraft((current) => ({
        ...current,
        automationMode: updated.profile.automationMode,
        minimumAutoSendConfidence: updated.profile.minimumAutoSendConfidence,
      }))
      setAutomationModeDraft(updated.profile.automationMode)
      setAutoReplyConfirmationOpen(false)
      setAutomationFeedback({
        type: "success",
        message: automationModeSavedMessage(updated.profile.automationMode),
      })
    } catch (error) {
      setAutomationFeedback(toErrorFeedback(error))
    } finally {
      setIsSavingAutomation(false)
    }
  }

  async function addInstruction() {
    const content = instructionDraft.trim()
    if (!content) return

    const nextInstructions: AiInstruction[] = [
      ...knowledge.instructions,
      {
        content,
        priority: knowledge.instructions.length,
        active: true,
      },
    ]
    setIsSavingInstruction(true)
    setInstructionFeedback(undefined)
    try {
      const updated = await updateStoreKnowledge(storeId, {
        instructions: nextInstructions,
      })
      setKnowledge(updated)
      setInstructionDraft("")
      setInstructionDialogOpen(false)
      setInstructionFeedback({
        type: "success",
        message: "AI talimatı eklendi ve kaydedildi.",
      })
    } catch (error) {
      setInstructionFeedback(toErrorFeedback(error))
    } finally {
      setIsSavingInstruction(false)
    }
  }

  async function removeInstruction(index: number) {
    const nextInstructions = knowledge.instructions.filter(
      (_, itemIndex) => itemIndex !== index
    )
    setRemovingInstruction(index)
    setInstructionFeedback(undefined)
    try {
      const updated = await updateStoreKnowledge(storeId, {
        instructions: nextInstructions,
      })
      setKnowledge(updated)
      setInstructionFeedback({
        type: "success",
        message: "AI talimatı kaldırıldı.",
      })
    } catch (error) {
      setInstructionFeedback(toErrorFeedback(error))
    } finally {
      setRemovingInstruction(undefined)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-[-0.03em]">
              Yanıt ayarları
            </h1>
            <Badge variant="secondary" className="font-medium">
              {storeName}
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Müşteri yanıtlarının çalışma ve iletişim biçimini yönetin.
          </p>
        </div>

        <SaveState isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} />
      </header>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <main className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <SettingsSection
            icon={AiSparklesIcon}
            title="Yanıt otomasyonu"
            description="Her yeni soruda uygulanacak akışı seçin."
            defaultOpen
            changed={automationHasChanges}
            action={
              <Button
                size="sm"
                variant={automationHasChanges ? "default" : "outline"}
                onClick={requestAutomationModeSave}
                disabled={isSavingAutomation || !automationHasChanges}
              >
                <HugeiconsIcon
                  icon={
                    isSavingAutomation ? RefreshIcon : CheckmarkCircle01Icon
                  }
                  className={cn("size-4", isSavingAutomation && "animate-spin")}
                />
                Otomasyonu kaydet
              </Button>
            }
          >
            <FeedbackBanner feedback={automationFeedback} />
            <AutomationModeSelector
              value={automationModeDraft}
              onChange={(value) => {
                setAutomationModeDraft(value)
                setAutomationFeedback(undefined)
              }}
            />
            <div className="border-t border-border pt-5">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Minimum otomatik gönderim güveni
                  </p>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                    Bu değer mağaza genelindeki alt sınırdır. Beden, stok ve
                    garanti gibi riskli konularda sistem daha yüksek bir eşik
                    uygulayabilir.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  %{Math.round(profileDraft.minimumAutoSendConfidence * 100)}
                </Badge>
              </div>
              <Slider
                className="mt-5"
                min={85}
                max={99}
                step={1}
                value={[
                  Math.round(profileDraft.minimumAutoSendConfidence * 100),
                ]}
                onValueChange={(values) => {
                  const nextValue = (values[0] ?? 85) / 100
                  setProfileDraft((current) => ({
                    ...current,
                    minimumAutoSendConfidence: nextValue,
                  }))
                  setAutomationFeedback(undefined)
                }}
                aria-label="Minimum otomatik gönderim güveni"
              />
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>%85</span>
                <span>%99</span>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={Settings02Icon}
            title="Yanıt biçimi"
            description="Cevapların müşteriye nasıl sunulacağını belirleyin."
            defaultOpen
            changed={behaviorHasChanges}
            action={
              <Button
                size="sm"
                variant={behaviorHasChanges ? "default" : "outline"}
                onClick={saveBehavior}
                disabled={isSavingBehavior || !behaviorHasChanges}
              >
                <HugeiconsIcon
                  icon={isSavingBehavior ? RefreshIcon : CheckmarkCircle01Icon}
                  className={cn("size-4", isSavingBehavior && "animate-spin")}
                />
                Ayarları kaydet
              </Button>
            }
          >
            <FeedbackBanner feedback={behaviorFeedback} />
            <ResponseBehaviorControls
              profile={profileDraft}
              onChange={updateProfile}
            />
          </SettingsSection>

          <SettingsSection
            icon={WorkflowSquare01Icon}
            title="Özel AI talimatları"
            description="Mağazanıza özgü kalıcı davranış kuralları ekleyin."
            badge={`${knowledge.instructions.length} kural`}
            last
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInstructionFeedback(undefined)
                  setInstructionDialogOpen(true)
                }}
                disabled={isSavingInstruction}
              >
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                Talimat ekle
              </Button>
            }
          >
            <FeedbackBanner feedback={instructionFeedback} />
            {knowledge.instructions.length > 0 ? (
              <div className="divide-y divide-border border-y border-border">
                {knowledge.instructions.map((instruction, index) => (
                  <CollectionItem
                    key={`${instruction.content}-${index}`}
                    title={`Kural ${String(index + 1).padStart(2, "0")}`}
                    description={instruction.content}
                    hierarchy="content-first"
                    onRemove={() => removeInstruction(index)}
                    isRemoving={removingInstruction === index}
                    removeConfirmation={{
                      title: "Talimatı silmek istediğinize emin misiniz?",
                      description:
                        "Bu talimat kalıcı olarak silinecek ve yeni AI taslaklarında artık uygulanmayacaktır. Bu işlem geri alınamaz.",
                      cancelLabel: "Vazgeç",
                      confirmLabel: "Evet, sil",
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="border-y border-dashed border-border py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  Henüz özel talimat bulunmuyor
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  AI’ın mağazanıza özgü davranması için ilk kuralınızı ekleyin.
                </p>
              </div>
            )}
          </SettingsSection>
        </main>

        <AiResponsePreview
          profile={profileDraft}
          automationMode={automationModeDraft}
        />
      </div>

      <ResponsiveDialog
        open={autoReplyConfirmationOpen}
        onOpenChange={setAutoReplyConfirmationOpen}
        preventClose={isSavingAutomation}
        title="Otomatik yanıtları etkinleştirin"
        description="Bu mod yalnızca güvenli kabul edilen AI taslaklarını bağlı pazaryerine sizin onayınızı beklemeden gönderir."
        footer={({ close }) => (
          <>
            <Button
              variant="outline"
              onClick={close}
              disabled={isSavingAutomation}
            >
              Vazgeç
            </Button>
            <Button
              onClick={() => void saveAutomationMode()}
              disabled={isSavingAutomation}
            >
              {isSavingAutomation ? (
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className="size-4 animate-spin"
                />
              ) : null}
              Evet, etkinleştir
            </Button>
          </>
        )}
      >
        <div className="space-y-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-3.5 text-sm leading-6">
          <p className="font-medium text-foreground">
            Otomatik gönderim için tüm koşullar birlikte aranır:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              AI güven puanı en az %
              {Math.round(profileDraft.minimumAutoSendConfidence * 100)}
              olmalıdır.
            </li>
            <li>Cevap doğrulanmış katalog verilerine dayanmalıdır.</li>
            <li>Eksik bilgi veya risk işareti bulunmamalıdır.</li>
            <li>Diğer cevaplar incelemeniz için taslak olarak kalır.</li>
          </ul>
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={instructionDialogOpen}
        onOpenChange={setInstructionDialogOpen}
        preventClose={isSavingInstruction}
        title="AI talimatı ekle"
        description="Kaydettiğiniz talimat yeni taslaklarda hemen kullanılmaya başlanır."
        footer={({ close }) => (
          <>
            <Button
              variant="outline"
              onClick={close}
              disabled={isSavingInstruction}
            >
              Vazgeç
            </Button>
            <Button
              onClick={addInstruction}
              disabled={!instructionDraft.trim() || isSavingInstruction}
            >
              {isSavingInstruction ? (
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className="size-4 animate-spin"
                />
              ) : null}
              Kaydet ve ekle
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <FeedbackBanner feedback={instructionFeedback} />
          <SettingsField
            label="Talimat"
            description="Kısa, açık ve tek bir davranış kuralı yazın."
          >
            <Textarea
              value={instructionDraft}
              onChange={(event) => setInstructionDraft(event.target.value)}
              placeholder="Kesin teslimat tarihi verme."
              className="min-h-32 bg-background leading-6"
              maxLength={1000}
            />
          </SettingsField>
        </div>
      </ResponsiveDialog>
    </div>
  )
}

function SettingsSection({
  icon,
  title,
  description,
  badge,
  changed = false,
  action,
  children,
  defaultOpen = false,
  last = false,
}: {
  icon: IconSvgElement
  title: string
  description: string
  badge?: string
  changed?: boolean
  action: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  last?: boolean
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn("group/section", !last && "border-b border-border")}
    >
      <section>
        <header className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
                <HugeiconsIcon icon={icon} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold tracking-[-0.015em]">
                    {title}
                  </span>
                  {badge ? (
                    <Badge variant="secondary" className="h-5 text-[10px]">
                      {badge}
                    </Badge>
                  ) : null}
                  {changed ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      <span className="size-1.5 rounded-full bg-current" />
                      Kaydedilmedi
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block max-w-2xl text-sm leading-5 text-muted-foreground">
                  {description}
                </span>
              </span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/section:rotate-180"
              />
            </button>
          </CollapsibleTrigger>
          <div className="shrink-0 pl-12 sm:pl-0">{action}</div>
        </header>
        <CollapsibleContent>
          <div className="space-y-4 px-5 pb-6 sm:px-6">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}

function SaveState({
  isSaving,
  hasUnsavedChanges,
}: {
  isSaving: boolean
  hasUnsavedChanges: boolean
}) {
  const label = isSaving
    ? "Değişiklikler kaydediliyor"
    : hasUnsavedChanges
      ? "Kaydedilmemiş değişiklikler var"
      : "Tüm ayarlar güncel"

  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
      {isSaving ? (
        <HugeiconsIcon icon={RefreshIcon} className="size-3.5 animate-spin" />
      ) : (
        <span
          className={cn(
            "size-2 rounded-full",
            hasUnsavedChanges ? "bg-amber-500" : "bg-emerald-500"
          )}
        />
      )}
      {label}
    </div>
  )
}

function hasBehaviorChanges(
  saved: StoreKnowledge["profile"],
  draft: StoreKnowledge["profile"]
) {
  return (
    saved.tone !== draft.tone ||
    saved.responseLength !== draft.responseLength ||
    saved.greetingEnabled !== draft.greetingEnabled ||
    saved.closingEnabled !== draft.closingEnabled ||
    saved.emojiPolicy !== draft.emojiPolicy ||
    saved.preferredEmoji !== draft.preferredEmoji
  )
}

function toErrorFeedback(error: unknown): SaveFeedback {
  return {
    type: "error",
    message:
      error instanceof Error ? error.message : "Değişiklikler kaydedilemedi.",
  }
}

function automationModeSavedMessage(
  mode: StoreKnowledge["profile"]["automationMode"]
) {
  if (mode === "SAFE_AUTO") {
    return "Güvenli otomatik yanıt modu etkinleştirildi."
  }
  if (mode === "SHADOW") {
    return "Otomatik taslak oluşturma etkinleştirildi; gönderim onayı sizde kalacak."
  }
  return "Yanıt otomasyonu kapatıldı."
}
