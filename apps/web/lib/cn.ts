/**
 * 조건부 className 을 합치는 작은 헬퍼.
 * 외부 라이브러리(clsx 등) 없이 디자인 시스템 내부에서만 사용한다.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string | number => Boolean(value)).join(" ");
}
