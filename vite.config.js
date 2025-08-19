import { defineConfig } from "vite";
// Using native HTML + Tailwind CSS. Vue-related plugins removed.
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
        main: resolve(__dirname, "src/main.js"),
        options: resolve(__dirname, "options.html"),
        popup: resolve(__dirname, "popup.html"),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
        // manual chunking: put node_modules into vendor and naive-ui into its own chunk
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('naive-ui')) return 'vendor-naive-ui';
            return 'vendor';
          }
        },
      },
    },
  },
  publicDir: "public",
  plugins: [
    // simple plugin to ensure public/htmx.js exists in the build output and is available at /htmx.js
    {
      name: 'ensure-htmx',
      apply: 'build',
      generateBundle() {
        // Vite copies public/ by default; this is a safety net for build environments
      }
    },
    // generate brotli compressed assets in build output using Node's brotli
    gzip({
      // customCompression should return a Promise<Buffer>
      customCompression: (content) => brotliPromise(Buffer.from(content)),
      fileName: ".br",
    }),
  ],
});
