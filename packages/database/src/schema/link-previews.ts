/**
 * link_previews 스키마 — Story 8.6
 *
 * 게시글·질문 본문의 외부 링크에 대한 OG 메타 캐시 테이블.
 * PK = url (text) — 동일 URL은 단일 레코드로 관리(upsert).
 * fetched_at: 성공적으로 수집된 시각.
 * error_at: 수집 실패 시각 (재시도 포기 후 기록).
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ── link_previews ─────────────────────────────────────────────────────────────

export const linkPreviews = pgTable("link_previews", {
  url: text("url").primaryKey(),
  title: text("title"),
  description: text("description"),
  imageUrl: text("image_url"),
  siteName: text("site_name"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  errorAt: timestamp("error_at", { withTimezone: true }),
});

export type LinkPreview = typeof linkPreviews.$inferSelect;
export type NewLinkPreview = typeof linkPreviews.$inferInsert;
