import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  // Vite copies publicDir into outDir by default; we don't want public/CNAME
  // (which exists for the GitHub Pages site) leaking into the lib tarball.
  publicDir: false,
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
