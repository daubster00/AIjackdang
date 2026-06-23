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
    // 브라우저 컨텍스트에서 실행되는 디자인 점검 도구 스크립트.
    files: ["tools/**/*.mjs"],
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
