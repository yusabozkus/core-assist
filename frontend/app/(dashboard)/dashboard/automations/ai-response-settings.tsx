"use client"

import { useState } from "react"
import {
  CheckmarkCircle01Icon,
  RefreshIcon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { AiResponsePreview } from "@/components/dashboard/ai/ai-response-preview"
import { AutomationModeSelector } from "@/components/dashboard/ai/automation-mode-selector"
import { ResponseBehaviorControls } from "@/components/dashboard/ai/response-behavior-controls"
import {
  CollectionCard,
  CollectionItem,
  FeedbackBanner,
  type SaveFeedback,
  SettingsCard,
  SettingsField,
  SettingsPageHeader,
} from "@/components/dashboard/ai/settings-card"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Textarea } from "@/components/ui/textarea"
import { updateStoreKnowledge } from "@/lib/api/knowledge"
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
      })
      setKnowledge(updated)
      setProfileDraft((current) => ({
        ...current,
        automationMode: updated.profile.automationMode,
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
    <div className="mx-auto w-full max-w-7xl px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <SettingsPageHeader
        title="Yanıt ayarları"
        description="AI'ın müşterilerle nasıl konuşacağını belirleyin ve seçtiğiniz davranışı canlı olarak önizleyin. Doğruluk kuralları bu ayarlardan bağımsız korunur."
        storeName={storeName}
        icon={WorkflowSquare01Icon}
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid min-w-0 gap-6">
          <SettingsCard
            title="Yanıt otomasyonu"
            description="Yeni sorular geldiğinde AI'ın hangi aşamaya kadar ilerleyebileceğini belirleyin."
            action={
              <Button
                size="sm"
                onClick={requestAutomationModeSave}
                disabled={
                  isSavingAutomation ||
                  automationModeDraft === knowledge.profile.automationMode
                }
              >
                <HugeiconsIcon
                  icon={
                    isSavingAutomation ? RefreshIcon : CheckmarkCircle01Icon
                  }
                  className={`size-4 ${isSavingAutomation ? "animate-spin" : ""}`}
                />
                Modu kaydet
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
          </SettingsCard>

          <SettingsCard
            title="Yanıt davranışı"
            description="Ton, uzunluk ve mesaj biçimini mağazanızın iletişim diline göre ayarlayın."
            action={
              <Button
                size="sm"
                onClick={saveBehavior}
                disabled={isSavingBehavior}
              >
                <HugeiconsIcon
                  icon={isSavingBehavior ? RefreshIcon : CheckmarkCircle01Icon}
                  className={`size-4 ${isSavingBehavior ? "animate-spin" : ""}`}
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
          </SettingsCard>

          <div className="space-y-3">
            <FeedbackBanner feedback={instructionFeedback} />
            <CollectionCard
              title="Özel AI talimatları"
              description="Mağazanıza özgü kalıcı davranış kuralları. Talimatlar doğruluk ve güvenlik kontrollerini geçersiz kılamaz."
              addLabel="Talimat ekle"
              onAdd={() => {
                setInstructionFeedback(undefined)
                setInstructionDialogOpen(true)
              }}
              isAdding={isSavingInstruction}
              emptyLabel="Henüz özel AI talimatı eklenmedi."
            >
              {knowledge.instructions.map((instruction, index) => (
                <CollectionItem
                  key={`${instruction.content}-${index}`}
                  title={`Kural ${index + 1}`}
                  description={instruction.content}
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
            </CollectionCard>
          </div>
        </div>

        <AiResponsePreview profile={profileDraft} />
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
            <li>AI güven puanı en az %85 olmalıdır.</li>
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
  if (mode === "DRAFT_ONLY") {
    return "Yalnızca taslak modu etkinleştirildi."
  }
  if (mode === "SAFE_AUTO") {
    return "Güvenli otomatik yanıt modu etkinleştirildi."
  }
  return "Yanıt otomasyonu kapatıldı."
}
