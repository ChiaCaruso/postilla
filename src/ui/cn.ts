export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
