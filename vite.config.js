import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/v1/messages': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
      }
    }
  }
})
