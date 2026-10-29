import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_URL = 'http://localhost:3000';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: {
    // En desarrollo la SPA y la API comparten origen a través del proxy, igual que en producción.
    proxy: {
      '/auth': API_URL,
      '/urls': API_URL,
      '/dashboard': API_URL,
      '/health': API_URL,
      // Los códigos cortos, para que los enlaces generados funcionen también aquí.
      '^/[0-9A-Za-z]{7}$': API_URL,
    },
  },
  build: {
    // server.ts sirve esta carpeta.
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
});
