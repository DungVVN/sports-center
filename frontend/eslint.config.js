import eslint from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["node_modules/**", "dist/**", "coverage/**", "test-results/**", "playwright-report/**", ".wrangler/**"] },
  eslint.configs.recommended,
  {
    files: ["functions/**/*.js"],
    languageOptions: { globals: { HTMLRewriter: "readonly" } },
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["playwright.config.js", "e2e/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
];
