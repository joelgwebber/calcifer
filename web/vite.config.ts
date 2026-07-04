import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the nanoclaw host (default :8787).
// In production the host serves the built files, so relative /api URLs
// resolve against the same origin and no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    // Headless box reached over Tailscale — bind every interface (equivalent to
    // --host 0.0.0.0) so `npm run dev` alone is enough; no CLI flag needed.
    host: true,
    // Vite 5 rejects requests whose Host header isn't allow-listed. Accept
    // localhost, the bare hostname, and the whole tailnet (leading-dot =
    // this domain + all subdomains, so hearth.hamlet-algol.ts.net matches).
    allowedHosts: ['localhost', 'hearth', '.hamlet-algol.ts.net'],
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
