import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [{
    name: 'standalone-demo',
    transformIndexHtml(html: string) {
      return html.replace(/\s*<script src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"><\/script>/, '');
    },
  }] : [])],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
}));
