import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/react') || id.includes('/react-dom') || id.includes('/scheduler')) return 'react'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@capacitor')) return 'capacitor'
          return 'vendor'
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'Notifyra',
        short_name: 'Notifyra',
        description: 'Gestiona tus suscripciones y recibe recordatorios antes de cada cobro.',
        lang: 'es',
        theme_color: '#2d5f73',
        background_color: '#f3f4f6',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
