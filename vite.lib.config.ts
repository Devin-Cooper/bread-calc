import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string };

export default defineConfig({
  // Vite copies publicDir into outDir by default; we don't want public/CNAME
  // (which exists for the GitHub Pages site) leaking into the lib tarball.
  publicDir: false,
  define: {
    // Bare-identifier substitution: Vite replaces __TOOL_VERSION__ with the
    // literal version string at build time (e.g. "2.0.0-alpha.0").
    // The corresponding `declare const __TOOL_VERSION__: string;` in describe.ts
    // keeps TypeScript happy for vitest (also wired via vitest.config.ts).
    "__TOOL_VERSION__": JSON.stringify(pkg.version),
  },
  plugins: [
    dts({
      rollupTypes: false,
      entryRoot: "src",
      include: ["src/core/**/*.ts", "src/agent/**/*.ts"],
    }),
  ],
  build: {
    outDir: "dist/lib",
    emptyOutDir: true,
    target: "es2022",
    lib: {
      entry: {
        index: resolve(__dirname, "src/core/index.ts"),
        agent: resolve(__dirname, "src/agent/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [/^node:/],
      output: {
        // Each entry → its own chunk; shared code goes into chunks/*.js
        // automatically. This enables tree-shaking: importing only `convert`
        // from "bread-calc/agent" doesn't pull in describe()'s registry walks.
        chunkFileNames: "chunks/[name]-[hash].js",
        entryFileNames: "[name].js",
      },
    },
    minify: false,
    sourcemap: true,
  },
});
