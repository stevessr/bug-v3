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
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL("popup.html", import.meta.url)),
        options: fileURLToPath(new URL("options.html", import.meta.url)),
        content: fileURLToPath(new URL("src/content/content.ts", import.meta.url)),
        background: fileURLToPath(new URL("src/background/background.ts", import.meta.url)),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Content script needs to be in a specific format to avoid ES module issues
          return 'js/[name].js';
        },
        chunkFileNames: "js/[name].js",
        assetFileNames: "assets/[name].[ext]",
        manualChunks: undefined, // Disable manual chunks to bundle everything together
      },
      external: (id) => {
        // Don't externalize anything for content script to avoid import issues
        return false;
      },
    },
  },
});