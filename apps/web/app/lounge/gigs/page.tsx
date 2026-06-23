"use client";

// 작당 의뢰소 목록 페이지.
// 글유형·분야·모집상태 필터를 클라이언트 state로 처리하고,
// mock 배열을 필터링하여 카드 목록으로 렌더한다.
// → 비회원도 목록 열람 가능, 글쓰기 버튼만 useMockAuth 게이팅.

import Link from "next/link";
import { Avatar, AuthorName, Badge, Button, Icon, Select, SearchInput } from "@/components/ui";
import { BoardHero } from "@/components/board";
import { useMockAuth } from "@/hooks/useMockAuth";
import { useState } from "react";
import styles from "./gigs.module.css";

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
  budget?: string; // 예산/희망단가 (선택)
  period?: string; // 작업기간/마감 (선택)
};

// ── mock 데이터 (의뢰/구직 · 모집중/마감 각각 섞어서 5개) ─
export const MOCK_GIGS: GigPost[] = [
  {
    slug: "ai-video-short-form",
    type: "의뢰",
    fields: ["AI 영상", "이미지 생성"],
    status: "모집중",
    title: "숏폼 유튜브 채널용 AI 영상 편집자를 찾습니다",
    excerpt:
      "월 8~12편 분량의 1분 내외 쇼츠 영상 편집 의뢰입니다. AI 영상 생성 툴 활용 경험자 우대. 샘플 포트폴리오 제출 필수.",
    author: "채널운영중",
    date: "2026.06.20",
    views: "852",
    comments: 14,
    budget: "편당 3만원~",
    period: "월 단위 계약",
  },
  {
    slug: "chatbot-llm-dev-outsource",
    type: "의뢰",
    fields: ["챗봇·LLM 개발", "웹·앱 개발"],
    status: "모집중",
    title: "고객 상담용 LLM 챗봇 외주 개발 의뢰",
    excerpt:
      "쇼핑몰 CS 자동화용 RAG 기반 챗봇입니다. Claude API 또는 GPT 모델 활용 가능. 요구사항 문서 제공. 원격 진행 가능합니다.",
    author: "스타트업창업자",
    date: "2026.06.18",
    views: "1,203",
    comments: 22,
    budget: "350만원 ~ 협의",
    period: "6주 이내",
  },
  {
    slug: "prompt-engineer-wanted",
    type: "구직",
    fields: ["프롬프트 엔지니어링", "컨설팅·강의"],
    status: "모집중",
    title: "프롬프트 엔지니어링·AI 교육 강사로 활동하고 싶습니다",
    excerpt:
      "2년 이상의 Claude/GPT 프롬프트 최적화 경험, 기업 대상 AI 워크숍 진행 이력 보유. 강의·컨설팅·콘텐츠 제작 협업 제안 환영합니다.",
    author: "프롬프트장인",
    date: "2026.06.17",
    views: "674",
    comments: 8,
    period: "상시 모집",
  },
  {
    slug: "music-ai-bgm-request",
    type: "의뢰",
    fields: ["음악·오디오"],
    status: "마감",
    title: "팟캐스트 배경음악 AI 작곡 의뢰 — 마감되었습니다",
    excerpt:
      "주간 팟캐스트 인트로/아웃트로 및 배경음악 5종 제작 의뢰. 상업적 이용 가능한 라이선스 포함. (현재 협업자 선정 완료, 마감)",
    author: "팟캐스터K",
    date: "2026.06.14",
    views: "430",
    comments: 6,
    budget: "30만원 (일괄)",
  },
  {
    slug: "automation-workflow-expert",
    type: "구직",
    fields: ["자동화·워크플로", "챗봇·LLM 개발"],
    status: "마감",
    title: "n8n / Make 자동화 전문가 — 포지션 결정됨",
    excerpt:
      "n8n, Make, Zapier 3년 경력. LLM API 연동 자동화 파이프라인 구축 전문. 당분간 추가 프로젝트 어렵습니다. (마감)",
    author: "자동화마스터",
    date: "2026.06.12",
    views: "589",
    comments: 9,
  },
];

// ── 셀렉트 박스 옵션 (유형 / 분야 / 상태) ──────────────────
const TYPE_OPTIONS = [
  { value: "전체", label: "유형 전체" },
  { value: "의뢰", label: "의뢰" },
  { value: "구직", label: "구직" },
];
const FIELD_OPTIONS = [
  { value: "전체", label: "분야 전체" },
  ...GIG_FIELDS.map((f) => ({ value: f, label: f })),
];
const STATUS_OPTIONS = [
  { value: "전체", label: "상태 전체" },
  { value: "모집중", label: "모집중" },
  { value: "마감", label: "마감" },
];

// ── 컴포넌트 ──────────────────────────────────────────────
export default function GigsPage() {
  const { user } = useMockAuth();

  // 필터 state: "전체" = 필터 없음
  const [filterType, setFilterType] = useState<GigType | "전체">("전체");
  const [filterField, setFilterField] = useState<GigField | "전체">("전체");
  const [filterStatus, setFilterStatus] = useState<GigStatus | "전체">("전체");
  // 검색어 state (제목·본문 대상)
  const [query, setQuery] = useState("");

  // 글쓰기 버튼 클릭 핸들러 — 비회원은 안내 alert, 회원은 write 페이지로
  function handleWriteClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!user) {
      e.preventDefault();
      alert("로그인 후 의뢰/구직 글을 작성할 수 있습니다.");
    }
  }

  // mock 배열 클라이언트 필터링 + 검색
  const trimmedQuery = query.trim().toLowerCase();
  const filtered = MOCK_GIGS.filter((g) => {
    if (filterType !== "전체" && g.type !== filterType) return false;
    if (filterField !== "전체" && !g.fields.includes(filterField)) return false;
    if (filterStatus !== "전체" && g.status !== filterStatus) return false;
    if (
      trimmedQuery &&
      !g.title.toLowerCase().includes(trimmedQuery) &&
      !g.excerpt.toLowerCase().includes(trimmedQuery)
    ) {
      return false;
    }
    return true;
  });

  return (
    <main id="main" className={styles.page}>
      {/* 히어로: 작당 라운지 대메뉴 공통 히어로 사용 */}
      <BoardHero menu="lounge" currentSub="작당 의뢰소" />

      {/* ── 필터 툴바: 유형·분야·상태 셀렉트 박스 + 검색창 ── */}
      <section className={styles.filterToolbar} aria-label="의뢰 목록 필터 및 검색">
        <div className={styles.filterSelects}>
          {/* 글유형 셀렉트 */}
          <div className={styles.selectField}>
            <Select
              label="유형"
              options={TYPE_OPTIONS}
              value={filterType}
              onChange={(v) => setFilterType(v as GigType | "전체")}
            />
          </div>

          {/* 분야 셀렉트 (옵션이 많아 약간 넓게) */}
          <div className={`${styles.selectField} ${styles.selectFieldWide}`}>
            <Select
              label="분야"
              options={FIELD_OPTIONS}
              value={filterField}
              onChange={(v) => setFilterField(v as GigField | "전체")}
            />
          </div>

          {/* 모집상태 셀렉트 */}
          <div className={styles.selectField}>
            <Select
              label="상태"
              options={STATUS_OPTIONS}
              value={filterStatus}
              onChange={(v) => setFilterStatus(v as GigStatus | "전체")}
            />
          </div>
        </div>

        {/* 검색창 */}
        <div className={styles.filterSearch}>
          <SearchInput
            placeholder="제목·내용 검색"
            buttonLabel="검색"
            defaultValue={query}
            onSearch={(v) => setQuery(v)}
          />
        </div>
      </section>

      {/* ── 목록 레이아웃 ── */}
      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {filtered.length}개</span>
          </div>
          {/* 글쓰기 버튼: 비회원이면 alert 게이팅 */}
          <Link href="/lounge/gigs/write" onClick={handleWriteClick}>
            <Button
              className={styles.writeButton}
              leftIcon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
            >
              글쓰기
            </Button>
          </Link>
        </div>

        <div className={styles.mainCol}>
          <section className={styles.postList} aria-label="작당 의뢰소 게시글 목록">
            {filtered.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--color-text-sub)", padding: "48px 0" }}>
                조건에 맞는 의뢰·구직 글이 없습니다.
              </p>
            ) : (
              filtered.map((gig) => (
                <GigCard key={gig.slug} gig={gig} />
              ))
            )}
          </section>

          {/* 페이지네이션 (mock) */}
          <nav className={styles.pagination} aria-label="페이지 이동">
            <button type="button" aria-label="이전 페이지">
              <Icon name="arrow-left-s-line" />
            </button>
            <button type="button" aria-current="page">1</button>
            <button type="button" aria-label="다음 페이지">
              <Icon name="arrow-right-s-line" />
            </button>
          </nav>
        </div>
      </div>
    </main>
  );
}

// ── 의뢰 카드 서브컴포넌트 ─────────────────────────────────
function GigCard({ gig }: { gig: GigPost }) {
  const isClosed = gig.status === "마감";

  return (
    <article
      className={`${styles.gigItem} ${isClosed ? styles.gigItemClosed : ""}`}
      aria-label={`${gig.type} - ${gig.status}`}
    >
      {/* 카드 본문(왼쪽): 배지 + 제목 + 분야 칩 */}
      <div className={styles.gigBody}>
        {/* 배지 행: 글유형 + 모집상태 */}
        <div className={styles.gigBadgeRow}>
          {/* 의뢰=info 톤, 구직=success 톤 */}
          <Badge tone={gig.type === "의뢰" ? "info" : "success"} variant="soft">
            {gig.type}
          </Badge>
          {/* 모집중=success, 마감=neutral (흐리게는 gigItemClosed CSS로 처리) */}
          <Badge tone={isClosed ? "neutral" : "success"} variant={isClosed ? "outline" : "soft"}>
            {gig.status}
          </Badge>
        </div>

        {/* 제목 */}
        <h3>
          <Link href={`/lounge/gigs/${gig.slug}`} className={styles.gigTitle}>
            {gig.title}
          </Link>
        </h3>

        {/* 분야 칩 */}
        <div className={styles.fieldChips} aria-label="분야">
          {gig.fields.map((f) => (
            <span key={f} className={styles.fieldChip}>{f}</span>
          ))}
        </div>

        {/* 통계: 조회수 + 댓글 (구분선 왼쪽 = 본문 영역에 배치) */}
        <div className={styles.gigStats} aria-label="통계">
          <span><Icon name="eye-line" />{gig.views}</span>
          <span><Icon name="chat-3-line" />{gig.comments}</span>
        </div>
      </div>

      {/* 메타(오른쪽): 작성자·날짜(상단) → 예산/단가·기간. 본문과 세로 구분선으로 분리 */}
      <div className={styles.gigMeta}>
        {/* 작성자 + 날짜 (위쪽으로 이동) */}
        <div className={styles.gigMetaAuthor}>
          <Avatar name={gig.author} size="sm" />
          <div className={styles.gigMetaAuthorText}>
            <AuthorName name={gig.author} className={styles.authorName} />
            <span className={styles.gigMetaDate}>{gig.date}</span>
          </div>
        </div>

        {/* 예산/단가 (있을 때만) */}
        {gig.budget && (
          <span className={styles.gigBudget}>
            예산/단가
            <span className={styles.gigBudgetAmount}>{gig.budget}</span>
          </span>
        )}
        {/* 기간 (있을 때만) */}
        {gig.period && (
          <span className={styles.gigBudget}>
            기간
            <span className={styles.gigBudgetAmount} style={{ fontSize: "var(--font-size-sm)" }}>
              {gig.period}
            </span>
          </span>
        )}
      </div>
    </article>
  );
}
