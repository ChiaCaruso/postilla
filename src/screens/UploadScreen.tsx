import { useState } from 'react'
import { Dropzone } from '../ui/Dropzone'
import { Banner } from '../ui/Banner'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { OpenError, openPdf } from '../pdf/open'
import { FONT_FAMILIES, loadFontFace } from '../pdf/fonts'
import { useStore } from '../store'
import type { ErroreApertura } from '../model'

const MESSAGES: Partial<Record<ErroreApertura, { title: string; body: string }>> = {
  non_pdf: { title: 'Questo file non è un PDF', body: 'Scegli un file con estensione .pdf.' },
  troppo_grande: { title: 'Il file supera i 100 MB', body: 'Riducilo o dividilo in più parti, poi riprova.' },
  danneggiato: {
    title: 'Non riesco ad aprire questo PDF',
    body: 'Il file potrebbe essere danneggiato. Prova ad aprirlo con un altro programma e a salvarlo di nuovo.',
  },
}

export function UploadScreen() {
  const openDocument = useStore((s) => s.openDocument)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErroreApertura | null>(null)
  const [locked, setLocked] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | undefined>()

  async function tryOpen(file: File, pw?: string) {
    setBusy(true)
    setError(null)
    try {
      const opened = await openPdf(file, pw)
      // I font del testo devono essere pronti prima che l'editor misuri le righe.
      await Promise.all(FONT_FAMILIES.map((f) => loadFontFace(f.value)))
      setLocked(null)
      openDocument(opened.doc, opened.pdfjs)
    } catch (e) {
      const code = e instanceof OpenError ? e.code : 'danneggiato'
      if (code === 'serve_password') {
        setLocked(file)
        setPassword('')
        setPasswordError(undefined)
      } else if (code === 'password_errata') {
        setPasswordError('Password errata. Riprova.')
      } else {
        setLocked(null)
        setError(code)
      }
    } finally {
      setBusy(false)
    }
  }

  const msg = error ? MESSAGES[error] : null

  return (
    <main className="mx-auto flex w-full max-w-(--layout-upload-max) flex-col gap-6 px-4 py-10 md:px-6 md:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl">Modifica un PDF</h1>
        <p className="text-base text-text-muted">Aggiungi testo, immagini, forme e disegni, poi salva una copia del PDF.</p>
      </div>
      <Dropzone onFile={(f) => void tryOpen(f)} busy={busy && !locked} />
      {msg && (
        <Banner tone="danger" title={msg.title} onDismiss={() => setError(null)}>
          {msg.body}
        </Banner>
      )}

      <Modal
        open={!!locked}
        onOpenChange={(open) => !open && setLocked(null)}
        title="Questo PDF è protetto"
        description={locked ? `Per aprire «${locked.name}» serve la password.` : undefined}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (locked && password) void tryOpen(locked, password)
          }}
        >
          <TextField
            label="Password"
            type="password"
            autoFocus
            autoComplete="off"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordError(undefined)
            }}
            error={passwordError}
            hint="La password serve solo ad aprire il file qui, sul tuo computer."
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLocked(null)}>Annulla</Button>
            <Button type="submit" loading={busy} disabled={!password}>Apri</Button>
          </div>
        </form>
      </Modal>
    </main>
  )
}
