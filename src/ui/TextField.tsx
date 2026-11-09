import type { InputHTMLAttributes } from 'react'
import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn, focusRing } from './cn'

export function TextField({ label, error, hint, type = 'text', className, ...rest }: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}) {
  const id = useId()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-text">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          {...rest}
          className={cn(
            'h-10 w-full rounded-sm border bg-bg px-3 text-base text-text disabled:opacity-50',
            error ? 'border-danger' : 'border-border-input',
            isPassword && 'pr-10',
            focusRing,
            className,
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Nascondi password' : 'Mostra password'}
            aria-pressed={show}
            className={cn('absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-text-muted hover:bg-surface', focusRing)}
          >
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="text-xs text-danger">{error}</p>}
    </div>
  )
}
