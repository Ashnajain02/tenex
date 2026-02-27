import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Prettier — disables conflicting ESLint formatting rules
  prettier,

  // Stricter custom rules
  {
    rules: {
      // Catch unused variables (allow _ prefix for intentionally unused)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Prefer const over let when variable is never reassigned
      "prefer-const": "warn",
      // No console.log in production code (allow warn/error)
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Enforce === over ==
      eqeqeq: ["warn", "always"],
    },
  },

  // Override default ignores of eslint-config-next
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "lib/generated/**"]),
]);

export default eslintConfig;
