import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        className={cn(
          'relative flex max-h-[93dvh] w-full flex-col rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-3xl',
          SIZES[size] || SIZES.md,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-4 sm:px-7 sm:pt-6">
          <div className="min-w-0">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
            <h2 className="text-[1.3rem] font-bold leading-snug text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-[0.95rem] leading-relaxed text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-50 p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
        {footer ? (
          <div className="safe-bottom border-t border-slate-100 bg-white px-5 py-4 sm:rounded-b-3xl sm:px-7">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
