import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  base: './',
  // In dev, serve docs/ at root so fetch('data/bands.json') resolves correctly.
  // In build, publicDir is disabled to avoid copying docs/ into itself.
  publicDir: command === 'serve' ? '../docs' : false,
  build: {
    outDir: '../docs',
    emptyOutDir: false,  // keep docs/data/ which Python writes
  },
}));
