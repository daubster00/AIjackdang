import globals from "globals";
import { baseConfig, reactConfig } from "@ai-jakdang/config/eslint";

export default [
  ...baseConfig,
  ...reactConfig,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    ignores: [".next/**"],
  },
];
