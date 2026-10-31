import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas: el mismo build sirve en GitHub Pages bajo /lowpoly-map-studio/.
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'examples/**/*.test.ts'],
  },
});
