// AI작당 공통 ESLint 플랫 설정 (ESLint 9 / typescript-eslint 8)
// 사용법: 각 워크스페이스의 eslint.config.js 에서 import 하여 확장한다.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.Config[]} */
export const baseConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.config.js",
      "**/*.config.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
    rules: {
      // any 사용 최소화: 명시적 any 는 경고로 노출한다.
      "@typescript-eslint/no-explicit-any": "warn",
      // _ 로 시작하는 인자/변수는 의도적 미사용으로 허용한다.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // 부수효과 삼항(cond ? a() : b())을 문장으로 허용한다.
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTernary: true },
      ],
      // 정규식/문자열 안의 폭 0 공백(zero-width space)은 의도적 보조문자이므로 허용한다.
      "no-irregular-whitespace": ["error", { skipRegExps: true, skipStrings: true }],
    },
  },
];

export default baseConfig;

/**
 * React/Next 프런트엔드(apps/web·apps/admin) 전용 설정.
 * 표준 Next 권장 룰 + React 훅 룰을 등록한다 — 코드가 사용하는
 * `@next/next/*`·`react-hooks/*` 룰의 정의를 제공해 disable 지시문이
 * "rule not found"로 깨지지 않게 한다. exhaustive-deps 는 경고(비차단).
 */
export const reactConfig = [
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
