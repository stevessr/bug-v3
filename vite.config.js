import { defineConfig } from 'vite';

// No more Vue, so we can simplify the config
export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: '',
    rollupOptions: {
      input: {
        main: 'main.js',
      },
      output: {
        entryFileNames: '[name].js',
        // No more CSS assets
        assetFileNames: '[name].[ext]',
      },
    },
  },
});