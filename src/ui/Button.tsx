import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn, focusRing } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-bg text-text border border-border-input hover:bg-surface',
  ghost: 'bg-transparent text-text hover:bg-surface',
  danger: 'bg-danger text-on-accent hover:brightness-90',
  'danger-ghost': 'bg-transparent text-danger hover:bg-danger-subtle',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm font-semibold gap-1.5',
  md: 'h-10 px-4 text-sm font-semibold gap-2',
  lg: 'h-12 px-6 text-base font-semibold gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading = false, icon, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors whitespace-nowrap',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        focusRing,
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}
