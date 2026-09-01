"use client"

import { useMemo, useState } from "react"
import {
  CheckmarkCircle01Icon,
  Package01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ChannelOverrideCard } from "@/components/dashboard/ai/channel-override-card"
import {
  CollectionCard,
  CollectionItem,
  FeedbackBanner,
  KnowledgeTextarea,
  type SaveFeedback,
  SettingsCard,
  SettingsField,
  SettingsPageHeader,
} from "@/components/dashboard/ai/settings-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Textarea } from "@/components/ui/textarea"
import { updateStoreKnowledge } from "@/lib/api/knowledge"
import type {
  ChannelKnowledgeOverride,
  KnowledgeFaq,
  StoreKnowledge,
} from "@/types/knowledge"

type Props = {
  storeId: string
  storeName: string
  initialKnowledge: StoreKnowledge
}

const EMPTY_FAQ = { question: "", answer: "" }

export function KnowledgeBaseSettings({
  storeId,
  storeName,
  initialKnowledge,
}: Props) {
  const [knowledge, setKnowledge] = useState(initialKnowledge)
  const [profileDraft, setProfileDraft] = useState(initialKnowledge.profile)
  const [overrideDrafts, setOverrideDrafts] = useState(() =>
    createOverrideDrafts(initialKnowledge)
  )
  const [faqDialogOpen, setFaqDialogOpen] = useState(false)
  const [faqDraft, setFaqDraft] = useState(EMPTY_FAQ)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingFaq, setIsSavingFaq] = useState(false)
  const [removingFaq, setRemovingFaq] = useState<number>()
  const [savingProvider, setSavingProvider] = useState<string>()
  const [profileFeedback, setProfileFeedback] = useState<SaveFeedback>()
  const [faqFeedback, setFaqFeedback] = useState<SaveFeedback>()
  const [providerFeedback, setProviderFeedback] = useState<
    Record<string, SaveFeedback>
  >({})

  const completedFields = useMemo(() => {
    const values = [
      profileDraft.brandDescription,
      profileDraft.shippingPolicy,
      profileDraft.returnPolicy,
      profileDraft.exchangePolicy,
      profileDraft.warrantyPolicy,
    ]
    return values.filter((value) => Boolean(value?.trim())).length
  }, [profileDraft])

  function updateProfile<Key extends keyof StoreKnowledge["profile"]>(
    key: Key,
    value: StoreKnowledge["profile"][Key]
  ) {
    setProfileDraft((current) => ({ ...current, [key]: value }))
    setProfileFeedback(undefined)
  }

  async function saveProfile() {
    setIsSavingProfile(true)
    setProfileFeedback(undefined)
    try {
      const updated = await updateStoreKnowledge(storeId, {
        brandDescription: profileDraft.brandDescription,
        shippingPolicy: profileDraft.shippingPolicy,
        returnPolicy: profileDraft.returnPolicy,
        exchangePolicy: profileDraft.exchangePolicy,
        warrantyPolicy: profileDraft.warrantyPolicy,
        additionalInformation: profileDraft.additionalInformation,
      })
      setKnowledge(updated)
      setProfileDraft(updated.profile)
      setProfileFeedback({
        type: "success",
        message: "Genel mağaza bilgileri kaydedildi.",
      })
    } catch (error) {
      setProfileFeedback(toErrorFeedback(error))
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function addFaq() {
    if (!faqDraft.question.trim() || !faqDraft.answer.trim()) return
    const nextFaqs: KnowledgeFaq[] = [
      ...knowledge.faqs,
      {
        question: faqDraft.question.trim(),
        answer: faqDraft.answer.trim(),
        active: true,
      },
    ]
    setIsSavingFaq(true)
    setFaqFeedback(undefined)
    try {
      const updated = await updateStoreKnowledge(storeId, { faqs: nextFaqs })
      setKnowledge(updated)
      setFaqDraft(EMPTY_FAQ)
      setFaqDialogOpen(false)
      setFaqFeedback({
        type: "success",
        message: "Sık sorulan soru eklendi ve kaydedildi.",
      })
    } catch (error) {
      setFaqFeedback(toErrorFeedback(error))
    } finally {
      setIsSavingFaq(false)
    }
  }

  async function removeFaq(index: number) {
    const nextFaqs = knowledge.faqs.filter(
      (_, itemIndex) => itemIndex !== index
    )
    setRemovingFaq(index)
    setFaqFeedback(undefined)
    try {
      const updated = await updateStoreKnowledge(storeId, { faqs: nextFaqs })
      setKnowledge(updated)
      setFaqFeedback({ type: "success", message: "Soru kaldırıldı." })
    } catch (error) {
      setFaqFeedback(toErrorFeedback(error))
    } finally {
      setRemovingFaq(undefined)
    }
  }

  async function saveProvider(providerKey: string) {
    const draft = overrideDrafts[providerKey]
    if (!draft) return

    const nextOverrides = [
      ...knowledge.channelOverrides.filter(
        (item) => item.providerKey !== providerKey
      ),
      ...(hasOverrideValue(draft) ? [draft] : []),
    ]
    setSavingProvider(providerKey)
    setProviderFeedback((current) => ({
      ...current,
      [providerKey]: undefined,
    }))
    try {
      const updated = await updateStoreKnowledge(storeId, {
        channelOverrides: nextOverrides,
      })
      setKnowledge(updated)
      setOverrideDrafts((current) => ({
        ...current,
        [providerKey]: getOverride(updated, providerKey),
      }))
      setProviderFeedback((current) => ({
        ...current,
        [providerKey]: {
          type: "success",
          message: `${formatProvider(providerKey)} bilgileri kaydedildi.`,
        },
      }))
    } catch (error) {
      setProviderFeedback((current) => ({
        ...current,
        [providerKey]: toErrorFeedback(error),
      }))
    } finally {
      setSavingProvider(undefined)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <SettingsPageHeader
        title="Bilgi tabanı"
        description="AI'ın katalog dışında kullanabileceği doğrulanmış mağaza politikalarını, sık sorulan soruları ve kanal farklılıklarını yönetin."
        storeName={storeName}
        icon={Package01Icon}
      />

      <div className="mt-6 grid gap-6">
        <SettingsCard
          title="Genel mağaza bilgileri"
          description="Bu bilgiler bütün satış kanallarında temel kaynak olarak kullanılır."
          badge={`${completedFields}/5 temel alan`}
          action={
            <Button size="sm" onClick={saveProfile} disabled={isSavingProfile}>
              <HugeiconsIcon
                icon={isSavingProfile ? RefreshIcon : CheckmarkCircle01Icon}
                className={`size-4 ${isSavingProfile ? "animate-spin" : ""}`}
              />
              Mağaza bilgilerini kaydet
            </Button>
          }
        >
          <FeedbackBanner feedback={profileFeedback} />
          <KnowledgeTextarea
            label="Marka ve mağaza açıklaması"
            description="Markanın yaklaşımı, ürün grubu ve müşteriye aktarılmasını istediğiniz temel bilgiler."
            value={profileDraft.brandDescription ?? ""}
            onChange={(value) => updateProfile("brandDescription", value)}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <KnowledgeTextarea
              label="Kargo ve teslimat"
              value={profileDraft.shippingPolicy ?? ""}
              onChange={(value) => updateProfile("shippingPolicy", value)}
            />
            <KnowledgeTextarea
              label="İade koşulları"
              value={profileDraft.returnPolicy ?? ""}
              onChange={(value) => updateProfile("returnPolicy", value)}
            />
            <KnowledgeTextarea
              label="Değişim koşulları"
              value={profileDraft.exchangePolicy ?? ""}
              onChange={(value) => updateProfile("exchangePolicy", value)}
            />
            <KnowledgeTextarea
              label="Garanti ve destek"
              value={profileDraft.warrantyPolicy ?? ""}
              onChange={(value) => updateProfile("warrantyPolicy", value)}
            />
          </div>
          <KnowledgeTextarea
            label="Diğer doğrulanmış bilgiler"
            description="Paketleme, fatura ve katalog dışında kalan diğer mağaza kuralları."
            value={profileDraft.additionalInformation ?? ""}
            onChange={(value) => updateProfile("additionalInformation", value)}
          />
        </SettingsCard>

        <div className="space-y-3">
          <FeedbackBanner feedback={faqFeedback} />
          <CollectionCard
            title="Sık sorulan sorular"
            description="Katalog dışında kalan tekrar eden sorular için mağazanızın doğrulanmış cevapları."
            addLabel="Soru ekle"
            onAdd={() => {
              setFaqFeedback(undefined)
              setFaqDialogOpen(true)
            }}
            isAdding={isSavingFaq}
            emptyLabel="Henüz sık sorulan soru eklenmedi."
          >
            {knowledge.faqs.map((faq, index) => (
              <CollectionItem
                key={`${faq.question}-${index}`}
                title={faq.question}
                description={faq.answer}
                onRemove={() => removeFaq(index)}
                isRemoving={removingFaq === index}
              />
            ))}
          </CollectionCard>
        </div>

        {knowledge.providers.length > 0 ? (
          <div className="grid gap-4">
            <div className="px-1">
              <h2 className="font-semibold tracking-[-0.015em]">
                Kanal istisnaları
              </h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Her kanal ayrı kaydedilir; bir karttaki değişiklik diğer kanalı
                etkilemez.
              </p>
            </div>
            {knowledge.providers.map((provider) => (
              <ChannelOverrideCard
                key={provider.providerKey}
                providerKey={provider.providerKey}
                value={overrideDrafts[provider.providerKey]}
                feedback={providerFeedback[provider.providerKey]}
                isSaving={savingProvider === provider.providerKey}
                onChange={(value) => {
                  setOverrideDrafts((current) => ({
                    ...current,
                    [provider.providerKey]: value,
                  }))
                  setProviderFeedback((current) => ({
                    ...current,
                    [provider.providerKey]: undefined,
                  }))
                }}
                onSave={() => saveProvider(provider.providerKey)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <ResponsiveDialog
        open={faqDialogOpen}
        onOpenChange={setFaqDialogOpen}
        preventClose={isSavingFaq}
        title="Sık sorulan soru ekle"
        description="Soru eklendiğinde bilgi tabanına hemen kaydedilir."
        footer={({ close }) => (
          <>
            <Button variant="outline" onClick={close} disabled={isSavingFaq}>
              Vazgeç
            </Button>
            <Button
              onClick={addFaq}
              disabled={
                !faqDraft.question.trim() ||
                !faqDraft.answer.trim() ||
                isSavingFaq
              }
            >
              {isSavingFaq ? (
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
          <FeedbackBanner feedback={faqFeedback} />
          <SettingsField label="Soru">
            <Input
              value={faqDraft.question}
              onChange={(event) =>
                setFaqDraft((current) => ({
                  ...current,
                  question: event.target.value,
                }))
              }
              placeholder="Siparişim ne zaman kargoya verilir?"
              maxLength={300}
            />
          </SettingsField>
          <SettingsField label="Doğrulanmış cevap">
            <Textarea
              value={faqDraft.answer}
              onChange={(event) =>
                setFaqDraft((current) => ({
                  ...current,
                  answer: event.target.value,
                }))
              }
              className="min-h-32 bg-background leading-6"
              maxLength={2000}
            />
          </SettingsField>
        </div>
      </ResponsiveDialog>
    </div>
  )
}

function createOverrideDrafts(knowledge: StoreKnowledge) {
  return Object.fromEntries(
    knowledge.providers.map((provider) => [
      provider.providerKey,
      getOverride(knowledge, provider.providerKey),
    ])
  ) as Record<string, ChannelKnowledgeOverride>
}

function getOverride(
  knowledge: StoreKnowledge,
  providerKey: string
): ChannelKnowledgeOverride {
  return (
    knowledge.channelOverrides.find(
      (item) => item.providerKey === providerKey
    ) ?? {
      providerKey,
      shippingPolicy: null,
      returnPolicy: null,
      exchangePolicy: null,
      warrantyPolicy: null,
      additionalInformation: null,
    }
  )
}

function hasOverrideValue(value: ChannelKnowledgeOverride) {
  return [
    value.shippingPolicy,
    value.returnPolicy,
    value.exchangePolicy,
    value.warrantyPolicy,
    value.additionalInformation,
  ].some((item) => Boolean(item?.trim()))
}

function formatProvider(providerKey: string) {
  if (providerKey === "trendyol") return "Trendyol"
  if (providerKey === "hepsiburada") return "Hepsiburada"
  return providerKey
}

function toErrorFeedback(error: unknown): SaveFeedback {
  return {
    type: "error",
    message:
      error instanceof Error ? error.message : "Değişiklikler kaydedilemedi.",
  }
}
