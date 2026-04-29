import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: { parser: tsparser, parserOptions: { project: "./tsconfig.json" } },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["error"] }]
    }
  },
  {
    files: ["src/core/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "error" }
  },
  {
    files: ["src/cli/**/*.ts"],
    rules: { "no-console": "off" }
  },
  {
    ignores: ["dist/**", "node_modules/**", "src/core/validator.generated.ts"]
  }
];
