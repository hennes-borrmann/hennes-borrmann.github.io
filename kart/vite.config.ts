import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';

const root = import.meta.dirname;

// Zwei Einstiegsseiten: index.html (Bildschirm) und c/index.html (Handy-Controller).
// base './' hält alle Pfade relativ, damit der Build unter jedem Unterordner läuft
// (z. B. https://<name>.github.io/kart/).
export default defineConfig({
  base: './',
  plugins: process.env.HTTPS ? [basicSsl()] : [],
  build: {
    target: ['es2020', 'safari14'],
    rollupOptions: {
      input: {
        screen: resolve(root, 'index.html'),
        controller: resolve(root, 'c/index.html'),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
