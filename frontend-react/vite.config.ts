import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Target modern browsers
    target: 'es2020',

    // Reduce chunk size warning limit
    chunkSizeWarningLimit: 500,

    // Manual chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // UI libraries
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-avatar',
          ],

          // State management and forms
          'state-vendor': [
            'zustand',
            '@tanstack/react-query',
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
          ],

          // Icons
          'icons': ['lucide-react'],

          // Heavy visualization libraries (dynamically imported via lazy routes)
          'viz-libs': ['html2canvas', 'react-force-graph-2d'],

          // Note: Export libraries (docx, jspdf, pptxgenjs, exceljs) are now
          // dynamically imported only when needed via ExportButton component
          // This saves ~362 KB gzipped from initial bundle
        },
      },
    },

    // Minification options
    minify: 'esbuild', // Use esbuild for faster minification (terser has config issues)

    // Source maps for production debugging (can be disabled for smaller builds)
    sourcemap: false,
  },
})
