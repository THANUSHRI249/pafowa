import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

const VARIANTS = {
  primary: 'gpay-gradient text-white shadow-float hover:brightness-105 active:brightness-95',
  secondary: 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
}

const SIZES = {
  lg: 'min-h-14 px-6 text-[1.02rem]',
  md: 'min-h-12 px-5 text-[0.95rem]',
  sm: 'min-h-10 px-4 text-sm',
}

export function buttonClasses({ variant = 'primary', size = 'lg', fullWidth = false, className } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-150 disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.lg,
    fullWidth && 'w-full',
    className,
  )
}

export default function Button({
  children,
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  loading = false,
  icon: Icon,
  className,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-5 w-5" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  )
}
