import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_PUBLIC_BASE || '/',
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
