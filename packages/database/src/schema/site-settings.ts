/**
 * 사이트 설정 스키마 — Story 9.11 / 9.15.
 *
 * site_settings 테이블: key-value 운영 정책 저장소.
 * value 는 JSONB (문자열·숫자·불리언·배열 모두 저장 가능).
 * 코드 재배포 없이 어드민 UI(9.15)에서 신고/콘텐츠/파일/SEO 정책을 즉시 변경한다.
 */

import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ── site_settings ───────────────────────────────────────────────────────────────

export const siteSettings = pgTable("site_settings", {
  /** 설정 키 (예: 'auto_hide_enabled', 'forbidden_words', 'site_name') */
  key: text("key").primaryKey(),
  /** 설정 값 — JSONB. 불리언/숫자/문자열/배열 무엇이든 저장. */
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteSettingRow = typeof siteSettings.$inferSelect;
export type NewSiteSettingRow = typeof siteSettings.$inferInsert;
