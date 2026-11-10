import { useEffect } from 'react'
import { TooltipProvider } from './ui/Tooltip'
import { useStore } from './store'
import { UploadScreen } from './screens/UploadScreen'
import { EditorScreen } from './screens/EditorScreen'
import { ProcessingScreen } from './screens/ProcessingScreen'
import { DownloadScreen } from './screens/DownloadScreen'

// Niente indirizzi per le schermate: il PDF vive solo in memoria, quindi ricaricare
// la pagina riporta sempre al caricamento (S01). Le schermate sono stati dell'app.
export default function App() {
  const screen = useStore((s) => s.screen)
  const unsaved = useStore((s) => s.elements.length > 0 && s.screen === 'editor')

  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])

  return (
    <TooltipProvider>
      {screen === 'upload' && <UploadScreen />}
      {screen === 'editor' && <EditorScreen />}
      {screen === 'processing' && <ProcessingScreen />}
      {screen === 'done' && <DownloadScreen />}
    </TooltipProvider>
  )
}
