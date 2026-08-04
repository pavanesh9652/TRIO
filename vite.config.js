import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:5000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // The app calls "/api/..." on its own origin and Vite forwards it to the
      // API, so the browser never makes a cross-origin request in development.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
  }
})
