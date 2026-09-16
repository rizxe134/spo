import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: resolve('src/renderer'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  define: {
    __PINPOINT_PREVIEW__: true
  },
  server: {
    host: '127.0.0.1',
    port: 43217,
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    port: 43217,
    strictPort: true
  }
})
