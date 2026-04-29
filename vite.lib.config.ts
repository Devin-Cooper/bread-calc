import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist/lib",
    emptyOutDir: true,
    target: "es2022",
    lib: {
      entry: resolve(__dirname, "src/core/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: [/^node:/],
    },
    minify: false,
    sourcemap: true,
  },
});
