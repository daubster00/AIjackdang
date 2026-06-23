/**
 * post_creative_spec 스키마 — Story 2.11 AI 창작마당 창작물 스펙
 *
 * posts 테이블과 1:1 관계 (post_id PK + FK, ON DELETE CASCADE).
 * 모든 필드 nullable — 선택 입력이므로 레코드 자체가 없을 수도 있음.
 *
 * media_type: jsonb 배열 (UI 다중 선택 지원 — 단일 enum 대신 배열로 저장)
 * tools: jsonb 배열 { name, model?, role? }[]
 * params: jsonb 자유 key-value
 * postprocess: jsonb (후처리 워크플로 자유 텍스트)
 * cost_type: "free" | "paid" enum
 * license_note: license + 상업적 사용 정보 병합 텍스트
 */

import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { posts } from "./posts";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const costTypeEnum = pgEnum("cost_type_enum", ["free", "paid"]);

// ── post_creative_spec ────────────────────────────────────────────────────────

export const postCreativeSpec = pgTable("post_creative_spec", {
  // 1:1 FK — posts.id PK + CASCADE
  postId: uuid("post_id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),

  // 창작물 유형 — jsonb 배열 (다중 선택: ["이미지", "영상"] 등)
  mediaType: jsonb("media_type"),

  // 사용 AI 툴·모델 배열 { name, model?, role? }[]
  tools: jsonb("tools"),

  // 프롬프트
  prompt: text("prompt"),
  negativePrompt: text("negative_prompt"),

  // 주요 파라미터 자유 key-value
  params: jsonb("params"),

  // 후처리·워크플로 자유 텍스트
  postprocess: jsonb("postprocess"),

  // 비용 타입
  costType: costTypeEnum("cost_type"),

  // 제작 소요 시간 (자유 텍스트 예: "2시간 30분")
  timeSpent: text("time_spent"),

  // 라이선스 노트 — license + 상업적 사용 병합 텍스트
  licenseNote: text("license_note"),

  // 타임스탬프
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PostCreativeSpecRow = typeof postCreativeSpec.$inferSelect;
export type NewPostCreativeSpecRow = typeof postCreativeSpec.$inferInsert;
