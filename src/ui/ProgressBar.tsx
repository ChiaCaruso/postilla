export function ProgressBar({ label, value }: { label: string; value?: number }) {
  const indeterminate = value === undefined
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-text-muted">
        <span>{label}</span>
        {!indeterminate && <span className="tabular-nums">{Math.round(value)}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(value)}
        className="relative h-2 overflow-hidden rounded-pill bg-border"
      >
        <div
          className={indeterminate ? 'absolute inset-y-0 w-1/3 animate-[progress_1.2s_var(--ease-standard)_infinite] rounded-pill bg-accent motion-reduce:animate-none motion-reduce:w-full motion-reduce:opacity-60' : 'h-full rounded-pill bg-accent transition-[width]'}
          style={indeterminate ? undefined : { width: `${value}%` }}
        />
      </div>
    </div>
  )
}
