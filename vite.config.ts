import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',

            // Include all generated icon assets in the precache manifest
            includeAssets: [
                'favicon.ico',
                'logo.svg',
                'apple-touch-icon-180x180.png',
                'pwa-64x64.png',
                'pwa-192x192.png',
                'pwa-512x512.png',
                'maskable-icon-512x512.png',
            ],

            manifest: {
                name: 'IronAI — AI Strength Coach',
                short_name: 'IronAI',
                description: 'Your AI-powered strength training coach. Log workouts, track personal records, and get personalized coaching.',
                theme_color: '#1ebd7b',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                icons: [
                    { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },

            workbox: {
                // Precache all built static assets
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],

                // SPA fallback: all navigation requests serve index.html (enables offline routing)
                navigateFallback: 'index.html',

                // Don't intercept API calls — they must go to the network
                navigateFallbackDenylist: [/\/api\//],

                runtimeCaching: [
                    // Google Fonts stylesheet — revalidate in background so updates propagate
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'google-fonts-stylesheets',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    // Google Fonts files — cache forever (content-addressed URLs)
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
});
