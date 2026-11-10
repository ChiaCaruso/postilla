import { DownloadCard } from '../ui/DownloadCard'
import { useStore } from '../store'

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`
}

export function DownloadScreen() {
  const result = useStore((s) => s.result)!
  const pages = useStore((s) => s.doc?.pagine.length ?? 0)
  const setScreen = useStore((s) => s.setScreen)
  const closeDocument = useStore((s) => s.closeDocument)

  const download = () => {
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <DownloadCard
        fileName={result.name}
        size={formatSize(result.blob.size)}
        pages={pages}
        wasProtected={result.wasEncrypted}
        onDownload={download}
        onEditAgain={() => setScreen('editor')}
        onClose={closeDocument}
      />
    </main>
  )
}
