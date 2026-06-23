import type { PublicUser } from "@ai-jakdang/contracts";

/**
 * 관리자 앱의 API 베이스 URL. 사용자 사이트와 동일한 Fastify API 를 사용한다.
 * 실제 요청/인증 헤더 처리는 관리자 단계에서 구현한다.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003";

/** 관리자 화면에서 사용할 사용자 타입 재노출(비시각적 공유 타입). */
export type AdminUser = PublicUser;
