import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import Components from "unplugin-vue-components/vite";
import { resolve } from "path";
import gzip from "rollup-plugin-gzip";
import { brotliCompress } from "zlib";
import { promisify } from "util";
const brotliPromise = promisify(brotliCompress);

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000,
    hmr: {
      host: "localhost",
      protocol: "ws",
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/main.js"),
        options: resolve(__dirname, "options.html"),
        popup: resolve(__dirname, "popup.html"),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
  publicDir: "public",
  plugins: [
    vue(),
    AutoImport({
      // auto-import Vue composition APIs and Naive UI composables via resolver
      imports: ["vue"],
      resolvers: [NaiveUiResolver()],
      // generate declaration file for editor/TS support
      dts: "src/auto-imports.d.ts",
    }),
    Components({
      // enable on-demand components resolution for Naive UI
      resolvers: [NaiveUiResolver()],
      // generate declaration file for editor/TS support
      dts: "src/components.d.ts",
    }),
    // generate brotli compressed assets in build output using Node's brotli
    gzip({
      // customCompression should return a Promise<Buffer>
      customCompression: (content) => brotliPromise(Buffer.from(content)),
      fileName: ".br",
    }),
  ],
});
