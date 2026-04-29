import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  // Same reason as vite.lib.config.ts: keep public/CNAME out of dist/cli/.
  publicDir: false,
  build: {
    outDir: "dist/cli",
    emptyOutDir: true,
    target: "node22",
    ssr: true,
    lib: {
      entry: resolve(__dirname, "src/cli/bin.ts"),
      formats: ["es"],
      fileName: () => "bin.js",
    },
    rollupOptions: { external: [/^node:/] },
    minify: false,
    sourcemap: true,
  },
});
