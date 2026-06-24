// 작당 의뢰소 공유 상수·타입 (서버/클라이언트 공용).
// page.tsx(서버, metadata export)와 GigsFilter/RecruitForm(클라이언트)이 모두 import하므로
// "use client" 서버 모듈(page.tsx)에서 분리한다. (Story 2.10 라우팅 검증 중 발견·수정)

// ── 분야(FR-5.3) 목록 ──────────────────────────────────────
export const GIG_FIELDS = [
  "AI 영상",
  "이미지 생성",
  "음악·오디오",
  "챗봇·LLM 개발",
  "자동화·워크플로",
  "프롬프트 엔지니어링",
  "웹·앱 개발",
  "컨설팅·강의",
  "기타",
] as const;

export type GigField = (typeof GIG_FIELDS)[number];
/** API 응답 기준 enum 값 */
export type GigPostKind = "request" | "offer";
export type GigRecruitStatus = "open" | "closed";

// ── 레거시 타입 (다른 파일들이 아직 import할 수 있으므로 유지) ──
export type GigType = "의뢰" | "구직";
export type GigStatus = "모집중" | "마감";

export type GigPost = {
  slug: string;
  type: GigType;
  fields: GigField[];
  status: GigStatus;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  views: string;
  comments: number;
  budget?: string;
  period?: string;
};

// ── 변환 헬퍼 ──────────────────────────────────────────────
export function postKindToLabel(kind: GigPostKind): GigType {
  return kind === "request" ? "의뢰" : "구직";
}

export function recruitStatusToLabel(status: GigRecruitStatus): GigStatus {
  return status === "open" ? "모집중" : "마감";
}
