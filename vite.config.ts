import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:4174',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    css: true,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // The Playwright specs in e2e/ are run by `npm run test:e2e`, not vitest.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
