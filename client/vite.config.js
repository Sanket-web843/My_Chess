import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'pieces/**/*.svg'],
      manifest: {
        name: 'Classic Chess',
        short_name: 'Chess',
        description: 'Play classic 1v1 chess offline or online',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#161512',
        theme_color: '#161512',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Pre-cache the entire app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Runtime caching for any remaining dynamic requests
        runtimeCaching: [
          {
            // Chess piece images served from CDN (react-chessboard)
            urlPattern: /^https:\/\/.*\.(png|svg|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'chess-assets',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Server API / Socket.IO health check — network-first, falls back
            // gracefully offline. Uses VITE_SERVER_URL at build time, or falls
            // back to localhost:3001 for local dev so the pattern covers any
            // origin the server is deployed to.
            urlPattern: ({ url }) => {
              const serverUrl =
                import.meta.env?.VITE_SERVER_URL ?? 'http://localhost:3001';
              try {
                const serverOrigin = new URL(serverUrl).origin;
                return url.origin === serverOrigin;
              } catch {
                return false;
              }
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 },
            },
          },
        ],
      },
      devOptions: {
        // Enable SW in dev so you can inspect it without a production build
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
