/**
 * 게시판(board) 메타데이터 상수 — AR-6 다형성 모델
 *
 * BOARDS: board 슬러그 → 메타데이터 매핑 (총 12개).
 * DB board 컬럼 값은 이 상수의 키(슬러그)와 동일해야 한다.
 *
 * 특수 플래그:
 *   isSystemBoard: true  → 관리자만 글 작성 가능 (notice)
 *   hasCreativeSpec: true → 창작물 메타 필드 포함 (ai-creation)
 *   boardKind: 'recruit'  → 구인구직 게시판 (gigs)
 */

export type BoardMeta = {
  label: string;
  description: string;
  category: string;
  urlPath: string;
  isSystemBoard?: boolean;
  hasCreativeSpec?: boolean;
  boardKind?: "recruit" | "standard";
};

export const BOARDS: Record<string, BoardMeta> = {
  // ── 바이브 코딩 ────────────────────────────────────────────────────────────
  "vibe-coding-guide": {
    label: "바이브 코딩 가이드",
    description: "바이브 코딩 방법론 · 튜토리얼 · 실전 가이드",
    category: "vibe-coding",
    urlPath: "/vibe-coding",
  },
  "vibe-coding-tips": {
    label: "바이브 코딩 팁",
    description: "바이브 코딩 노하우 · 팁 · 트릭 공유",
    category: "vibe-coding",
    urlPath: "/vibe-coding?board=vibe-coding-tips",
  },

  // ── AI 자동화 ──────────────────────────────────────────────────────────────
  "automation-guide": {
    label: "자동화 가이드",
    description: "AI 자동화 구축 방법 · 워크플로 설계 가이드",
    category: "ai-automation",
    urlPath: "/automation",
  },
  "automation-cases": {
    label: "자동화 사례",
    description: "실제 AI 자동화 적용 사례 · 결과 공유",
    category: "ai-automation",
    urlPath: "/automation?board=automation-cases",
  },
  "automation-tips": {
    label: "자동화 팁",
    description: "자동화 구현 팁 · 도구 추천 · 트러블슈팅",
    category: "ai-automation",
    urlPath: "/automation?board=automation-tips",
  },

  // ── AI 수익화 ──────────────────────────────────────────────────────────────
  "monetization-tips": {
    label: "수익화 팁",
    description: "AI 활용 수익 창출 팁 · 아이디어 공유",
    category: "ai-monetization",
    urlPath: "/monetize",
  },
  "monetization-cases": {
    label: "수익화 사례",
    description: "AI 수익화 실제 사례 · 결과 공유",
    category: "ai-monetization",
    urlPath: "/monetize?board=monetization-cases",
  },

  // ── AI 창작 ────────────────────────────────────────────────────────────────
  "ai-creation": {
    label: "AI 창작물",
    description: "AI로 만든 창작물 · 이미지 · 영상 · 음악 공유",
    category: "ai-creation",
    urlPath: "/lounge",
    hasCreativeSpec: true,
  },
  "ai-products": {
    label: "AI 제품 · 서비스",
    description: "AI 기반 제품 · 서비스 소개 · 피드백",
    category: "ai-creation",
    urlPath: "/lounge/products",
  },

  // ── 커뮤니티 ───────────────────────────────────────────────────────────────
  talk: {
    label: "작당 라운지",
    description: "AI 작당 멤버들의 자유 대화 공간",
    category: "lounge",
    urlPath: "/lounge/talk",
  },
  gigs: {
    label: "구인구직",
    description: "AI · 자동화 분야 인재 모집 · 프리랜서 구직",
    category: "lounge",
    urlPath: "/lounge/gigs",
    boardKind: "recruit",
  },

  // ── 시스템 ─────────────────────────────────────────────────────────────────
  notice: {
    label: "공지사항",
    description: "AI 작당 공식 공지 · 업데이트 안내",
    category: "system",
    urlPath: "/notice",
    isSystemBoard: true,
  },
};

/** 슬러그가 유효한 board인지 확인 */
export function isValidBoard(slug: string): slug is keyof typeof BOARDS {
  return Object.prototype.hasOwnProperty.call(BOARDS, slug);
}
