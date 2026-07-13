import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * COOP/COEP make the document cross-origin isolated, which LiteRT.js needs
 * for multi-threaded WASM (SharedArrayBuffer). `credentialless` (rather than
 * `require-corp`) lets us fetch model weights from CORS-enabled hosts such as
 * huggingface.co and storage.googleapis.com without CORP headers.
 * The production nginx config (deployment/nginx.conf) mirrors these headers.
 */
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

const crossOriginIsolation = {
  name: 'cross-origin-isolation',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      for (const [k, v] of Object.entries(isolationHeaders)) res.setHeader(k, v)
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => {
      for (const [k, v] of Object.entries(isolationHeaders)) res.setHeader(k, v)
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), crossOriginIsolation],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1200,
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
  },
})
