/**
 * 약관/법무 관련 단일 상수 소스 (Story 10.2 · 10.4).
 *
 * `CURRENT_TERMS_VERSION`(현재 시행 중인 약관 버전 식별자)과
 * `TERMS_EFFECTIVE_DATE`(약관 시행일 표기용 날짜)는 이 파일에만 존재하며,
 * api(가입 시 동의 기록·재동의 판단)·web(약관 페이지 버전 표기) 양쪽이
 * `@ai-jakdang/core` 배럴을 통해 동일 상수를 import 한다.
 *
 * 약관 개정 시 이 두 값만 변경하면:
 * - 신규 가입자는 새 버전으로 동의 기록됨
 * - 기존 회원은 `termsVersion !== CURRENT_TERMS_VERSION` 이 되어
 *   `GET /users/me` 응답의 `termsUpdateRequired: true` 로 재동의 안내 대상이 됨
 * - `/terms`·`/privacy`·`/operation-policy` 페이지의 버전/시행일 표기가 자동 반영됨
 *
 * 분산 하드코딩 금지. [Source: epics.md#Story 10.2 AC]
 */

/** 현재 시행 중인 약관 버전. 개정 시 이 값을 올린다. */
export const CURRENT_TERMS_VERSION = "2026-06-17" as const;

/** 현재 약관 시행일(사용자 표기용). 개정 시 버전과 함께 변경한다. */
export const TERMS_EFFECTIVE_DATE = "2026-06-17" as const;
