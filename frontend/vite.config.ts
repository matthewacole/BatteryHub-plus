import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'favicon.ico'],
      manifest: {
        name: 'BatteryHub+',
        short_name: 'BatteryHub+',
        description: 'Classroom battery management',
        theme_color: '#F2F2F7',
        background_color: '#FBFBFD',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        appleMobileWebAppCapable: 'yes',
        appleMobileWebAppStatusBarStyle: 'default',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,ico,json}'],
      },
    }),
  ],
  base: './',
})
