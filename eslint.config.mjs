// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Root flat config — picked up by `eslint` run inside any workspace package. */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/drizzle/**",
      "**/*.config.{js,mjs,ts}",
      "**/babel.config.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports" },
      ],
      "no-console": "off",
    },
  },
  {
    // NestJS DI requires runtime class imports for emitDecoratorMetadata —
    // converting constructor-param imports to `import type` breaks injection.
    files: ["apps/api/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
);
