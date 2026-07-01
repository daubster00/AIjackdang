/**
 * context-types — Story 11.9 + 11.10
 *
 * 글·댓글 생성 파이프라인에서 사용하는 공유 타입·결과 타입 정의.
 * 순수 타입 파일 — DB·네트워크·런타임 의존성 없음.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §7 글/댓글 생성 파이프라인]
 */

// ── Story 11.9 공유 타입 ────────────────────────────────────────────────────────

/** 프롬프트 빌더에 필요한 페르소나 최소 정보 */
export interface BotPersonaForPrompt {
  nickname: string;
  personaPrompt: string | null | undefined;
  tone: string | null | undefined;
  intentionalFlaws: string | null | undefined;
  isAdminPersona: boolean;
  infoRatio: number;
}

/**
 * 검색 그라운딩 결과 요약 (FactGrounding 호환 최소 타입).
 * apps/api 서비스 레이어가 FactGrounding → FactSummary 변환 후 주입한다.
 */
export interface FactSummary {
  /** AI가 추출한 사실 문장 목록 (한국어) */
  facts: string[];
  /** 출처 URL 목록 */
  sourceUrls: string[];
  /** AI 신뢰도 */
  confidence: "high" | "medium" | "low";
}

/** 관리자 장문 연재 컨텍스트 (is_admin_persona=true + series_group 있을 때) */
export interface SeriesContext {
  /** 대주제 제목 (예: "바이브코딩 입문 시리즈") */
  groupTitle: string;
  /** 이 글이 몇 번째 편인지 (1부터) */
  episodeIndex: number;
  /** 시리즈 전체 목차 (있으면 연재 연속성 유지) */
  tableOfContents?: string[];
}

/** buildPostUserPrompt 입력 */
export interface PostUserPromptOptions {
  titleSeed: string;
  facts: FactSummary;
  board: string;
  postKind: "info" | "chat" | "guide";
  seriesContext?: SeriesContext;
}

/** buildCensorUserPrompt 입력 */
export interface CensorUserPromptOptions {
  draft: string;
  personaName: string;
  tone: string;
  titleSeed: string;
  facts: FactSummary;
  board: string;
}

// ── Story 11.10 공유 타입 ────────────────────────────────────────────────────────

/**
 * 댓글 생성기에 전달하는 정규화 맥락 객체.
 *
 * 원본 게시글 텍스트를 직접 포함하지 않는다.
 * 1차 요약기(summarizer)가 추출한 구조화 정보만 전달 — 인젝션 계층 3 방어.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §11 보안·실패 모드 — 요약 정규화]
 */
export interface NormalizedPostContext {
  /** 주제 1~2문장 요약 */
  topic: string;
  /** 질문형 글이면 핵심 질문 의도 (선택) */
  questionIntent?: string;
  /** 게시글 감정 톤 */
  emotionTone: "neutral" | "enthusiastic" | "frustrated" | "curious" | "humorous";
  /** 핵심 사실·수치 (최대 5개) */
  keyFacts: string[];
  /** 기존 댓글 수 (분위기 파악용) */
  existingCommentCount: number;
  /** 게시판 슬러그 (맥락 전달용) */
  boardSlug: string;
}

/**
 * 댓글 반응 종류 5종.
 *
 * | 값          | 한국어 | 생성 방향                                |
 * |-------------|--------|------------------------------------------|
 * | agreement   | 동조   | 공감하며 경험담이나 동의 표시            |
 * | question    | 질문   | 궁금한 점 또는 추가 정보 요청            |
 * | rebuttal    | 반박   | 다른 관점 제시 (격하지 않게, 건설적으로) |
 * | humor       | 농담   | 유머로 분위기 전환                        |
 * | reaction    | 리액션 | 짧은 감탄·공감 1~2문장                   |
 */
export type ReactionType = "agreement" | "question" | "rebuttal" | "humor" | "reaction";

/**
 * 자기검열 결과.
 *
 * `verdict`:
 *  - `pass`      → 즉시 게시 진행
 *  - `ambiguous` → bot_hold_queue 보류
 *  - `fail`      → 재생성 시도 (regen_count < MAX_REGEN) 또는 폐기
 */
export interface CommentCensorResult {
  passed: boolean;
  verdict: "pass" | "ambiguous" | "fail";
  /** 탈락/보류 사유 목록 (자기검열 AI 반환값) */
  reasons: string[];
}
