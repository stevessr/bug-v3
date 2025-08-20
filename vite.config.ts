import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  plugins: [vue()],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL('popup/popup.html', import.meta.url)),
        options: fileURLToPath(new URL('options/options.html', import.meta.url)),
        content: fileURLToPath(new URL('content/content.ts', import.meta.url)),
        background: fileURLToPath(new URL('background/background.ts', import.meta.url)),
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue')) {
              return 'vue';
            }
            if (id.includes('ant-design-vue')) {
              return 'ant-design-vue';
            }
            if (id.includes('@vueuse/core')) {
              return 'vueuse-core';
            }
          }
          if (id.includes('emoji-data')) {
            return 'emoji-data'
          }
        },
      },
    },
  },
});
