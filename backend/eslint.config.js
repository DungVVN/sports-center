import eslint from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "src/generated/**"],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.js"],
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
