import type { Metadata } from "next";
import { BookmarkList, type BookmarkItem } from "./BookmarkList";

export const metadata: Metadata = {
  title: "북마크",
  description: "내가 저장한 글을 한곳에서 모아봅니다.",
  robots: { index: false, follow: true },
};

/**
 * 북마크 목록 더미 데이터.
 * 북마크는 여러 게시판(바이브코딩 가이드 / 묻고답하기 / 실전자료 등)에 걸쳐 저장되므로
 * 각 항목은 자신이 속한 게시판(board)과 그 게시판으로 가는 경로(href)를 함께 가진다.
 */
const bookmarks: BookmarkItem[] = [
  {
    id: "ai-work-scope",
    href: "/vibe-coding/ai-work-scope",
    boardKey: "vibe-coding",
    board: "바이브코딩 가이드",
    category: "시작 가이드",
    title: "AI에게 일을 맡기기 전에 사람이 정해야 하는 것",
    excerpt:
      "요구사항, 수정 범위, 완료 기준을 먼저 정리하면 AI 결과물을 검토하고 반영하는 시간을 줄일 수 있습니다.",
    author: "AI작당 운영팀",
    savedAt: "2026.06.18",
    views: "2,418",
    likes: 186,
    comments: 32,
    tags: ["요구사항", "작업범위", "검증"],
  },
  {
    id: "claude-code-checklist",
    href: "/vibe-coding/claude-code-checklist",
    boardKey: "vibe-coding",
    board: "바이브코딩 가이드",
    category: "검증",
    title: "Claude Code 결과물을 바로 반영하기 전에 확인할 체크리스트",
    excerpt: "빌드, 테스트, 사용 흐름, 접근성까지 빠르게 잡는 검증 순서를 정리했습니다.",
    author: "리뷰메이트",
    savedAt: "2026.06.15",
    views: "1,802",
    likes: 142,
    comments: 21,
    tags: ["체크리스트", "리뷰", "테스트"],
  },
  {
    id: "supabase-rls-error",
    href: "/questions/supabase-rls-error",
    boardKey: "questions",
    board: "묻고답하기",
    category: "오류 해결",
    title: "Supabase RLS 정책을 켜니 데이터가 안 보여요",
    excerpt:
      "Row Level Security를 활성화한 뒤 select 결과가 비는 상황. 정책 조건과 인증 컨텍스트를 점검하는 순서입니다.",
    author: "백엔드초보",
    savedAt: "2026.06.13",
    views: "964",
    likes: 41,
    comments: 18,
    tags: ["Supabase", "RLS", "인증"],
  },
  {
    id: "mcp-filesystem",
    href: "/resources/mcp-skills",
    boardKey: "resources",
    board: "실전자료",
    category: "MCP·Skills",
    title: "파일시스템 MCP 서버 설정 템플릿",
    excerpt: "로컬 폴더를 안전하게 노출하는 권한 범위 예시와 함께 바로 복사해 쓰는 설정 파일입니다.",
    author: "자동화카페",
    savedAt: "2026.06.10",
    views: "1,233",
    likes: 97,
    comments: 9,
    tags: ["MCP", "템플릿", "설정"],
  },
];

export default function BookmarksPage() {
  return <BookmarkList items={bookmarks} />;
}
