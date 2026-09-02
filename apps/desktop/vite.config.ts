import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';
import { renameSync } from 'node:fs';

/**
 * The web entry cannot be called index.html in apps/desktop - that name is
 * already the Electron renderer's. Vite names the output after the input, so
 * rename it once the bundle is on disk; /app/ has to serve an index.
 */
function emitAsIndexHtml(outDir: string): Plugin {
  return {
    name: 'officewrite-web-index',
    closeBundle() {
      renameSync(path.join(outDir, 'web.html'), path.join(outDir, 'index.html'));
    },
  };
}

/**
 * Three build modes share this config:
 *
 *   default   the Electron app - renderer plus main and preload bundles
 *   test      the Playwright harness, which mocks the host bridge
 *   web       officewrite.com/app, which implements the bridge for real
 *
 * Only the default mode wants the Electron plugin; the other two run as plain
 * web pages and would fail trying to externalise Node built-ins.
 */
const WEB_OUT_DIR = path.resolve(__dirname, '../../docs/app');

export default defineConfig(({ mode }) => ({
  base: mode === 'web' ? '/app/' : './',
  // public/ carries the 1024px installer icon and a 258KB "SVG" that is really
  // a base64 bitmap. The desktop build needs those; a web page must not ship
  // them, so /app serves a 128px copy from public-web instead. assets.ts still
  // resolves ${BASE_URL}icon.png, so the name has to match.
  ...(mode === 'web' ? { publicDir: path.resolve(__dirname, 'public-web') } : {}),
  plugins: [
    react(),
    ...(mode === 'web' ? [emitAsIndexHtml(WEB_OUT_DIR)] : []),
    ...(mode === 'test' || mode === 'web'
      ? []
      : [
          electron({
            main: {
              entry: 'electron/main.ts',
              vite: {
                build: {
                  rollupOptions: {
                    external: ['dictionary-en', 'dictionary-de', 'dictionary-es', 'dictionary-fr', 'nspell', 'word-extractor'],
                  },
                },
              },
            },
            preload: {
              input: 'electron/preload.ts',
            },
          }),
        ]),
  ],
  server: {
    fs: {
      // Help > What's New imports the repo-root CHANGELOG.md with ?raw, which
      // sits above the Vite root (apps/desktop).
      allow: [path.resolve(__dirname, '../..')],
    },
  },
  resolve: {
    alias: {
      '@officewrite/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@officewrite/openxml': path.resolve(__dirname, '../../packages/openxml/src/index.ts'),
    },
  },
  build:
    mode === 'web'
      ? {
          // Straight into the Pages site, so one artifact upload carries both
          // the marketing pages and the app.
          outDir: WEB_OUT_DIR,
          emptyOutDir: true,
          rollupOptions: { input: path.resolve(__dirname, 'web.html') },
        }
      : { outDir: 'dist' },
}));
