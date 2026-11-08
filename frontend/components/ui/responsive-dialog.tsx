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
  headerActions?: ResponsiveDialogSlot
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  showCloseButton?: boolean
  preventClose?: boolean
  dismissOnOutsideInteraction?: boolean
  dismissOnEscape?: boolean
  contentClassName?: string
  scrollClassName?: string
  bodyClassName?: string
  headerClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  footerClassName?: string
}

function ResponsiveDialog({
  title,
  description,
  trigger,
  children,
  footer,
  headerActions,
  open,
  defaultOpen = false,
  onOpenChange,
  showCloseButton = true,
  preventClose = false,
  dismissOnOutsideInteraction = true,
  dismissOnEscape = true,
  contentClassName,
  scrollClassName,
  bodyClassName,
  headerClassName,
  titleClassName,
  descriptionClassName,
  footerClassName,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const resolvedOpen = open ?? internalOpen
  const currentContent = {
    title,
    description,
    children,
    footer,
    headerActions,
  }
  const [lastOpenContent, setLastOpenContent] = React.useState(currentContent)

  if (
    resolvedOpen &&
    (lastOpenContent.title !== title ||
      lastOpenContent.description !== description ||
      lastOpenContent.children !== children ||
      lastOpenContent.footer !== footer ||
      lastOpenContent.headerActions !== headerActions)
  ) {
    setLastOpenContent(currentContent)
  }

  const displayedContent = resolvedOpen ? currentContent : lastOpenContent

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && preventClose) return

    if (open === undefined) {
      setInternalOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }

  const controls: ResponsiveDialogControls = {
    close: () => handleOpenChange(false),
  }

  function handleOutsideInteraction(event: { preventDefault: () => void }) {
    if (preventClose || !dismissOnOutsideInteraction) event.preventDefault()
  }

  function handleEscapeKeyDown(event: KeyboardEvent) {
    if (preventClose || !dismissOnEscape) event.preventDefault()
  }

  if (isMobile) {
    return (
      <Drawer
        open={resolvedOpen}
        onOpenChange={handleOpenChange}
        dismissible={!preventClose}
      >
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent
          data-lenis-prevent
          onPointerDownOutside={handleOutsideInteraction}
          onInteractOutside={handleOutsideInteraction}
          onEscapeKeyDown={handleEscapeKeyDown}
          className={cn(
            "max-h-[96svh] overflow-hidden p-2 data-[vaul-drawer-direction=bottom]:max-h-[96svh]",
            contentClassName
          )}
        >
          {showCloseButton && !preventClose ? (
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-6 right-6 z-10 rounded-full bg-secondary text-muted-foreground"
                aria-label="Kapat"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            </DrawerClose>
          ) : null}

          {displayedContent.headerActions ? (
            <div
              className={cn(
                "absolute top-6 z-10 flex items-center",
                showCloseButton && !preventClose ? "right-16" : "right-6"
              )}
            >
              {renderSlot(displayedContent.headerActions, controls)}
            </div>
          ) : null}

          <div
            className={cn(
              "themed-scrollbar min-h-0 flex-1 overflow-y-auto",
              scrollClassName
            )}
          >
            <DrawerHeader
              className={cn(
                "border-b px-3 pt-4 pr-11 pb-3 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left",
                headerClassName
              )}
            >
              <DrawerTitle
                className={cn("text-lg tracking-[-0.02em]", titleClassName)}
              >
                {displayedContent.title}
              </DrawerTitle>
              {displayedContent.description ? (
                <DrawerDescription
                  className={cn("mt-1 leading-5", descriptionClassName)}
                >
                  {displayedContent.description}
                </DrawerDescription>
              ) : null}
            </DrawerHeader>

            <div className={cn("px-3 py-4", bodyClassName)}>
              {renderSlot(displayedContent.children, controls)}
            </div>

            {displayedContent.footer ? (
              <DrawerFooter
                className={cn(
                  "border-t bg-secondary/35 px-3 py-3",
                  footerClassName
                )}
              >
                {renderSlot(displayedContent.footer, controls)}
              </DrawerFooter>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        data-lenis-prevent
        onInteractOutside={handleOutsideInteraction}
        onEscapeKeyDown={handleEscapeKeyDown}
        showCloseButton={showCloseButton && !preventClose}
        className={cn(
          "max-h-[min(92svh,56rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg",
          contentClassName
        )}
      >
        {displayedContent.headerActions ? (
          <div
            className={cn(
              "absolute top-4 z-10 flex items-center",
              showCloseButton && !preventClose ? "right-14" : "right-4"
            )}
          >
            {renderSlot(displayedContent.headerActions, controls)}
          </div>
        ) : null}

        <DialogHeader
          className={cn("shrink-0 border-b px-5 py-4 pr-14", headerClassName)}
        >
          <DialogTitle className={cn("tracking-[-0.02em]", titleClassName)}>
            {displayedContent.title}
          </DialogTitle>
          {displayedContent.description ? (
            <DialogDescription className={descriptionClassName}>
              {displayedContent.description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div
          className={cn(
            "themed-scrollbar min-h-0 overflow-y-auto px-5 py-4",
            bodyClassName
          )}
        >
          {renderSlot(displayedContent.children, controls)}
        </div>

        {displayedContent.footer ? (
          <DialogFooter
            className={cn(
              "shrink-0 border-t bg-secondary/35 px-5 py-3",
              footerClassName
            )}
          >
            {renderSlot(displayedContent.footer, controls)}
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
