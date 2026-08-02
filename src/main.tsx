import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

let isReloadingForUpdate = false

if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.notifyraApplyUpdate = () => {
        void updateSW(true)
      }
      window.dispatchEvent(new Event('notifyra:update-available'))
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      window.setInterval(() => {
        void registration.update()
      }, 30 * 60 * 1000)
    },
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloadingForUpdate) return
    isReloadingForUpdate = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
