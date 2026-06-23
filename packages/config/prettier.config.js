// AI작당 공통 Prettier 설정 (코드 형식만 담당)
/** @type {import("prettier").Config} */
export const prettierConfig = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  endOfLine: "lf",
};

export default prettierConfig;
