"use client"

import { useState, type ReactNode } from "react"
import {
  Delete02Icon,
  PlusSignIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export type SaveFeedback =
  { type: "success" | "error"; message: string } | undefined

export function SettingsPageHeader({
  title,
  description,
  storeName,
  icon,
}: {
  title: string
  description: string
  storeName: string
  icon: IconSvgElement
}) {
  return (
    <header className="flex min-w-0 items-start gap-3.5 border-b border-border pb-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <HugeiconsIcon icon={icon} className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-[-0.025em]">{title}</h1>
          <Badge variant="secondary">{storeName}</Badge>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </header>
  )
}

export function SettingsCard({
  title,
  description,
  action,
  badge,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  badge?: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold tracking-[-0.015em]">{title}</h2>
            {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </section>
  )
}

export function SettingsField({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  )
}

export function KnowledgeTextarea({
  label,
  description,
  value,
  onChange,
  minHeight = "min-h-24",
}: {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  minHeight?: string
}) {
  return (
    <SettingsField label={label} description={description}>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${minHeight} resize-y bg-background leading-6`}
        maxLength={4000}
      />
    </SettingsField>
  )
}

export function SettingsSelect({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
}) {
  return (
    <SettingsField label={label} description={description}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full rounded-lg border-border bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsField>
  )
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-4 py-3.5 transition-colors hover:bg-muted/35">
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  )
}

export function FeedbackBanner({ feedback }: { feedback: SaveFeedback }) {
  if (!feedback) return null

  return (
    <div
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${feedback.type === "success"
          ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/30 bg-destructive/8 text-destructive"
        }`}
    >
      {feedback.message}
    </div>
  )
}

export function CollectionCard({
  title,
  description,
  addLabel,
  onAdd,
  isAdding,
  emptyLabel,
  children,
}: {
  title: string
  description: string
  addLabel: string
  onAdd: () => void
  isAdding?: boolean
  emptyLabel: string
  children: ReactNode[]
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h2 className="font-semibold tracking-[-0.015em]">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} disabled={isAdding}>
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          {addLabel}
        </Button>
      </div>
      <div className="divide-y divide-border px-5 sm:px-6">
        {children.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

export function CollectionItem({
  title,
  description,
  onRemove,
  isRemoving,
  removeConfirmation,
}: {
  title: string
  description: string
  onRemove: () => void | Promise<void>
  isRemoving?: boolean
  removeConfirmation?: RemoveConfirmation
}) {
  return (
    <div className="flex items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {removeConfirmation ? (
        <RemoveConfirmationPopover
          confirmation={removeConfirmation}
          onRemove={onRemove}
          isRemoving={isRemoving}
        />
      ) : (
        <RemoveButton onClick={onRemove} disabled={isRemoving} />
      )}
    </div>
  )
}

type RemoveConfirmation = {
  title: string
  description: string
  cancelLabel?: string
  confirmLabel?: string
}

function RemoveButton({
  onClick,
  disabled,
}: {
  onClick?: () => void | Promise<void>
  disabled?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      aria-label="Kaldır"
      className="text-muted-foreground hover:text-destructive"
    >
      <HugeiconsIcon icon={Delete02Icon} className="size-4" />
    </Button>
  )
}

function RemoveConfirmationPopover({
  confirmation,
  onRemove,
  isRemoving,
}: {
  confirmation: RemoveConfirmation
  onRemove: () => void | Promise<void>
  isRemoving?: boolean
}) {
  const [open, setOpen] = useState(false)

  async function confirmRemove() {
    await onRemove()
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isRemoving) setOpen(nextOpen)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isRemoving}
          aria-label="Kaldır"
          className="text-muted-foreground hover:text-destructive"
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
      >
        <div>
          <p className="text-sm leading-5 font-semibold">
            {confirmation.title}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {confirmation.description}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isRemoving}
          >
            {confirmation.cancelLabel ?? "Vazgeç"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={confirmRemove}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <HugeiconsIcon
                icon={RefreshIcon}
                className="size-4 animate-spin"
              />
            ) : null}
            {confirmation.confirmLabel ?? "Evet, sil"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
