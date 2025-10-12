import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom'],
          // Radix UI components
          'radix-ui': [
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
          ],
          // XTerm terminal libraries
          'xterm': [
            '@xterm/xterm',
            '@xterm/addon-fit',
            '@xterm/addon-web-links',
          ],
          // UI utilities
          'ui-utils': [
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'lucide-react',
          ],
        },
      },
    },
    // Optimize chunk sizes
    chunkSizeWarningLimit: 1000,
    // Minification with esbuild (faster than terser)
    minify: 'esbuild',
    // Disable source maps for production
    sourcemap: false,
  },
})
