import { X } from "lucide-react"
import { useEffect, useId, useRef, type ReactNode } from "react"

interface WebDialogProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

export function WebDialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: WebDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const instanceId = useId()
  const titleId = `web-dialog-title-${instanceId}`
  const descriptionId = `web-dialog-description-${instanceId}`

  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-1 text-sm text-gray-500 dark:text-gray-400"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
