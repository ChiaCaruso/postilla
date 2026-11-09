import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { DesignPage } from './DesignPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignPage />
  </StrictMode>,
)
