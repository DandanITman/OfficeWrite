import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@officewrite/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@officewrite/openxml': path.resolve(__dirname, '../../packages/openxml/src/index.ts'),
      '@tests': path.resolve(__dirname, '../../tests'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./test/vitest.setup.ts'],
  },
});
