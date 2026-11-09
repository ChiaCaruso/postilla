import type { ReactNode } from 'react'

export function PropertyBar({ children }: { children: ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label="Proprietà dell'elemento"
      className="flex h-(--layout-propertybar) items-center gap-2 overflow-x-auto border-b border-border bg-surface px-3"
    >
      {children}
    </div>
  )
}

export const PropertyGroup = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-1 border-r border-border pr-2 last:border-r-0">{children}</div>
)
