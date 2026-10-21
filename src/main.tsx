import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { readSeedParam } from './devSeed.ts'

const seed = import.meta.env.PROD ? undefined : readSeedParam(window.location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App seed={seed} />
  </StrictMode>,
)
