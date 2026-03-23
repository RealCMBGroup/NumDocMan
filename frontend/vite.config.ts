import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  envPrefix: ['VITE_', 'REACT_APP_'],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('react-pdf') || id.includes('pdfjs-dist')) {
            return 'pdf';
          }

          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/build/**', '**/dist/**', '**/coverage/**'],
    },
  },
});