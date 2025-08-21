import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { AntDesignVueResolver } from "unplugin-vue-components/resolvers";
import { fileURLToPath, URL } from "url";

export default defineConfig({
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
        popup: fileURLToPath(new URL("popup/popup.html", import.meta.url)),
        options: fileURLToPath(
          new URL("options/options.html", import.meta.url)
        ),
        content: fileURLToPath(new URL("content/content.ts", import.meta.url)),
        background: fileURLToPath(
          new URL("background/background.ts", import.meta.url)
        ),
      },
      output: {
        entryFileNames: "js/[name].js",
        chunkFileNames: "js/[name].js",
        assetFileNames: "assets/[name].[ext]",
        manualChunks(id) {
          // Split node_modules into per-package vendor chunks and handle pnpm layout
          if (id.includes("node_modules")) {
            const parts = id.split(/[\\/]/);
            // find last 'node_modules' segment (handles nested .pnpm paths)
            let nodeIdx = -1;
            for (let i = parts.length - 1; i >= 0; i--) {
              if (parts[i] === "node_modules") {
                nodeIdx = i;
                break;
              }
            }
            if (nodeIdx === -1 || nodeIdx + 1 >= parts.length) return;
            // advance past any '.pnpm' or version-like segments
            let j = nodeIdx + 1;
            while (j < parts.length && parts[j] === ".pnpm") j++;
            if (j >= parts.length) return;
            let candidate = parts[j];
            // strip version suffix like 'vue@3.2.0' -> 'vue'
            if (candidate.includes("@") && !candidate.startsWith("@")) {
              candidate = candidate.split("@")[0];
            }
            // handle scoped packages '@scope' + 'name'
            if (candidate.startsWith("@") && parts[j + 1]) {
              candidate = `${candidate}/${parts[j + 1]}`;
            }
            // further split ant-design-vue by its subpath (es/<component>) for finer chunks
            if (candidate === "ant-design-vue") {
              // try to find 'es' or 'lib' segment after candidate
              const subParts = parts.slice(j + 1);
              // find first non-empty segment (often 'es' then component path)
              if (subParts.length > 0) {
                // if layout is ant-design-vue/es/button/index.js => subParts[0] === 'es'
                let compName = subParts[1] || subParts[0];
                if (compName) {
                  // normalize
                  compName = compName
                    .replace(/\.(js|mjs|cjs)$/, "")
                    .replace(/[^a-zA-Z0-9_-]/g, "_");
                  return `vendor_ant-design-vue_${compName}`;
                }
              }
            }
            return `vendor_${candidate.replace("/", "_")}`;
          }
          if (id.includes("emoji-data")) {
            return "emoji-data";
          }
        },
      },
    },
  },
});
