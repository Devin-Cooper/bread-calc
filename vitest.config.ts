import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string };

export default defineConfig({
  define: {
    // Mirrors vite.lib.config.ts; allows describe.ts to resolve __TOOL_VERSION__
    // in vitest without a full Vite build. Phase 9 wires this in the lib build too.
    __TOOL_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    environmentMatchGlobs: [["test/site/**", "happy-dom"]],
  },
});
