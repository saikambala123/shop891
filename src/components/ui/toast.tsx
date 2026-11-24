"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      // Bottom-anchored on every screen size: a top toast physically
      // covered the sticky navbar and swallowed taps (Sign in, search,
      // cart…). pointer-events-none on the viewport keeps the area
      // around toasts fully clickable; only the toasts themselves
      // capture input. Respects the iPhone home-bar safe area.
      "pointer-events-none fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-xl border p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants>
>(({ className, variant, onOpenChange, ...props }, ref) => {
  // ── Swipe / drag-to-dismiss (any direction) ────────────────
  // Works for touch and mouse. preventDefault() on pointer-down
  // takes over from Radix's built-in horizontal-only swipe so the
  // two never fight. Drag past ~60px and release → the toast is
  // flung away; release earlier and it springs back.
  const rootRef = React.useRef<HTMLLIElement | null>(null)
  const drag = React.useRef<{ id: number; x: number; y: number } | null>(null)
  const movedRef = React.useRef(false)

  const setRefs = React.useCallback(
    (node: HTMLLIElement | null) => {
      rootRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref)
        (ref as React.MutableRefObject<HTMLLIElement | null>).current = node
    },
    [ref]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLLIElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.preventDefault() // stop Radix swipe + text selection
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    movedRef.current = false
    const el = rootRef.current
    if (el) {
      el.style.transition = "none"
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore — pointer already released */
      }
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLLIElement>) => {
    const d = drag.current
    const el = rootRef.current
    if (!d || !el || e.pointerId !== d.id) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 6) movedRef.current = true
    el.style.transform = `translate(${dx}px, ${dy}px)`
    const dist = Math.hypot(dx, dy)
    el.style.opacity = String(Math.max(0.35, 1 - dist / 300))
  }

  const endDrag = (
    e: React.PointerEvent<HTMLLIElement>,
    allowDismiss: boolean
  ) => {
    const d = drag.current
    const el = rootRef.current
    if (!d || !el) return
    drag.current = null
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    const dist = Math.hypot(dx, dy)
    el.style.transition =
      "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease"
    if (allowDismiss && dist > 60) {
      // Fling it away in the swipe direction, then close.
      const nx = dist ? dx / dist : 0
      const ny = dist ? dy / dist : 0
      el.style.animationDuration = "0.01ms" // skip the built-in exit anim
      el.style.transform = `translate(${nx * 800}px, ${ny * 800}px)`
      el.style.opacity = "0"
      onOpenChange?.(false)
    } else {
      el.style.transform = ""
      el.style.opacity = ""
    }
  }

  return (
    <ToastPrimitives.Root
      ref={setRefs}
      className={cn(
        toastVariants({ variant }),
        "cursor-grab touch-none select-none active:cursor-grabbing",
        className
      )}
      {...props}
      onOpenChange={(open) => {
        // Forward Radix close requests (timer, X button, swipe…) so the
        // controlled toast state in use-toast actually closes.
        if (!open) onOpenChange?.(false)
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => endDrag(e, true)}
      onPointerCancel={(e) => endDrag(e, false)}
      onClickCapture={(e) => {
        // Swallow the click that follows a drag so buttons inside
        // the toast aren't accidentally triggered.
        if (movedRef.current) {
          e.preventDefault()
          e.stopPropagation()
          movedRef.current = false
        }
      }}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold [&+div]:text-xs", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}