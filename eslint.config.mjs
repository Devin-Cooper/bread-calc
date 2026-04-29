import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

export default [
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: { parser: tsparser },
    plugins: { "@typescript-eslint": tseslint, import: importPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["error"] }]
    }
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "import/no-restricted-paths": ["error", {
        zones: [
          { target: "src/core", from: "src/agent", message: "src/core must not import from src/agent (inverse-dep rule)." },
          { target: "src/core", from: "src/cli",   message: "src/core must not import from src/cli (inverse-dep rule)." }
        ]
      }]
    }
  },
  {
    files: ["src/agent/**/*.ts"],
    rules: {
      "import/no-restricted-paths": ["error", {
        zones: [
          { target: "src/agent", from: "src/cli", message: "src/agent must not import from src/cli (inverse-dep rule)." }
        ]
      }]
    }
  },
  {
    files: ["src/cli/**/*.ts"],
    rules: { "no-console": "off" }
  },
  {
    ignores: ["dist/**", "node_modules/**", "src/core/validator.generated.ts"]
  }
];
