import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/data/**', '**/citadelle-vault/**', '**/server/**']
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Découpage par route / importance des dépendances tierces (SOTA v1.2)
            if (id.includes('mermaid')) {
              return 'vendor-mermaid';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-markdown')) {
              return 'vendor-react-core';
            }
            return 'vendor-libs'; // Reste des dépendances tierces
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})
