import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  base: '',
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
})
