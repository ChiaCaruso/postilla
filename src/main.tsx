import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStore } from './store'

// Solo in sviluppo: accesso allo stato per i test automatici.
if (import.meta.env.DEV) Object.assign(window, { __editor: { useStore } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
