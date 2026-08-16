import { defineConfig } from 'vite';

// js13k build: single JS entry, no code splitting, no minify here.
// Terser + Roadroller run afterwards in scripts/pack.js for max control over size.
export default defineConfig({
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        entryFileNames: 'bundle.js',
        inlineDynamicImports: true,
      },
    },
  },
});
