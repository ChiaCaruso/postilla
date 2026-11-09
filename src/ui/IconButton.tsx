import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'
import { cn, focusRing } from './cn'
import { Tooltip } from './Tooltip'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  shortcut?: string
  icon: ReactNode
  size?: 'sm' | 'md'
  pressed?: boolean
}

export const iconButtonClass = (size: 'sm' | 'md' = 'md') =>
  cn(
    'inline-flex shrink-0 items-center justify-center rounded-sm text-text transition-colors',
    'hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed',
    'aria-pressed:bg-accent-subtle aria-pressed:text-accent data-[state=on]:bg-accent-subtle data-[state=on]:text-accent',
    '[&_svg]:size-[18px]',
    focusRing,
    size === 'sm' ? 'size-8' : 'size-9',
  )

const Inner = forwardRef<HTMLButtonElement, IconButtonProps>(function Inner(
  { label, icon, size = 'md', pressed, className, shortcut: _s, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      {...rest}
      className={cn(iconButtonClass(size), className)}
    >
      {icon}
    </button>
  )
})

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(props, ref) {
  return (
    <Tooltip label={props.label} shortcut={props.shortcut}>
      <Inner ref={ref} {...props} />
    </Tooltip>
  )
})
