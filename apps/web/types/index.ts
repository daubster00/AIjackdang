/**
 * 사용자 사이트 전용 타입 모음.
 * API 요청/응답 등 공유 타입은 @ai-jakdang/contracts 에서 가져오고,
 * 여기에는 사용자 사이트 UI 에만 필요한 타입을 둔다.
 */

/** 사용자 사이트 상단 메뉴 항목. */
export interface NavItem {
  label: string;
  href: string;
}
