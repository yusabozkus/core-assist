"use client"

import { useState } from "react"
import {
  CheckmarkCircle01Icon,
  RefreshIcon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { AiResponsePreview } from "@/components/dashboard/ai/ai-response-preview"
import {
  CollectionCard,
  CollectionItem,
  FeedbackBanner,
  type SaveFeedback,
  SettingsCard,
  SettingsField,
  SettingsPageHeader,
  SettingsSelect,
  SettingsToggle,
} from "@/components/dashboard/ai/settings-card"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Textarea } from "@/components/ui/textarea"
import { updateStoreKnowledge } from "@/lib/api/knowledge"
import type {
  AiInstruction,
  AiResponseLength,
  AiTone,
  StoreKnowledge,
} from "@/types/knowledge"

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
  const [instructionDialogOpen, setInstructionDialogOpen] = useState(false)
  const [instructionDraft, setInstructionDraft] = useState("")
  const [isSavingBehavior, setIsSavingBehavior] = useState(false)
  const [isSavingInstruction, setIsSavingInstruction] = useState(false)
  const [removingInstruction, setRemovingInstruction] = useState<number>()
  const [behaviorFeedback, setBehaviorFeedback] = useState<SaveFeedback>()
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
        emojiEnabled: profile.emojiEnabled,
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
            <div className="grid gap-5 md:grid-cols-2">
              <SettingsSelect
                label="Yanıt tonu"
                description="Cevabın genel karakterini belirler."
                value={profileDraft.tone}
                onChange={(value) => updateProfile("tone", value as AiTone)}
                options={[
                  ["PROFESSIONAL", "Profesyonel"],
                  ["FRIENDLY", "Samimi"],
                  ["WARM", "Sıcak"],
                  ["MINIMAL", "Kısa ve doğrudan"],
                ]}
              />
              <SettingsSelect
                label="Yanıt uzunluğu"
                description="Gereksiz ayrıntı eklemeden hedef uzunluğu ayarlar."
                value={profileDraft.responseLength}
                onChange={(value) =>
                  updateProfile("responseLength", value as AiResponseLength)
                }
                options={[
                  ["SHORT", "Kısa"],
                  ["BALANCED", "Dengeli"],
                  ["DETAILED", "Detaylı"],
                ]}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <SettingsToggle
                label="Selamlama"
                description="Cevaba kısa bir selamlama ekler."
                checked={profileDraft.greetingEnabled}
                onChange={(checked) =>
                  updateProfile("greetingEnabled", checked)
                }
              />
              <SettingsToggle
                label="Kapanış"
                description="Mesajı nazik bir kapanışla bitirir."
                checked={profileDraft.closingEnabled}
                onChange={(checked) => updateProfile("closingEnabled", checked)}
              />
              <SettingsToggle
                label="Emoji"
                description="Uygun cevaplarda ölçülü emoji kullanır."
                checked={profileDraft.emojiEnabled}
                onChange={(checked) => updateProfile("emojiEnabled", checked)}
              />
            </div>
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
                />
              ))}
            </CollectionCard>
          </div>
        </div>

        <AiResponsePreview profile={profileDraft} />
      </div>

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
