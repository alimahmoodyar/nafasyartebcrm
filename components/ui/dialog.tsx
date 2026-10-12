"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useWorkspaceModalBack } from "@/components/trace/program-workspace"

const WorkspaceDialogContext = React.createContext<{
  open: boolean
  modal: boolean
  close: () => void
  content: React.RefObject<HTMLDivElement | null>
} | null>(null)

function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  modal = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const content = React.useRef<HTMLDivElement | null>(null)
  const isOpen = open ?? internalOpen
  const changeOpen = React.useCallback((next: boolean) => {
    if (!next && content.current) {
      const marker = '[data-workspace-mutation-busy="true"]'
      const pending = [...(content.current.matches(marker) ? [content.current] : []), ...content.current.querySelectorAll<HTMLElement>(marker)]
      if (pending.some(node => node.isConnected && !!node.getClientRects().length && !node.closest('[hidden], [aria-hidden="true"], [data-state="closed"]') && getComputedStyle(node).visibility !== "hidden")) return
    }
    if (open === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }, [open, onOpenChange])
  const context = React.useMemo(() => ({
    open: isOpen,
    modal,
    close: () => changeOpen(false),
    content,
  }), [isOpen, modal, changeOpen])
  return <WorkspaceDialogContext.Provider value={context}>
    <DialogPrimitive.Root data-slot="dialog" open={isOpen} modal={modal} onOpenChange={changeOpen} {...props} />
  </WorkspaceDialogContext.Provider>
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  style,
  ref: forwardedRef,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const dialog = React.useContext(WorkspaceDialogContext)
  const modalBack = useWorkspaceModalBack(() => dialog?.close(), !!dialog?.open && dialog.modal && !props.asChild)
  const scoped = modalBack.scoped && !!dialog?.modal && !props.asChild
  const opener = React.useRef<HTMLElement | null>(null)
  const contentRef = React.useCallback((node: HTMLDivElement | null) => {
    if (dialog) dialog.content.current = node
    modalBack.ref(node)
    if (typeof forwardedRef === "function") {
      const cleanup = forwardedRef(node)
      if (typeof cleanup === "function") return () => {
        cleanup()
        modalBack.ref(null)
        if (dialog) dialog.content.current = null
      }
    } else if (forwardedRef) forwardedRef.current = node
  }, [modalBack.ref, forwardedRef, dialog?.content])
  const panelClass = cn(
    "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
    className
  )
  const closeButton = showCloseButton && (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    >
      <XIcon />
      <span className="sr-only">بستن پنجره</span>
    </DialogPrimitive.Close>
  )
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        {...props}
        ref={contentRef}
        className={scoped ? "fixed inset-0 z-50 outline-none" : panelClass}
        style={scoped ? { pointerEvents: "none" } : style}
        onOpenAutoFocus={event => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          onOpenAutoFocus?.(event)
        }}
        onCloseAutoFocus={event => {
          onCloseAutoFocus?.(event)
          if (!scoped || event.defaultPrevented) return
          event.preventDefault()
          const visible = (node: HTMLElement | null): node is HTMLElement =>
            !!node?.isConnected && !!node.getClientRects().length && !node.closest('[hidden], [aria-hidden="true"]') && getComputedStyle(node).visibility !== "hidden"
          if (visible(opener.current)) {
            opener.current.focus({ preventScroll: true })
            if (document.activeElement === opener.current) return
          }
          const back = Array.from(document.querySelectorAll<HTMLElement>('[data-workspace-header-back]')).find(visible)
          back?.focus({ preventScroll: true })
        }}
      >
        {scoped ? <div data-slot="dialog-panel" data-state={dialog?.open ? "open" : "closed"} className={panelClass} style={{ ...style, pointerEvents: "auto" }}>
          {children}
          {closeButton}
        </div> : <>{children}{closeButton}</>}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
