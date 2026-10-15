import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5005',
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Backend server is temporarily unreachable. Please retry in a moment.' }));
            }
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Spoof Origin so the backend CORS doesn't block it, no matter what port Vite is on
            proxyReq.setHeader('Origin', 'http://localhost:5173');
          });
        }
      },
      '/uploads': {
        target: 'http://127.0.0.1:5005',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503);
              res.end('Upload server unreachable');
            }
          });
        }
      },
    }
  }
})
