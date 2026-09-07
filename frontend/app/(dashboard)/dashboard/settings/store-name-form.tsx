"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  CheckmarkCircle01Icon,
  Edit02Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateStore } from "@/lib/api/stores"

type StoreNameFormProps = {
  storeId: string
  initialName: string
}

export function StoreNameForm({ storeId, initialName }: StoreNameFormProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditing) return

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  const normalizedName = name.trim()
  const hasChanges = normalizedName !== savedName
  const isValid = normalizedName.length >= 2

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isValid || !hasChanges) return

    setIsSaving(true)
    setError(null)

    try {
      const updatedStore = await updateStore(storeId, { name: normalizedName })
      setName(updatedStore.name)
      setSavedName(updatedStore.name)
      setIsEditing(false)
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Mağaza adı güncellenemedi."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-0.5 min-w-0">
      <Label htmlFor="store-name" className="sr-only">
        Mağaza adı
      </Label>
      <div className="flex min-w-0 items-center gap-1.5">
        {isEditing ? (
          <Input
            ref={inputRef}
            id="store-name"
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Escape" || isSaving) return

              setName(savedName)
              setIsEditing(false)
              setError(null)
            }}
            minLength={2}
            maxLength={80}
            autoComplete="organization"
            disabled={isSaving}
            className="h-8 w-full max-w-sm bg-background px-2.5 text-base font-semibold tracking-[-0.025em] sm:text-lg"
            required
          />
        ) : (
          <h1 className="truncate text-xl font-semibold tracking-[-0.025em] text-foreground">
            {savedName}
          </h1>
        )}

        <Button
          type={isEditing ? "submit" : "button"}
          variant="ghost"
          size="icon-sm"
          onClick={
            isEditing
              ? undefined
              : () => {
                  setIsEditing(true)
                  setError(null)
                }
          }
          disabled={isSaving || (isEditing && (!isValid || !hasChanges))}
          aria-label={
            isEditing ? "Mağaza adını kaydet" : "Mağaza adını düzenle"
          }
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon
            icon={
              isSaving
                ? RefreshIcon
                : isEditing
                  ? CheckmarkCircle01Icon
                  : Edit02Icon
            }
            className={`size-4 ${isSaving ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {error ? (
        <p className="mt-1 text-xs text-destructive" aria-live="polite">
          {error}
        </p>
      ) : null}
    </form>
  )
}
