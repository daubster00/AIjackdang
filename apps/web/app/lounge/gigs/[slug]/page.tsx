// 작당 의뢰소 상세 페이지 (서버 컴포넌트 래퍼).
// mock 글 데이터를 여기서 정의하고 slug로 찾아
// 클라이언트 컴포넌트 GigDetailClient에 넘긴다.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardHero } from "@/components/board";
import { GigDetailClient } from "./GigDetailClient";
import { type GigPost } from "../page";

// ── mock 상세 데이터 (목록과 동일 slug 기준) ──────────────
// 의뢰 3개(모집중2, 마감1) + 구직 2개(모집중1, 마감1)
const MOCK_GIG_DETAIL: Record<string, GigPost & { workStyle?: string }> = {
  "ai-video-short-form": {
    slug: "ai-video-short-form",
    type: "의뢰",
    fields: ["AI 영상", "이미지 생성"],
    status: "모집중",
    title: "숏폼 유튜브 채널용 AI 영상 편집자를 찾습니다",
    excerpt:
      "월 8~12편 분량의 1분 내외 쇼츠 영상 편집 의뢰입니다. Runway, Kling, Pika 등 AI 영상 생성 툴 활용 경험자 우대합니다. 샘플 포트폴리오(최소 2편) 제출 필수이며, 첫 달은 수습으로 시작해 결과물에 따라 단가 조정 가능합니다. 원격 진행이며 채널 방향성에 맞는 편집 스타일 협의 후 진행할 예정입니다.",
    author: "채널운영중",
    date: "2026.06.20",
    views: "852",
    comments: 14,
    budget: "편당 3만원~",
    period: "월 단위 계약",
    workStyle: "원격",
  },
  "chatbot-llm-dev-outsource": {
    slug: "chatbot-llm-dev-outsource",
    type: "의뢰",
    fields: ["챗봇·LLM 개발", "웹·앱 개발"],
    status: "모집중",
    title: "고객 상담용 LLM 챗봇 외주 개발 의뢰",
    excerpt:
      "쇼핑몰 CS 자동화용 RAG 기반 챗봇입니다. Claude API 또는 GPT-4o 활용 가능하며 제품 FAQ, 반품 안내, 주문 조회 등 핵심 시나리오 15개를 커버해야 합니다. 상세 요구사항 문서와 API 접근권한은 계약 후 제공됩니다. 원격 진행 가능하며 주 1회 화상 미팅 희망합니다.",
    author: "스타트업창업자",
    date: "2026.06.18",
    views: "1,203",
    comments: 22,
    budget: "350만원 ~ 협의",
    period: "6주 이내",
    workStyle: "원격",
  },
  "prompt-engineer-wanted": {
    slug: "prompt-engineer-wanted",
    type: "구직",
    fields: ["프롬프트 엔지니어링", "컨설팅·강의"],
    status: "모집중",
    title: "프롬프트 엔지니어링·AI 교육 강사로 활동하고 싶습니다",
    excerpt:
      "2년 이상의 Claude/GPT 프롬프트 최적화 경험과 기업 대상 AI 워크숍 진행 이력을 보유하고 있습니다. Chain-of-Thought, RAG, 에이전트 설계 등 심화 주제 가능. 강의·컨설팅·콘텐츠 제작 등 다양한 협업 형태 제안 환영합니다. 포트폴리오 자료 요청 시 제공 가능합니다.",
    author: "프롬프트장인",
    date: "2026.06.17",
    views: "674",
    comments: 8,
    period: "상시 모집",
    workStyle: "원격·혼합",
  },
  "music-ai-bgm-request": {
    slug: "music-ai-bgm-request",
    type: "의뢰",
    fields: ["음악·오디오"],
    status: "마감",
    title: "팟캐스트 배경음악 AI 작곡 의뢰 — 마감되었습니다",
    excerpt:
      "주간 팟캐스트 인트로/아웃트로 및 배경음악 5종 제작 의뢰. 상업적 이용 가능한 라이선스 포함. Suno, Udio 활용 가능하신 분. 이미 협업자가 선정되어 마감되었습니다. 관심 가져주신 모든 분들께 감사드립니다.",
    author: "팟캐스터K",
    date: "2026.06.14",
    views: "430",
    comments: 6,
    budget: "30만원 (일괄)",
  },
  "automation-workflow-expert": {
    slug: "automation-workflow-expert",
    type: "구직",
    fields: ["자동화·워크플로", "챗봇·LLM 개발"],
    status: "마감",
    title: "n8n / Make 자동화 전문가 — 포지션 결정됨",
    excerpt:
      "n8n, Make, Zapier 3년 경력으로 LLM API 연동 자동화 파이프라인 구축 전문입니다. 현재 복수 프로젝트 진행 중으로 당분간 추가 프로젝트를 받기 어렵습니다. 추후 여유가 생기면 업데이트할 예정입니다.",
    author: "자동화마스터",
    date: "2026.06.12",
    views: "589",
    comments: 9,
    workStyle: "원격",
  },
};

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return Object.keys(MOCK_GIG_DETAIL).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = MOCK_GIG_DETAIL[slug];
  if (!post) return { title: "작당 의뢰소 | AI작당" };
  return {
    title: `${post.title} | 작당 의뢰소 - AI작당`,
    description: post.excerpt.slice(0, 100),
  };
}

export default async function GigDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = MOCK_GIG_DETAIL[slug];

  if (!post) {
    notFound();
  }

  return (
    <>
      {/* 히어로: 작당 라운지 대메뉴 공통 히어로 */}
      <BoardHero menu="lounge" currentSub="작당 의뢰소" />

      {/* 상세 내용은 클라이언트 컴포넌트로 분리 (모집상태 토글, 쪽지 버튼) */}
      <GigDetailClient post={post} />
    </>
  );
}
