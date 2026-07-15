import { defineConfig } from 'vite';

// Relative base so the static build works on ANY GitHub Pages URL
// (project page at '/<repo>/') without reconfiguration.
export default defineConfig({
  base: './',
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
  },
  // manifold-3d ships its own WASM; keep esbuild from pre-bundling it.
  optimizeDeps: {
    exclude: ['manifold-3d'],
  },
});
