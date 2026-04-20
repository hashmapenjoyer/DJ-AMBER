import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    proxy: {
      // Forwards /api/shazam from the Vite dev server to the optional local
      // Shazam recognition server.  If that server is not running, the proxy
      // will simply fail and extractMetadataWithShazam will catch the network
      // error and fall back gracefully - the main app is unaffected.
      '/api/shazam': 'http://localhost:3001',
    },
  },
});
