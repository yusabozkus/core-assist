"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TeamAccessLevel, TeamStore } from "@/types/team"
import { TEAM_ACCESS_OPTIONS } from "@/lib/team"

export function TeamAccessFields({
  accessLevel,
  onAccessLevelChange,
  stores,
  selectedStoreIds,
  onSelectedStoreIdsChange,
  canAssignAccountAdmin,
  disabled,
}: {
  accessLevel: TeamAccessLevel
  onAccessLevelChange: (value: TeamAccessLevel) => void
  stores: TeamStore[]
  selectedStoreIds: string[]
  onSelectedStoreIdsChange: (ids: string[]) => void
  canAssignAccountAdmin: boolean
  disabled?: boolean
}) {
  const selectedOption = TEAM_ACCESS_OPTIONS.find(
    (option) => option.value === accessLevel
  )
  const requiresStoreSelection = accessLevel !== "ACCOUNT_ADMIN"

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="team-access-level" required>
          Yetki düzeyi
        </Label>
        <Select
          value={accessLevel}
          disabled={disabled}
          onValueChange={(value) =>
            onAccessLevelChange(value as TeamAccessLevel)
          }
        >
          <SelectTrigger
            id="team-access-level"
            className="h-11 w-full rounded-xl border-border bg-card"
          >
            <SelectValue>{selectedOption?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent
            align="start"
            className="w-[var(--radix-select-trigger-width)] min-w-80"
          >
            {TEAM_ACCESS_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="items-start py-3"
                disabled={
                  option.value === "ACCOUNT_ADMIN" && !canAssignAccountAdmin
                }
              >
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="font-medium text-foreground">
                    {option.label}
                  </span>
                  <span className="text-xs leading-4 font-normal whitespace-normal text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs leading-5 text-muted-foreground">
          {selectedOption?.description}
        </p>
      </div>

      {requiresStoreSelection ? (
        <fieldset className="space-y-2.5">
          <legend className="text-xs font-medium text-foreground">
            Mağaza erişimi <span className="text-destructive">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {stores.map((store) => {
              const checked = selectedStoreIds.includes(store.id)
              return (
                <label
                  key={store.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(nextChecked) => {
                      onSelectedStoreIdsChange(
                        nextChecked
                          ? [...selectedStoreIds, store.id]
                          : selectedStoreIds.filter((id) => id !== store.id)
                      )
                    }}
                  />
                  <span className="min-w-0 truncate text-sm font-medium">
                    {store.name}
                  </span>
                </label>
              )
            })}
          </div>
          {!stores.length ? (
            <p className="text-xs text-destructive">
              Yetki atanabilecek aktif bir mağaza bulunmuyor.
            </p>
          ) : null}
        </fieldset>
      ) : (
        <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs leading-5 text-muted-foreground">
          Hesap yöneticileri mevcut ve ileride oluşturulacak tüm mağazalara
          erişebilir.
        </div>
      )}
    </div>
  )
}
