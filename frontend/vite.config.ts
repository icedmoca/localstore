import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '',
  build: { 
    outDir: '../backend/static', 
    emptyOutDir: true 
  },
  server: { 
    port: 3000, 
    proxy: { 
      '/api': 'http://127.0.0.1:8000' 
    } 
  },
  resolve: {
    alias: {
      react: 'react',
      'react-dom': 'react-dom',
      'react/jsx-runtime': 'react/jsx-runtime',
    },
  },
})
