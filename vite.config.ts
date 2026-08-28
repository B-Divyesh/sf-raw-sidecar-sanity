import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: { output: { manualChunks: undefined } }
  }
});
