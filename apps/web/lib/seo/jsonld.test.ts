/**
 * jsonld.ts 단위 테스트 — Story 2.10 AC #3
 *
 * buildCollectionPageJsonLd / buildDiscussionJsonLd / buildArticleJsonLd / buildBreadcrumbJsonLd
 * 각 함수의 Schema.org 핵심 필드(@context, @type, name/headline, itemListElement[0].position)를 검증한다.
 */

import { describe, it, expect } from "vitest";
import {
  buildCollectionPageJsonLd,
  buildDiscussionJsonLd,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
} from "./jsonld";
import type { BoardMeta } from "@ai-jakdang/contracts";
import type { PostDetail } from "@ai-jakdang/contracts";

// ── 픽스처 ─────────────────────────────────────────────────────────────────────

const mockBoard: BoardMeta = {
  label: "바이브 코딩 가이드",
  description: "바이브 코딩 방법론 · 튜토리얼 · 실전 가이드",
  category: "vibe-coding",
  urlPath: "/vibe-coding/guide",
};

const mockPost: PostDetail = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "hello-vibe-coding",
  title: "바이브 코딩 시작하기",
  summary: "바이브 코딩의 기초를 다루는 첫 번째 가이드 글입니다.",
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
  tags: ["vibe-coding", "튜토리얼"],
  contentHtml: "<p>바이브 코딩 시작하기</p>",
  contentJson: { type: "doc", content: [] },
  authorId: "00000000-0000-0000-0000-000000000099",
  userId: "00000000-0000-0000-0000-000000000099",
  isOwner: false,
  status: "published",
};

const noticePost: PostDetail = {
  ...mockPost,
  id: "00000000-0000-0000-0000-000000000002",
  slug: "notice-001",
  board: "notice",
  title: "공지사항 제목",
  summary: "공지사항 요약 내용입니다.",
};

// ── buildCollectionPageJsonLd ─────────────────────────────────────────────────

describe("buildCollectionPageJsonLd", () => {
  it("@context가 'https://schema.org'이다", () => {
    const result = buildCollectionPageJsonLd(mockBoard, "https://aijakdang.com/vibe-coding/guide");
    expect(result["@context"]).toBe("https://schema.org");
  });

  it("@type이 'CollectionPage'이다", () => {
    const result = buildCollectionPageJsonLd(mockBoard, "https://aijakdang.com/vibe-coding/guide");
    expect(result["@type"]).toBe("CollectionPage");
  });

  it("name이 board.label과 일치한다", () => {
    const url = "https://aijakdang.com/vibe-coding/guide";
    const result = buildCollectionPageJsonLd(mockBoard, url);
    expect(result.name).toBe(mockBoard.label);
  });

  it("url이 전달된 URL과 일치한다", () => {
    const url = "https://aijakdang.com/vibe-coding/guide";
    const result = buildCollectionPageJsonLd(mockBoard, url);
    expect(result.url).toBe(url);
  });

  it("description이 board.description과 일치한다", () => {
    const result = buildCollectionPageJsonLd(mockBoard, "https://aijakdang.com/vibe-coding/guide");
    expect(result.description).toBe(mockBoard.description);
  });
});

// ── buildDiscussionJsonLd ─────────────────────────────────────────────────────

describe("buildDiscussionJsonLd", () => {
  it("@context가 'https://schema.org'이다", () => {
    const result = buildDiscussionJsonLd(mockPost, "/vibe-coding/guide");
    expect(result["@context"]).toBe("https://schema.org");
  });

  it("@type이 'DiscussionForumPosting'이다", () => {
    const result = buildDiscussionJsonLd(mockPost, "/vibe-coding/guide");
    expect(result["@type"]).toBe("DiscussionForumPosting");
  });

  it("headline이 post.title과 일치한다", () => {
    const result = buildDiscussionJsonLd(mockPost, "/vibe-coding/guide");
    expect(result.headline).toBe(mockPost.title);
  });

  it("author.name이 post.authorNickname과 일치한다", () => {
    const result = buildDiscussionJsonLd(mockPost, "/vibe-coding/guide");
    expect(result.author.name).toBe(mockPost.authorNickname);
  });

  it("datePublished가 post.createdAt과 일치한다", () => {
    const result = buildDiscussionJsonLd(mockPost, "/vibe-coding/guide");
    expect(result.datePublished).toBe(mockPost.createdAt);
  });

  it("authorNickname이 null이면 author.name이 '익명'이다", () => {
    const anonymousPost: PostDetail = { ...mockPost, authorNickname: null };
    const result = buildDiscussionJsonLd(anonymousPost, "/vibe-coding/guide");
    expect(result.author.name).toBe("익명");
  });
});

// ── buildArticleJsonLd ────────────────────────────────────────────────────────

describe("buildArticleJsonLd", () => {
  it("@context가 'https://schema.org'이다", () => {
    const result = buildArticleJsonLd(noticePost, "/notice");
    expect(result["@context"]).toBe("https://schema.org");
  });

  it("notice 게시판 글은 @type이 'Article'이다", () => {
    const result = buildArticleJsonLd(noticePost, "/notice");
    expect(result["@type"]).toBe("Article");
  });

  it("일반 게시판 글은 @type이 'BlogPosting'이다", () => {
    const result = buildArticleJsonLd(mockPost, "/vibe-coding/guide");
    expect(result["@type"]).toBe("BlogPosting");
  });

  it("headline이 post.title과 일치한다", () => {
    const result = buildArticleJsonLd(noticePost, "/notice");
    expect(result.headline).toBe(noticePost.title);
  });

  it("author.name이 post.authorNickname과 일치한다", () => {
    const result = buildArticleJsonLd(noticePost, "/notice");
    expect(result.author.name).toBe(noticePost.authorNickname);
  });

  it("summary가 있으면 description이 summary와 일치한다", () => {
    const result = buildArticleJsonLd(noticePost, "/notice");
    expect(result.description).toBe(noticePost.summary);
  });

  it("summary가 null이면 description이 title을 160자로 잘라 사용한다", () => {
    const postWithoutSummary: PostDetail = { ...noticePost, summary: null };
    const result = buildArticleJsonLd(postWithoutSummary, "/notice");
    expect(result.description).toBe(noticePost.title.slice(0, 160));
  });
});

// ── buildBreadcrumbJsonLd ─────────────────────────────────────────────────────

describe("buildBreadcrumbJsonLd", () => {
  const items = [
    { name: "홈", url: "https://aijakdang.com" },
    { name: "바이브 코딩", url: "https://aijakdang.com/vibe-coding" },
    { name: "바이브 코딩 가이드", url: "https://aijakdang.com/vibe-coding/guide" },
  ];

  it("@context가 'https://schema.org'이다", () => {
    const result = buildBreadcrumbJsonLd(items);
    expect(result["@context"]).toBe("https://schema.org");
  });

  it("@type이 'BreadcrumbList'이다", () => {
    const result = buildBreadcrumbJsonLd(items);
    expect(result["@type"]).toBe("BreadcrumbList");
  });

  it("첫 번째 항목의 position이 1이다", () => {
    const result = buildBreadcrumbJsonLd(items);
    expect(result.itemListElement[0].position).toBe(1);
  });

  it("두 번째 항목의 position이 2이다", () => {
    const result = buildBreadcrumbJsonLd(items);
    expect(result.itemListElement[1].position).toBe(2);
  });

  it("첫 번째 항목의 name이 items[0].name과 일치한다", () => {
    const result = buildBreadcrumbJsonLd(items);
    expect(result.itemListElement[0].name).toBe("홈");
  });

  it("첫 번째 항목의 item(URL)이 items[0].url과 일치한다", () => {
    const result = buildBreadcrumbJsonLd(items);
    expect(result.itemListElement[0].item).toBe("https://aijakdang.com");
  });

  it("itemListElement 개수가 입력 항목 수와 일치한다", () => {
    const result = buildBreadcrumbJsonLd(items);
    expect(result.itemListElement).toHaveLength(items.length);
  });

  it("빈 배열 입력 시 itemListElement가 빈 배열이다", () => {
    const result = buildBreadcrumbJsonLd([]);
    expect(result.itemListElement).toHaveLength(0);
  });
});
