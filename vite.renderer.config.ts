import { defineConfig } from 'vite';
import { htmlTransformPlugin } from './src/build/vite-plugin-html-transform';

export default defineConfig({
  plugins: [htmlTransformPlugin({ isWeb: false })],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
