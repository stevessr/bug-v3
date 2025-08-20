import { defineConfig } from "vite";
// Using native HTML + Tailwind CSS. Vue-related plugins removed.
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
          if (id.includes("node_modules")) {
            if (id.includes("htmx.org")) {
              return "htmx";
            }
            return "vendor";
          }
        },
      },
    },
  },
  publicDir: "public",
  plugins: [
    // plugin to provide a real htmx.js from node_modules at /htmx.js during dev and in build output
    {
      name: "ensure-htmx",
      configureServer(server) {
        // serve /htmx.js by reading from node_modules (so dev pages that include /htmx.js get real library)
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          if (req.url === "/htmx.js") {
            const candidates = [
              pathResolve(
                __dirname,
                "node_modules",
                "htmx.org",
                "dist",
                "htmx.min.js"
              ),
              pathResolve(
                __dirname,
                "node_modules",
                "htmx.org",
                "dist",
                "htmx.js"
              ),
            ];
            let src = null;
            for (const p of candidates) {
              if (fs.existsSync(p)) {
                src = p;
                break;
              }
            }
            if (src) {
              res.setHeader("Content-Type", "application/javascript");
              res.end(fs.readFileSync(src));
              return;
            }
            // fallback: respond with warning stub
            res.setHeader("Content-Type", "application/javascript");
            res.end(
              "(function(){console.warn('[htmx loader] htmx not found in node_modules');})();"
            );
            return;
          }
          next();
        });
      },
      apply: "build",
      generateBundle() {
        // during build, copy node_modules/htmx.org/dist/htmx.min.js into dist/htmx.js
        const candidates = [
          pathResolve(
            __dirname,
            "node_modules",
            "htmx.org",
            "dist",
            "htmx.min.js"
          ),
          pathResolve(__dirname, "node_modules", "htmx.org", "dist", "htmx.js"),
        ];
        let src = null;
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            src = p;
            break;
          }
        }
        if (!src) {
          // nothing to do
          this.warn(
            "htmx source not found in node_modules; /htmx.js will be the public stub"
          );
          return;
        }
        const code = fs.readFileSync(src);
        this.emitFile({ type: "asset", fileName: "htmx.js", source: code });
      },
    },
    // generate brotli compressed assets in build output using Node's brotli
    gzip({
      // customCompression should return a Promise<Buffer>
      customCompression: (content) => brotliPromise(Buffer.from(content)),
      fileName: ".br",
    }),
  ],
});
