import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminLocaleProvider } from './i18n/AdminLocaleContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminLocaleProvider>
      <App />
    </AdminLocaleProvider>
  </StrictMode>,
)
