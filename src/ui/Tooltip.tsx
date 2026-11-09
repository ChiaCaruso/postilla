import * as T from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <T.Provider delayDuration={400}>{children}</T.Provider>
)

export function Tooltip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          sideOffset={6}
          className="z-50 rounded-sm bg-text px-2 py-1 text-xs text-bg shadow-pop"
        >
          {label}
          {shortcut && <kbd className="ml-2 font-mono text-border">{shortcut}</kbd>}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
