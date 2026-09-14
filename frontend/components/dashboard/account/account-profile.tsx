"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  CheckmarkBadge01Icon,
  InformationCircleIcon,
  Mail01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateCurrentUser } from "@/lib/api/users"
import {
  getTeamAccessDescription,
  getTeamAccessLabel,
} from "@/lib/team"
import { getInitials } from "@/lib/utils"
import type { TeamAccessLevel } from "@/types/team"

type AccountProfileProps = {
  user: {
    name: string
    email: string
    emailVerified: boolean
    image?: string | null
  }
  accessLevel: "OWNER" | TeamAccessLevel
}

export function AccountProfile({ user, accessLevel }: AccountProfileProps) {
  const router = useRouter()
  const accessLabel = getTeamAccessLabel(accessLevel)
  const accessDescription = getTeamAccessDescription(accessLevel)
  const [name, setName] = useState(user.name)
  const [savedName, setSavedName] = useState(user.name)
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
      setSavedName(updatedUser.name)
      setMessage("Profil bilgileriniz güncellendi.")
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Profil bilgileriniz güncellenemedi."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-5 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <Avatar className="size-16 border border-border shadow-xs">
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">
              Profil bilgileri
            </h2>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="bg-background text-[10px]">
                {accessLabel}
              </Badge>
              <HoverCard openDelay={180} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${accessLabel} rolü hakkında bilgi`}
                    className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      className="size-3.5"
                    />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent
                  align="start"
                  sideOffset={6}
                  className="w-72 rounded-xl p-4"
                >
                  <p className="text-sm font-semibold">{accessLabel}</p>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {accessDescription}
                  </p>
                </HoverCardContent>
              </HoverCard>
            </div>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Panelde ve ekip alanlarında görünen kişisel bilgileriniz.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-6 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="profile-name" className="flex items-center gap-2">
              <HugeiconsIcon
                icon={UserCircleIcon}
                className="size-4 text-muted-foreground"
              />
              Ad soyad
            </Label>
            <Input
              id="profile-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={80}
              autoComplete="name"
              disabled={isSaving}
              className="bg-background"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-email" className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Mail01Icon}
                className="size-4 text-muted-foreground"
              />
              E-posta adresi
            </Label>
            <Input
              id="profile-email"
              value={user.email}
              className="bg-muted/35 text-muted-foreground"
              disabled
              readOnly
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
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
            disabled={isSaving || name.trim() === savedName}
          >
            {isSaving ? "Kaydediliyor..." : "Değişiklikleri kaydet"}
          </Button>
        </div>
      </form>
    </section>
  )
}
