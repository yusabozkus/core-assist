"use client"

import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

type ResponsiveDialogControls = {
  close: () => void
}

type ResponsiveDialogSlot =
  React.ReactNode | ((controls: ResponsiveDialogControls) => React.ReactNode)

type ResponsiveDialogProps = {
  title: React.ReactNode
  description?: React.ReactNode
  trigger?: React.ReactElement
  children: ResponsiveDialogSlot
  footer?: ResponsiveDialogSlot
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  showCloseButton?: boolean
  contentClassName?: string
  bodyClassName?: string
  headerClassName?: string
  footerClassName?: string
}

function ResponsiveDialog({
  title,
  description,
  trigger,
  children,
  footer,
  open,
  defaultOpen = false,
  onOpenChange,
  showCloseButton = true,
  contentClassName,
  bodyClassName,
  headerClassName,
  footerClassName,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const resolvedOpen = open ?? internalOpen

  function handleOpenChange(nextOpen: boolean) {
    if (open === undefined) {
      setInternalOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }

  const controls: ResponsiveDialogControls = {
    close: () => handleOpenChange(false),
  }

  if (isMobile) {
    return (
      <Drawer open={resolvedOpen} onOpenChange={handleOpenChange}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent
          className={cn("max-h-[92svh] overflow-hidden", contentClassName)}
        >
          {showCloseButton ? (
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-7 right-7 z-10 rounded-full bg-secondary text-muted-foreground"
                aria-label="Close"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            </DrawerClose>
          ) : null}

          <DrawerHeader
            className={cn(
              "shrink-0 border-b px-4 pt-5 pr-12 pb-4 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left",
              headerClassName
            )}
          >
            <DrawerTitle className="text-lg tracking-[-0.02em]">
              {title}
            </DrawerTitle>
            {description ? (
              <DrawerDescription className="mt-1 leading-5">
                {description}
              </DrawerDescription>
            ) : null}
          </DrawerHeader>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-4 py-5",
              bodyClassName
            )}
          >
            {renderSlot(children, controls)}
          </div>

          {footer ? (
            <DrawerFooter
              className={cn(
                "shrink-0 border-t bg-secondary/35 px-4 py-4",
                footerClassName
              )}
            >
              {renderSlot(footer, controls)}
            </DrawerFooter>
          ) : null}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn(
          "max-h-[min(85svh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg",
          contentClassName
        )}
      >
        <DialogHeader
          className={cn("shrink-0 border-b px-6 py-5 pr-14", headerClassName)}
        >
          <DialogTitle className="text-lg tracking-[-0.02em]">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="mt-1 leading-5">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className={cn("min-h-0 overflow-y-auto px-6 py-5", bodyClassName)}>
          {renderSlot(children, controls)}
        </div>

        {footer ? (
          <DialogFooter
            className={cn(
              "shrink-0 border-t bg-secondary/35 px-6 py-4",
              footerClassName
            )}
          >
            {renderSlot(footer, controls)}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function renderSlot(
  slot: ResponsiveDialogSlot,
  controls: ResponsiveDialogControls
) {
  return typeof slot === "function" ? slot(controls) : slot
}

export {
  ResponsiveDialog,
  type ResponsiveDialogControls,
  type ResponsiveDialogProps,
}
