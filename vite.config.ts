import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/heropick/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt', // new versions wait until HeroPick is idle (src/updateGate.ts)
      injectRegister: false, // registered in src/offline.ts
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,bin,cube,wasm,png,svg}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        clientsClaim: true, // the first visit becomes offline-ready without a reload
        navigateFallback: '/heropick/index.html',
      },
      manifest: {
        name: 'HeroPick',
        short_name: 'HeroPick',
        description: 'Find your hero shots fast, even with no signal.',
        display: 'standalone',
        background_color: '#111111',
        theme_color: '#111111',
        start_url: '/heropick/',
        scope: '/heropick/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
