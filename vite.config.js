import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import gzip from "rollup-plugin-gzip";
import { brotliCompress } from "zlib";
import { promisify } from "util";
import fs from "fs";
import { resolve as pathResolve } from "path";
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
    // use terser for better compression control
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        // remove some pure functions if any
        pure_funcs: ["console.info", "console.debug"],
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      input: {
        options: resolve(__dirname, "options.html"),
        popup: resolve(__dirname, "popup.html"),
        content: resolve(__dirname, "content/main.jsx"),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
        // manual chunking: put node_modules into vendor and naive-ui into its own chunk
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
  publicDir: "public",
  plugins: [
    react(),
    // generate brotli compressed assets in build output using Node's brotli
    gzip({
      // customCompression should return a Promise<Buffer>
      customCompression: (content) => brotliPromise(Buffer.from(content)),
      fileName: ".br",
    }),
  ],
});
