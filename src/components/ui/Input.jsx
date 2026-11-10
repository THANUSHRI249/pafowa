import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const baseInput =
  'w-full rounded-2xl border bg-white px-4 text-[1.02rem] text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-4 disabled:bg-slate-50 disabled:text-slate-500'

export function Field({ label, htmlFor, hint, error, children, className, optional }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[0.95rem] font-medium text-slate-700">
          {label}
          {optional ? <span className="text-xs font-normal text-slate-400">optional</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-sm font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ label, hint, error, className, id, optional, prefix, ...props }) {
  const inputId = id || props.name
  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error} optional={optional}>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.02rem] font-medium text-slate-400">
            {prefix}
          </span>
        ) : null}
        <input
          id={inputId}
          className={cn(
            baseInput,
            'h-14 border-slate-200 focus:border-brand-500 focus:ring-brand-100',
            prefix && 'pl-10',
            error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100',
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        />
      </div>
    </Field>
  )
}

export function Select({ label, hint, error, className, id, optional, children, options, placeholder, ...props }) {
  const selectId = id || props.name
  return (
    <Field label={label} htmlFor={selectId} hint={hint} error={error} optional={optional}>
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            baseInput,
            'h-14 appearance-none border-slate-200 pr-11 focus:border-brand-500 focus:ring-brand-100',
            error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100',
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      </div>
    </Field>
  )
}

export function TextArea({ label, hint, error, className, id, optional, ...props }) {
  const textareaId = id || props.name
  return (
    <Field label={label} htmlFor={textareaId} hint={hint} error={error} optional={optional}>
      <textarea
        id={textareaId}
        className={cn(
          baseInput,
          'min-h-28 resize-y border-slate-200 py-3.5 focus:border-brand-500 focus:ring-brand-100',
          error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100',
          className,
        )}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
    </Field>
  )
}

export function Checkbox({ label, description, checked, onChange, name, disabled }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-slate-300 text-brand-600 accent-brand-600"
      />
      <span>
        <span className="block text-[0.98rem] font-medium text-slate-800">{label}</span>
        {description ? <span className="mt-0.5 block text-sm text-slate-500">{description}</span> : null}
      </span>
    </label>
  )
}
