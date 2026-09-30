"use client"

import { useMemo, useState } from "react"
import {
  ArrowRight01Icon,
  BookOpen02Icon,
  ChatQuestion01Icon,
  Delete02Icon,
  Edit02Icon,
  PlusSignIcon,
  RefreshIcon,
  Search01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

import { ChannelOverrideCard } from "@/components/dashboard/ai/channel-override-card"
import {
  FeedbackBanner,
  type SaveFeedback,
  SettingsField,
} from "@/components/dashboard/ai/settings-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { APP_ROUTES } from "@/constants/site"
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

const EMPTY_FAQ = { question: "", answer: "", active: true }
type ProfileFieldKey =
  | "brandDescription"
  | "shippingPolicy"
  | "returnPolicy"
  | "exchangePolicy"
  | "warrantyPolicy"
  | "additionalInformation"

const profileFields: Array<{
  key: ProfileFieldKey
  title: string
  description: string
  placeholder: string
}> = [
  {
    key: "brandDescription",
    title: "Mağaza ve marka açıklaması",
    description:
      "Markanızın yaklaşımı ve müşteriye aktarılmasını istediğiniz temel bilgiler.",
    placeholder: "Mağazanızı ve ürünlerinizi kısaca anlatın…",
  },
  {
    key: "shippingPolicy",
    title: "Kargo ve teslimat",
    description: "Kargo firmaları, hazırlık süresi ve teslimat koşulları.",
    placeholder: "Hangi kargolarla, ne zaman gönderim yapıyorsunuz?",
  },
  {
    key: "returnPolicy",
    title: "İade koşulları",
    description: "İade süresi, kapsamı ve işlem adımları.",
    placeholder: "Müşteriler ürünleri hangi koşullarda iade edebilir?",
  },
  {
    key: "exchangePolicy",
    title: "Değişim koşulları",
    description: "Beden veya ürün değişimi için uygulanan kurallar.",
    placeholder: "Değişim sürecinizi açıklayın…",
  },
  {
    key: "warrantyPolicy",
    title: "Garanti ve destek",
    description: "Garanti kapsamı ve satış sonrası destek bilgileri.",
    placeholder: "Garanti ve destek koşullarınızı açıklayın…",
  },
  {
    key: "additionalInformation",
    title: "Diğer bilgiler",
    description: "Paketleme, fatura ve diğer doğrulanmış mağaza kuralları.",
    placeholder: "AI'ın bilmesini istediğiniz diğer mağaza bilgileri…",
  },
]

export function KnowledgeBaseSettings({
  storeId,
  storeName,
  initialKnowledge,
}: Props) {
  const [knowledge, setKnowledge] = useState(initialKnowledge)
  const [overrideDrafts, setOverrideDrafts] = useState(() =>
    createOverrideDrafts(initialKnowledge)
  )
  const [editingField, setEditingField] = useState<ProfileFieldKey | null>(null)
  const [fieldDraft, setFieldDraft] = useState("")
  const [faqEditor, setFaqEditor] = useState<
    | {
        index: number | null
        question: string
        answer: string
        active: boolean
      }
    | undefined
  >()
  const [deletingFaqIndex, setDeletingFaqIndex] = useState<number>()
  const [faqSearch, setFaqSearch] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingFaq, setIsSavingFaq] = useState(false)
  const [removingFaq, setRemovingFaq] = useState<number>()
  const [savingProvider, setSavingProvider] = useState<string>()
  const [profileFeedback, setProfileFeedback] = useState<SaveFeedback>()
  const [faqFeedback, setFaqFeedback] = useState<SaveFeedback>()
  const [providerFeedback, setProviderFeedback] = useState<
    Record<string, SaveFeedback>
  >({})

  const completedFields = profileFields.filter((field) =>
    Boolean(knowledge.profile[field.key]?.trim())
  ).length
  const customizedProviders =
    knowledge.channelOverrides.filter(hasOverrideValue).length
  const faqMatches = useMemo(() => {
    const search = faqSearch.trim().toLocaleLowerCase("tr-TR")
    return knowledge.faqs
      .map((faq, index) => ({ faq, index }))
      .filter(({ faq }) =>
        search
          ? `${faq.question} ${faq.answer}`
              .toLocaleLowerCase("tr-TR")
              .includes(search)
          : true
      )
  }, [faqSearch, knowledge.faqs])

  function openField(key: ProfileFieldKey) {
    setFieldDraft(knowledge.profile[key] ?? "")
    setProfileFeedback(undefined)
    setEditingField(key)
  }

  function cancelProfileEdit() {
    setEditingField(null)
    setProfileFeedback(undefined)
  }

  async function saveProfile() {
    if (!editingField) return
    setIsSavingProfile(true)
    setProfileFeedback(undefined)
    try {
      const updated = await updateStoreKnowledge(storeId, {
        [editingField]: fieldDraft.trim(),
      })
      setKnowledge(updated)
      setEditingField(null)
      setProfileFeedback({
        type: "success",
        message: fieldDraft.trim() ? "Bilgi kaydedildi." : "Bilgi kaldırıldı.",
      })
    } catch (error) {
      setProfileFeedback(toErrorFeedback(error))
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function addFaq() {
    if (!faqEditor?.question.trim() || !faqEditor.answer.trim()) return
    const nextFaq: KnowledgeFaq = {
      question: faqEditor.question.trim(),
      answer: faqEditor.answer.trim(),
      active: faqEditor.active,
    }
    const nextFaqs: KnowledgeFaq[] =
      faqEditor.index === null
        ? [...knowledge.faqs, nextFaq]
        : knowledge.faqs.map((faq, index) =>
            index === faqEditor.index ? nextFaq : faq
          )
    setIsSavingFaq(true)
    setFaqFeedback(undefined)
    try {
      const updated = await updateStoreKnowledge(storeId, { faqs: nextFaqs })
      setKnowledge(updated)
      setFaqEditor(undefined)
      setFaqFeedback({
        type: "success",
        message:
          faqEditor.index === null ? "Soru eklendi." : "Soru güncellendi.",
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
      setDeletingFaqIndex(undefined)
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
    <div className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <header className="flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-primary">
            <HugeiconsIcon icon={BookOpen02Icon} className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Bilgi tabanı
              </h1>
              <Badge variant="secondary">{storeName}</Badge>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              AI&apos;ın müşteri sorularını yanıtlarken kullanacağı doğrulanmış
              mağaza bilgilerini burada yönetin.
            </p>
          </div>
        </div>
        <Link
          href={APP_ROUTES.dashboard.settings.root}
          className="inline-flex w-fit items-center gap-1.5 rounded-md px-1 py-1.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          Mağaza ayarları
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </Link>
      </header>

      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
        <nav
          aria-label="Bilgi tabanı bölümleri"
          className="flex gap-1 overflow-x-auto border-b border-border pb-2 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:border-0 lg:pb-0"
        >
          <a
            href="#profile"
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring lg:w-full"
          >
            <HugeiconsIcon
              icon={Store01Icon}
              className="size-4 text-muted-foreground"
            />
            <span className="flex-1">Mağaza bilgileri</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedFields}/6
            </span>
          </a>
          <a
            href="#faq"
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring lg:w-full"
          >
            <HugeiconsIcon
              icon={ChatQuestion01Icon}
              className="size-4 text-muted-foreground"
            />
            <span className="flex-1">Sık sorulanlar</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {knowledge.faqs.length}
            </span>
          </a>
          <a
            href="#channels"
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring lg:w-full"
          >
            <HugeiconsIcon
              icon={BookOpen02Icon}
              className="size-4 text-muted-foreground"
            />
            <span className="flex-1">Kanal farkları</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {customizedProviders}
            </span>
          </a>
          <p className="mt-4 hidden px-3 text-xs leading-5 text-muted-foreground lg:block">
            Kanalda farklı bir bilgi yoksa genel mağaza bilgisi kullanılır.
          </p>
        </nav>

        <div className="min-w-0 space-y-12">
          <section id="profile" className="scroll-mt-8 space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Mağaza bilgileri
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Tüm kanallarda geçerli temel kaynak. Her bilgiyi ayrı
                düzenleyebilirsiniz.
              </p>
            </div>
            {editingField === null ? (
              <FeedbackBanner feedback={profileFeedback} />
            ) : null}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border bg-muted/20 px-5 py-3 sm:px-6">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Mağaza bağlamı
                </h3>
              </div>
              <KnowledgeFieldRow
                field={profileFields[0]}
                value={knowledge.profile.brandDescription}
                isEditing={editingField === "brandDescription"}
                draft={fieldDraft}
                feedback={profileFeedback}
                isSaving={isSavingProfile}
                editDisabled={editingField !== null}
                onEdit={() => openField("brandDescription")}
                onDraftChange={setFieldDraft}
                onSave={saveProfile}
                onCancel={cancelProfileEdit}
              />
              <div className="border-y border-border bg-muted/20 px-5 py-3 sm:px-6">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Sipariş ve satış sonrası
                </h3>
              </div>
              {profileFields.slice(1, 5).map((field) => (
                <KnowledgeFieldRow
                  key={field.key}
                  field={field}
                  value={knowledge.profile[field.key]}
                  isEditing={editingField === field.key}
                  draft={fieldDraft}
                  feedback={profileFeedback}
                  isSaving={isSavingProfile}
                  editDisabled={editingField !== null}
                  onEdit={() => openField(field.key)}
                  onDraftChange={setFieldDraft}
                  onSave={saveProfile}
                  onCancel={cancelProfileEdit}
                />
              ))}
              <div className="border-y border-border bg-muted/20 px-5 py-3 sm:px-6">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Ek bilgi
                </h3>
              </div>
              <KnowledgeFieldRow
                field={profileFields[5]}
                value={knowledge.profile.additionalInformation}
                isEditing={editingField === "additionalInformation"}
                draft={fieldDraft}
                feedback={profileFeedback}
                isSaving={isSavingProfile}
                editDisabled={editingField !== null}
                onEdit={() => openField("additionalInformation")}
                onDraftChange={setFieldDraft}
                onSave={saveProfile}
                onCancel={cancelProfileEdit}
              />
            </div>
          </section>

          <section id="faq" className="scroll-mt-8 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Sık sorulan sorular
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                  Mağaza politikalarının dışında kalan, tekrar eden sorulara
                  hazır ve doğrulanmış cevaplar ekleyin.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setFaqFeedback(undefined)
                  setFaqEditor({ index: null, ...EMPTY_FAQ })
                }}
              >
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                Soru ekle
              </Button>
            </div>
            <FeedbackBanner feedback={faqFeedback} />
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {knowledge.faqs.length > 0 ? (
                <div className="border-b border-border p-4 sm:px-5">
                  <Input
                    value={faqSearch}
                    onChange={(event) => setFaqSearch(event.target.value)}
                    placeholder="Sorularda ara"
                    aria-label="Sık sorulan sorularda ara"
                    icon={
                      <HugeiconsIcon icon={Search01Icon} className="size-4" />
                    }
                    className="h-9! bg-background"
                  />
                </div>
              ) : null}
              {faqMatches.length > 0 ? (
                <div className="divide-y divide-border/70">
                  {faqMatches.map(({ faq, index }) => (
                    <div
                      key={`${faq.question}-${index}`}
                      className="flex items-start gap-3 px-5 py-4 sm:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium">
                            {faq.question}
                          </h3>
                          {!faq.active ? (
                            <Badge variant="secondary">Pasif</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 whitespace-pre-line text-muted-foreground">
                          {faq.answer}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${faq.question} sorusunu düzenle`}
                          onClick={() => {
                            setFaqFeedback(undefined)
                            setFaqEditor({
                              index,
                              question: faq.question,
                              answer: faq.answer,
                              active: faq.active,
                            })
                          }}
                        >
                          <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${faq.question} sorusunu kaldır`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingFaqIndex(index)}
                          disabled={removingFaq === index}
                        >
                          <HugeiconsIcon
                            icon={Delete02Icon}
                            className="size-4"
                          />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium">
                    {knowledge.faqs.length
                      ? "Aramayla eşleşen soru yok"
                      : "Henüz soru eklenmedi"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {knowledge.faqs.length
                      ? "Başka bir kelime deneyin."
                      : "İlk soruyu ekleyerek AI'a doğrulanmış bir cevap sağlayın."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section id="channels" className="scroll-mt-8 space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Kanal farkları
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Yalnızca ilgili pazaryerinde farklı olan koşulları girin. Boş
                alanlarda genel bilgi kullanılır.
              </p>
            </div>
            {knowledge.providers.length > 0 ? (
              <div className="grid gap-3">
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
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card px-6 py-9 text-center">
                <p className="text-sm font-medium">Henüz bağlı kanal yok</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Kanal bağladığınızda buraya özel bilgiler ekleyebilirsiniz.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <ResponsiveDialog
        open={faqEditor !== undefined}
        onOpenChange={(open) => {
          if (!open) setFaqEditor(undefined)
        }}
        preventClose={isSavingFaq}
        title={
          faqEditor?.index === null ? "Sık sorulan soru ekle" : "Soruyu düzenle"
        }
        description="Müşterinin sorabileceği bir soru ve doğrulanmış cevabını yazın."
        footer={({ close }) => (
          <>
            <Button variant="outline" onClick={close} disabled={isSavingFaq}>
              Vazgeç
            </Button>
            <Button
              onClick={addFaq}
              disabled={
                !faqEditor?.question.trim() ||
                !faqEditor.answer.trim() ||
                isSavingFaq
              }
            >
              {isSavingFaq ? (
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className="size-4 animate-spin"
                />
              ) : null}
              Kaydet
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <FeedbackBanner feedback={faqFeedback} />
          <SettingsField label="Soru">
            <Input
              value={faqEditor?.question ?? ""}
              aria-label="Soru"
              onChange={(event) =>
                setFaqEditor((current) =>
                  current
                    ? { ...current, question: event.target.value }
                    : current
                )
              }
              placeholder="Siparişim ne zaman kargoya verilir?"
              maxLength={300}
            />
          </SettingsField>
          <SettingsField label="Doğrulanmış cevap">
            <Textarea
              value={faqEditor?.answer ?? ""}
              aria-label="Doğrulanmış cevap"
              onChange={(event) =>
                setFaqEditor((current) =>
                  current ? { ...current, answer: event.target.value } : current
                )
              }
              className="min-h-36 resize-y bg-background leading-6"
              maxLength={2000}
            />
          </SettingsField>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">AI yanıtlarında kullan</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                Kapalıysa soru saklanır, ancak AI bu cevabı kullanmaz.
              </p>
            </div>
            <Switch
              checked={faqEditor?.active ?? true}
              onCheckedChange={(active) =>
                setFaqEditor((current) =>
                  current ? { ...current, active } : current
                )
              }
              aria-label="AI yanıtlarında kullan"
            />
          </div>
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={deletingFaqIndex !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeletingFaqIndex(undefined)
        }}
        preventClose={removingFaq !== undefined}
        title="Soruyu kaldır"
        description="Bu soru ve cevabı bilgi tabanından silinecek."
        footer={({ close }) => (
          <>
            <Button
              variant="outline"
              onClick={close}
              disabled={removingFaq !== undefined}
            >
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              disabled={removingFaq !== undefined}
              onClick={() => {
                if (deletingFaqIndex !== undefined)
                  void removeFaq(deletingFaqIndex)
              }}
            >
              {removingFaq !== undefined ? (
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className="size-4 animate-spin"
                />
              ) : null}
              Soruyu kaldır
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <FeedbackBanner feedback={faqFeedback} />
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium">
            {deletingFaqIndex !== undefined
              ? knowledge.faqs[deletingFaqIndex]?.question
              : null}
          </p>
        </div>
      </ResponsiveDialog>
    </div>
  )
}

function KnowledgeFieldRow({
  field,
  value,
  isEditing,
  draft,
  feedback,
  isSaving,
  editDisabled,
  onEdit,
  onDraftChange,
  onSave,
  onCancel,
}: {
  field: (typeof profileFields)[number]
  value: string | null
  isEditing: boolean
  draft: string
  feedback?: SaveFeedback
  isSaving: boolean
  editDisabled: boolean
  onEdit: () => void
  onDraftChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const hasValue = Boolean(value?.trim())
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-border/70 px-5 py-5 last:border-b-0 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            {field.title}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {field.description}
          </p>
        </div>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            disabled={editDisabled}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`${field.title} düzenle`}
          >
            <HugeiconsIcon icon={Edit02Icon} className="size-3.5" />
            <span className="hidden sm:inline">
              {hasValue ? "Düzenle" : "Ekle"}
            </span>
          </Button>
        ) : null}
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-primary/80 uppercase">
          Kayıtlı bilgi
        </p>
        {isEditing ? (
          <div className="mt-2 space-y-3">
            <Textarea
              autoFocus
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              aria-label={`${field.title} kayıtlı bilgisi`}
              placeholder={field.placeholder}
              disabled={isSaving}
              className="min-h-36 resize-y leading-6"
              maxLength={4000}
            />
            <FeedbackBanner feedback={feedback} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-muted-foreground">
                Boş kaydederek bilgiyi kaldırabilirsiniz.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={isSaving}
                >
                  Vazgeç
                </Button>
                <Button
                  size="sm"
                  onClick={onSave}
                  disabled={isSaving || draft.trim() === (value ?? "").trim()}
                >
                  {isSaving ? (
                    <HugeiconsIcon
                      icon={RefreshIcon}
                      className="size-3.5 animate-spin"
                    />
                  ) : null}
                  Kaydet
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p
            className={`mt-1.5 text-[15px] leading-7 whitespace-pre-line ${!expanded ? "line-clamp-3" : ""} ${hasValue ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            {hasValue ? value : "Henüz bilgi eklenmedi"}
          </p>
        )}
        {!isEditing && hasValue && value && value.length > 220 ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            className="mt-1 rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? "Daha az göster" : "Tamamını göster"}
          </button>
        ) : null}
      </div>
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
