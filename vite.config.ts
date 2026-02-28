import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, './src') }
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
      mangle: { toplevel: true }
    },
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') }
    }
  },
  server: {
    port: 3000,
    https: false // ใช้ ngrok/tunnel สำหรับ LIFF dev
  }
});
