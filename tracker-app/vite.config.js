import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('xlsx')) {
            return 'vendor-xlsx';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('react') || id.includes('react-dom')) {
            return 'vendor-react';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})
