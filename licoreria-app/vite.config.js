import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// Descomentá la siguiente línea si instalaste @vitejs/plugin-basic-ssl
// import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  server:  { host: true },
  preview: { host: true },
  plugins: [
    react(),
    // basicSsl(),   // ← descomentá junto con el import de arriba para HTTPS local
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Catering Services Sil&Te',
        short_name: 'Licorería',
        description: 'Sistema de gestión de ventas - Licorería',
        theme_color: '#6c63ff',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
