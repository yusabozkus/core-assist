"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { ADMIN_NAVIGATION } from "@/constants/admin"
import { cn } from "@/lib/utils"

export function AdminGlobalSearch({ className }: { className?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLocaleLowerCase("tr-TR") !== "k") return
      if (!event.metaKey && !event.ctrlKey) return

      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  function navigate(url: string) {
    setOpen(false)
    router.push(url)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-9 w-full items-center gap-2 rounded-xl border border-border/80 bg-card/70 px-3 text-left text-sm text-muted-foreground shadow-xs transition-colors hover:border-border hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className
        )}
        aria-label="Yönetim panelinde ara"
      >
        <HugeiconsIcon
          icon={SearchIcon}
          strokeWidth={2}
          className="size-4 shrink-0"
        />
        <span className="min-w-0 flex-1 truncate">
          Sayfa veya yönetim alanı ara
        </span>
        <kbd className="hidden h-5 items-center rounded-md border border-border bg-muted px-1.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline-flex">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Yönetim panelinde ara"
        description="Gitmek istediğiniz admin sayfasını bulun."
        className="sm:max-w-xl"
      >
        <Command>
          <CommandInput
            autoFocus
            placeholder="Müşteriler, destek, abonelikler..."
          />
          <CommandList>
            <CommandEmpty>Eşleşen yönetim alanı bulunamadı.</CommandEmpty>
            <CommandGroup heading="Yönetim alanları">
              {ADMIN_NAVIGATION.map((item) => (
                <CommandItem
                  key={item.url}
                  value={`${item.title} ${item.description}`}
                  onSelect={() => navigate(item.url)}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.title}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
