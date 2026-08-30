"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  CheckmarkBadge01Icon,
  InformationCircleIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateCurrentUser } from "@/lib/api/users"
import { getInitials } from "@/lib/utils"

type ProfileFormProps = {
  user: {
    name: string
    email: string
    emailVerified: boolean
    image?: string | null
  }
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedName = name.trim()
    if (normalizedName.length < 2) {
      setError("Ad soyad en az 2 karakter olmalıdır.")
      return
    }

    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const updatedUser = await updateCurrentUser({ name: normalizedName })
      setName(updatedUser.name)
      setMessage("Hesap bilgileriniz güncellendi.")
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Hesap bilgileri güncellenemedi."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form
        onSubmit={handleSubmit}
        className="border border-border bg-card p-6 shadow-xs sm:p-8"
      >
        <div className="flex items-start gap-4 border-b border-border pb-6">
          <Avatar className="size-14">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name} />
            ) : null}
            <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 pt-1">
            <h2 className="font-semibold text-foreground">Kişisel bilgiler</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Dashboard içinde görünen adınızı buradan düzenleyebilirsiniz.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Ad soyad</Label>
            <Input
              id="profile-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={80}
              autoComplete="name"
              disabled={isSaving}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-email">E-posta adresi</Label>
            <Input id="profile-email" value={user.email} disabled readOnly />
            <p className="text-xs leading-5 text-muted-foreground">
              E-posta adresiniz bağlı Google hesabınız tarafından yönetilir.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <div className="min-h-5 text-sm" aria-live="polite">
            {error ? <span className="text-destructive">{error}</span> : null}
            {message ? (
              <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4" />
                {message}
              </span>
            ) : null}
          </div>
          <Button
            type="submit"
            disabled={isSaving || name.trim() === user.name}
          >
            {isSaving ? "Kaydediliyor..." : "Değişiklikleri kaydet"}
          </Button>
        </div>
      </form>

      <aside className="h-fit border border-border bg-card p-6 shadow-xs">
        <span className="flex size-9 items-center justify-center bg-primary/10 text-primary">
          <HugeiconsIcon icon={UserCircleIcon} className="size-5" />
        </span>
        <h2 className="mt-5 font-semibold text-foreground">Hesap güvenliği</h2>
        <div className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
          <HugeiconsIcon
            icon={InformationCircleIcon}
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          <p className="leading-6">
            Kimliğiniz Google ile doğrulanır. CoreAssist parolanızı görmez veya
            saklamaz.
          </p>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <p className="text-xs font-medium text-muted-foreground">
            E-posta durumu
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {user.emailVerified ? "Doğrulanmış" : "Doğrulama bekliyor"}
          </p>
        </div>
      </aside>
    </div>
  )
}
