import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { AntDesignVueResolver } from "unplugin-vue-components/resolvers";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  css: {
    postcss: './postcss.config.js',
  },
  plugins: [
    vue(),
    // auto register components and import styles for ant-design-vue
    Components({
      resolvers: [AntDesignVueResolver({ importStyle: "less" })],
    }),
  ],
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: false, // Keep debugger statements for debugging
      },
    },
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL("popup.html", import.meta.url)),
        options: fileURLToPath(new URL("options.html", import.meta.url)),
        tenor: fileURLToPath(new URL("src/tenor/main.ts", import.meta.url)),
        waline: fileURLToPath(new URL("src/waline/main.ts", import.meta.url)),
        content: fileURLToPath(new URL("src/content/content.ts", import.meta.url)),
        background: fileURLToPath(new URL("src/background/background.ts", import.meta.url)),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return 'js/[name].js';
        },
        chunkFileNames: "js/[name].js",
        assetFileNames: "assets/[name].[ext]",
        manualChunks: (id) => {
          // Force content script dependencies to be inlined
          if (id.includes('src/content/') || id.includes('content.ts')) {
            return undefined; // Don't create separate chunks for content script
          }
          // Keep shared modules for other scripts
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          return undefined;
        },
      },
      external: (id) => {
        return false; // Don't externalize anything
      },
    },
  },
});