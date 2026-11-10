import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';

const root = import.meta.dirname;

// Kennung des Builds (JJMMTT-HHMM, UTC). Sie steht klein in der Oberfläche und
// wandert in die Begrüßung zwischen den Geräten: so fällt auf, wenn ein Gerät
// noch eine ältere, zwischengespeicherte Fassung der Seite benutzt.
const buildId = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '').replace('T', '-');

// Zwei Einstiegsseiten: index.html (Bildschirm) und c/index.html (Handy-Controller).
// base './' hält alle Pfade relativ, damit der Build unter jedem Unterordner läuft.
//
// Der Build landet in ../kart und wird mit eingecheckt: GitHub Pages liefert
// das Repository so aus, wie es ist – das Spiel ist damit ohne weitere
// Einrichtung unter https://<name>.github.io/kart/ erreichbar.
export default defineConfig({
  base: './',
  plugins: process.env.HTTPS ? [basicSsl()] : [],
  define: { __BUILD__: JSON.stringify(buildId) },
  build: {
    outDir: resolve(root, '../kart'),
    emptyOutDir: true,
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
    // Die Tests fahren ganze Rennen durch; auf einer ausgelasteten Maschine reichen 5 s dafür nicht.
    testTimeout: 40000,
  },
});
