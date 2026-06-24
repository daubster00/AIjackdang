/**
 * SEO 메타데이터 통합 테스트 — Story 2.10 AC #4
 *
 * buildPostMeta(mockPost).description === mockPost.summary 검증
 * buildPageMeta(boardMeta) 핵심 필드 검증
 */

import { describe, it, expect } from "vitest";
import { buildPostMeta, buildPageMeta } from "./metadata";
import type { PostDetail } from "@ai-jakdang/contracts";
import type { BoardMeta } from "@ai-jakdang/contracts";

// ── 픽스처 ─────────────────────────────────────────────────────────────────────

const mockPost: PostDetail = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "hello-vibe-coding",
  title: "바이브 코딩 시작하기",
  summary: "이 글은 요약 문장입니다. SEO meta description에 사용됩니다.",
  board: "vibe-coding-guide",
  authorNickname: "코드작당러",
  authorGrade: "master",
  authorAvatarUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  viewCount: 100,
  commentCount: 5,
  likeCount: 20,
  hasAttachment: false,
  isPinned: false,
  tags: ["vibe-coding"],
  contentHtml: "<p>본문</p>",
  contentJson: { type: "doc", content: [] },
  authorId: "00000000-0000-0000-0000-000000000099",
  isOwner: false,
  status: "published",
};

const mockBoard: BoardMeta = {
  label: "바이브 코딩 가이드",
  description: "바이브 코딩 방법론 · 튜토리얼 · 실전 가이드",
  category: "vibe-coding",
  urlPath: "/vibe-coding/guide",
};

// ── buildPostMeta ─────────────────────────────────────────────────────────────

describe("buildPostMeta", () => {
  it("summary가 있으면 description이 post.summary와 일치한다 (AC #4)", () => {
    const meta = buildPostMeta(mockPost);
    expect(meta.description).toBe(mockPost.summary);
  });

  it("summary가 null이면 description이 title을 160자로 잘라 사용한다", () => {
    const postWithoutSummary: PostDetail = { ...mockPost, summary: null };
    const meta = buildPostMeta(postWithoutSummary);
    expect(meta.description).toBe(mockPost.title.slice(0, 160));
  });

  it("title이 post.title과 board label을 포함한다", () => {
    const meta = buildPostMeta(mockPost);
    expect(String(meta.title)).toContain(mockPost.title);
  });

  it("alternates.canonical이 게시판 urlPath와 slug를 포함한다", () => {
    const meta = buildPostMeta(mockPost);
    const canonical = (meta.alternates as { canonical?: string })?.canonical ?? "";
    expect(canonical).toContain(mockPost.slug);
  });

  it("openGraph.type이 'article'이다", () => {
    const meta = buildPostMeta(mockPost);
    const og = meta.openGraph as { type?: string };
    expect(og?.type).toBe("article");
  });

  it("openGraph.description이 meta.description과 동일하다", () => {
    const meta = buildPostMeta(mockPost);
    const og = meta.openGraph as { description?: string };
    expect(og?.description).toBe(meta.description);
  });
});

// ── buildPageMeta ─────────────────────────────────────────────────────────────

describe("buildPageMeta", () => {
  it("title이 board.label을 포함한다", () => {
    const meta = buildPageMeta(mockBoard);
    expect(String(meta.title)).toContain(mockBoard.label);
  });

  it("description이 board.description과 일치한다", () => {
    const meta = buildPageMeta(mockBoard);
    expect(meta.description).toBe(mockBoard.description);
  });

  it("alternates.canonical이 board.urlPath를 포함한다", () => {
    const meta = buildPageMeta(mockBoard);
    const canonical = (meta.alternates as { canonical?: string })?.canonical ?? "";
    expect(canonical).toContain(mockBoard.urlPath);
  });

  it("page=2 이면 title에 '2페이지'가 포함된다", () => {
    const meta = buildPageMeta(mockBoard, { page: 2 });
    expect(String(meta.title)).toContain("2페이지");
  });

  it("page=1 이면 title에 페이지 번호가 없다", () => {
    const meta = buildPageMeta(mockBoard, { page: 1 });
    expect(String(meta.title)).not.toContain("페이지");
  });
});
