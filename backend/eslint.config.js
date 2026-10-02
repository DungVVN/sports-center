import eslint from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "src/generated/**",
      ".wrangler/**",
      // Local QA evidence is excluded from Git and production checks.
      "scripts/integration/**",
      "scripts/seed-local-qa.mjs",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
];
