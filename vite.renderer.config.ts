import { defineConfig } from 'vite';
import { resolve } from 'path';
import { htmlTransformPlugin } from './src/build/vite-plugin-html-transform';

export default defineConfig({
  plugins: [htmlTransformPlugin({ isWeb: false })],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main_window: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'src/features/about/desktop/window.html'),
        settings: resolve(__dirname, 'src/features/settings/desktop/window.html'),
        animations: resolve(__dirname, 'src/features/animations/desktop/window.html'),
        resize: resolve(__dirname, 'src/features/resize/desktop/window.html'),
        brightness: resolve(__dirname, 'src/features/brightness/desktop/window.html'),
      },
    },
  },
});
