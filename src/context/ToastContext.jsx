import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../lib/utils'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (message, variant = 'success', options = {}) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      setToasts((current) => [...current.slice(-2), { id, message, variant, action: options.action }])
      const timer = setTimeout(() => dismiss(id), options.duration ?? 5000)
      timers.current.set(id, timer)
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      show,
      success: (message, options) => show(message, 'success', options),
      error: (message, options) => show(message, 'error', options),
      info: (message, options) => show(message, 'info', options),
      dismiss,
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-3 sm:top-5"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.variant] || Info
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.35)]',
                toast.variant === 'success' && 'border-emerald-100',
                toast.variant === 'error' && 'border-rose-100',
                toast.variant === 'info' && 'border-brand-100',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-6 w-6 shrink-0',
                  toast.variant === 'success' && 'text-emerald-600',
                  toast.variant === 'error' && 'text-rose-600',
                  toast.variant === 'info' && 'text-brand-600',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] leading-snug text-slate-800">{toast.message}</p>
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action.onClick?.()
                      dismiss(toast.id)
                    }}
                    className="mt-2 min-h-10 rounded-full bg-brand-50 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                  >
                    {toast.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
