import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the nanoclaw host (default :8787).
// In production the host serves the built files, so relative /api URLs
// resolve against the same origin and no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['localhost', 'hearth'],
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
