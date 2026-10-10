import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Spoof Origin so the backend CORS doesn't block it, no matter what port Vite is on
            proxyReq.setHeader('Origin', 'http://localhost:5173');
          });
        }
      }
    }
  }
})
