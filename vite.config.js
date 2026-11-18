import { resolve } from 'node:path';
import { configDefaults } from 'vitest/config';
import { defineConfig } from 'vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [viteReact(), tailwindcss()],
  server: {
    // Same-origin API in dev, like production where the Go server serves the app
    proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:8080' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Agent worktrees hold full copies of src
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
