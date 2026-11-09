import { ProgressBar } from '../ui/ProgressBar'

export function ProcessingScreen() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-4 px-4">
      <h1 className="text-lg">Sto preparando il PDF…</h1>
      <ProgressBar label="Applico le modifiche" />
      <p className="text-sm text-text-muted">Tutto avviene sul tuo computer. Con file grandi può servire qualche secondo.</p>
    </main>
  )
}
