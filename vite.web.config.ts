import { defineConfig } from 'vite';
import { htmlTransformPlugin } from './src/build/vite-plugin-html-transform';

export default defineConfig({
  plugins: [htmlTransformPlugin({ isWeb: true })],
  root: '.',
  base: './',
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': '/src',
      '@platform': '/src/platform/web',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __PLATFORM__: JSON.stringify('web'),
  },
  server: {
    port: 3000,
    open: true,
  },
});
