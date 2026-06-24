/**
 * 질문 상세 페이지 서버/클라이언트 공유 상수 — Story 3.5
 *
 * 이 파일은 서버 컴포넌트(page.tsx)와 클라이언트 컴포넌트 양쪽에서
 * import 가능한 순수 상수만 정의한다.
 * 서버 전용 코드(process.env, next/headers 등)를 넣지 않는다.
 *
 * ⚠️ SSR 500 함정 방지: page.tsx에서 상수를 인라인 정의하면
 *   클라이언트 컴포넌트가 그 page 모듈을 import할 때 서버 코드가 번들에 섞인다.
 *   반드시 이 파일에만 상수를 두고 양쪽에서 import한다.
 */

/** API 내부 URL (서버 컴포넌트 SSR 전용 fetch) */
export const API_URL = process.env["API_INTERNAL_URL"] ?? "http://localhost:4003";

/** 사이트 공개 URL (canonical, JSON-LD 등) */
export const SITE_URL = (
  process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://aijakdang.com"
).replace(/\/$/, "");
