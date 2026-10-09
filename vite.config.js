import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200
  }
});
