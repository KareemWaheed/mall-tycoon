import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site from /mall-tycoon/. Local dev and LAN testing use /.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/mall-tycoon/' : '/',
  server: { host: false, port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  plugins: [
    // installable and offline; a new version is picked up on the next launch
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'مول تايكون',
        short_name: 'مول تايكون',
        description: 'كبّر محلك لحد ما يبقى مول',
        lang: 'ar',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        background_color: '#1f2a44',
        theme_color: '#1f2a44',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'] },
    }),
  ],
});
