/**
 * AI 추상화 레이어 공유 타입 (Story 11.6).
 *
 * ARCHITECTURE §4에 따라 생성 모델에 도구 권한 없음 — system+user 텍스트만 전달.
 * 어댑터와 index 양측이 이 파일만 import하여 순환 참조를 방지한다.
 */

/** generateText 요청 */
export interface AiTextRequest {
  /** 시스템 프롬프트 (페르소나·지시사항) */
  system: string;
  /** 비신뢰 입력 블록 — 봇 생성 콘텐츠·주제 등 */
  user: string;
  /** bot_model_assignments.model 값 그대로 전달 — 하드코딩 금지 */
  model: string;
  /** 최대 출력 토큰. 기본값은 어댑터가 정의 */
  maxTokens?: number;
  /** 샘플링 온도. 기본값은 어댑터가 정의 */
  temperature?: number;
}

/** generateText 응답 */
export interface AiTextResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  /** 달러 비용 추정. 알 수 없는 모델이면 0 (fail-safe) */
  costUsd: number;
}

/** generateImage 요청 */
export interface AiImageRequest {
  prompt: string;
  model: string;
  n?: number;
  size?: string;
}

/** generateImage 응답 */
export interface AiImageResponse {
  url?: string;
  /** base64 인코딩 이미지 바이트 */
  bytes?: string;
  costUsd: number;
}

/**
 * AI 프로바이더 통일 인터페이스.
 *
 * - generateText: 텍스트 생성 (필수)
 * - generateImage: 이미지 생성 (선택 — Anthropic 등 미지원 프로바이더는 구현 안 함)
 *
 * ARCHITECTURE §4 핵심: 세 어댑터 모두 tools/functions 파라미터 전달 금지.
 */
export interface AiProvider {
  generateText(req: AiTextRequest): Promise<AiTextResponse>;
  generateImage?(req: AiImageRequest): Promise<AiImageResponse>;
}
