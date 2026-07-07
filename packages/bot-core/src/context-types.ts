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

/**
 * 큐레이션(퍼오기) 컨텍스트.
 * AI 창작마당에서 봇이 외부 콘텐츠(유튜브 AI 영상·AI 밈)를 "소개"하는 글을 쓸 때 전달.
 * 미디어(영상/이미지)는 파이프라인이 본문 맨 위에 자동 첨부하므로, 본문은 소개글만 쓴다.
 */
export interface CurationContext {
  /** youtube: 유튜브 AI 영상 소개 / meme: AI 밈·이미지 소개 */
  kind: "youtube" | "meme";
  /** 소재 제목(영상 제목 등, 있으면). */
  title?: string;
  /** 채널·출처명(있으면). */
  channel?: string;
}

/**
 * 고정 커리큘럼 "강의 편" 컨텍스트.
 * 관리자 페르소나가 가이드 시리즈(예: "제로부터 바이브코딩")의 정해진 챕터를 쓸 때 전달.
 * 검색 발굴 대신 커리큘럼이 주제를 정하고, 본문 정해진 자리에 이미지 마커를 넣는다.
 */
export interface GuideChapterContext {
  /** 시리즈 제목(예: "제로부터 바이브코딩"). */
  seriesTitle: string;
  /** 시리즈 한 줄 소개. */
  seriesIntro: string;
  /** 주력 도구명(예: "Claude Code", "Make"). */
  tool: string;
  /** 이번 편 번호(1-based). */
  order: number;
  /** 시리즈 총 편수. */
  totalChapters: number;
  /** 이번 편 소제목. */
  chapterTitle: string;
  /** 이번 편 학습목표(다뤄야 할 범위). */
  goal: string;
  /** 이번 편에서 순서대로 다룰 소주제. */
  outline: string[];
  /**
   * 본문에 배치할 이미지 슬롯. 모델은 각 assetKey를 `[[IMG:assetKey]]` 마커로
   * 관련 설명 바로 아래(단독 줄)에 넣는다. 실제 이미지는 파이프라인이 치환한다.
   */
  imageSlots: { assetKey: string; caption: string }[];
  /** 앞 편들의 (번호·제목·요약) — 연속성 유지·중복 회피용. */
  previousChapters: { order: number; title: string; summary: string }[];
}

/**
 * 재작성(부분 수정) 컨텍스트.
 *
 * 검열에서 일부 항목이 fail 나 반려되면, 처음부터 새로 쓰는 대신
 * 직전 초안 전문 + "걸린 항목만" 지적을 프롬프트에 실어 그 부분만 고쳐 다시 쓰게 한다.
 * post-pipeline 재생성 루프가 매 실패마다 채워 넣는다.
 */
export interface RevisionContext {
  /** 직전 검열에서 탈락한 초안 전문(본문 텍스트). */
  previousDraft: string;
  /** 이번에 고쳐야 할 검열 탈락 항목(검열 항목 키 + 지적 사유). */
  failedItems: { key: string; reason: string }[];
}

/** buildPostUserPrompt 입력 */
export interface PostUserPromptOptions {
  titleSeed: string;
  facts: FactSummary;
  board: string;
  postKind: "info" | "chat" | "guide";
  seriesContext?: SeriesContext;
  /** 큐레이션(퍼오기) 소개글일 때 전달. 있으면 "소재를 소개하는 짧은 글" 지침으로 전환. */
  curation?: CurationContext;
  /** 고정 커리큘럼 강의 편일 때 전달. 있으면 커리큘럼 전용 지침으로 전환. */
  guideChapter?: GuideChapterContext;
  /**
   * 검열 반려 후 재작성일 때 전달. 있으면 직전 초안 + 걸린 항목 지적을 덧붙여
   * "통과한 부분은 살리고 걸린 부분만 고쳐" 다시 쓰게 한다. (없으면 최초 생성)
   */
  revision?: RevisionContext;
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
