import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));

export default defineConfig({
  // Same reason as vite.lib.config.ts: keep public/CNAME out of dist/cli/.
  publicDir: false,
  define: {
    "__TOOL_VERSION__": JSON.stringify(pkg.version),
  },
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
