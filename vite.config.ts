/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite + Vitest share one config. The simulation engine lives in `src/engine` and is pure TypeScript with no React/DOM dependency, so it runs under the
// default `node` environment; component tests opt into `jsdom` via a file header comment (`// @vitest-environment jsdom`).
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
