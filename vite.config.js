import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE pozwala wystawić build pod podkatalogiem (np. GitHub Pages /advertising-city/).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1600 },
  server: { host: true, port: 5173 },
});
