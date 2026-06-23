// 루트 ESLint 설정 — 저장소 전체를 검사한다 (eslint .)
import globals from "globals";
import { baseConfig } from "@ai-jakdang/config/eslint";

export default [
  ...baseConfig,
  {
    // 프런트엔드(React) 파일에는 브라우저 전역을 추가한다.
    files: ["apps/web/**/*.{ts,tsx}", "apps/admin/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    // admin-design-system 바닐라 JS(브라우저 실행) + 브라우저 대상 도구 스크립트.
    files: [
      "packages/admin-design-system/**/*.js",
      "apps/admin/tools/**/*.mjs",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
