// Segnaposto: le schermate (S01 caricamento, S03 editor, S05 download) arrivano nei prossimi commit.
import { TooltipProvider } from './ui/Tooltip'
import { Dropzone } from './ui/Dropzone'

export default function App() {
  return (
    <TooltipProvider>
      <main className="mx-auto flex max-w-(--layout-upload-max) flex-col gap-6 px-6 py-16">
        <h1 className="text-xl">Modifica un PDF</h1>
        <Dropzone onFile={() => {}} />
      </main>
    </TooltipProvider>
  )
}
