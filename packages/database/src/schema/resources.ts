/**
 * 실전자료(resources) 도메인 스키마 — Epic 4 소유
 *
 * resources: 실전자료 메타 + 본문 (Tiptap JSON)
 * resource_files: 첨부파일 (R2 저장, ClamAV 스캔 상태 추적)
 * ratings: 평점 (resource당 user 1개 유니크)
 *
 * comment/reaction/bookmark/report 테이블은 Epic 5 소유 — 여기서 생성 금지.
 * soft-delete: status enum + deleted_at (AR-7)
 * 본문: Tiptap JSON jsonb 컬럼 — HTML 원본 저장 금지 (AR-8)
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ── Enum ──────────────────────────────────────────────────────────────────────

/** 실전자료 유형 */
export const resourceType = pgEnum("resource_type", [
  "prompt",
  "claude-code-skill",
  "mcp",
  "rules-config",
  "template-checklist",
]);

/** 난이도 */
export const difficulty = pgEnum("difficulty", ["beginner", "intermediate", "advanced"]);

/** 실전자료 운영 상태 (AR-7 soft-delete) */
export const resourceStatus = pgEnum("resource_status", [
  "draft",
  "published",
  "hidden",
  "deleted",
]);

/** 첨부파일 허용 확장자 */
export const allowedExtension = pgEnum("allowed_extension", [
  "zip",
  "md",
  "txt",
  "json",
  "pdf",
  "docx",
  "xlsx",
]);

/** 파일 바이러스 스캔 상태 (worker ClamAV) */
export const scanStatus = pgEnum("scan_status", ["pending", "clean", "infected", "error"]);

/** 첨부파일 운영 상태 (soft-delete용, AR-7) */
export const resourceFileStatus = pgEnum("resource_file_status", ["active", "deleted"]);

// ── resources ─────────────────────────────────────────────────────────────────

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 작성자 (탈퇴 시 null — ON DELETE SET NULL)
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    // 식별 / 검색
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),

    // 분류
    resourceType: resourceType("resource_type").notNull(),
    /** PostgreSQL text[] 배열 */
    environment: text("environment").array().notNull().default(sql`'{}'`),
    difficulty: difficulty("difficulty").notNull(),

    // 본문 — Tiptap JSON 전용 (HTML 저장 절대 금지, AR-8)
    descriptionJson: jsonb("description_json").notNull(),
    usageJson: jsonb("usage_json").notNull(),
    cautionJson: jsonb("caution_json"),

    // 전문 검색 — pg_bigm GIN 인덱스 대상 (Story 8.1, AR-5)
    searchVector: text("search_vector").generatedAlwaysAs(
      sql`title || ' ' || coalesce(description_json::text, '')`,
    ),

    // 썸네일 URL — 본문(Tiptap) 첫 이미지에서 자동 생성(크롭). 없으면 기본 이미지 사용(웹 폴백).
    thumbnailUrl: text("thumbnail_url"),

    // 메타
    version: text("version"),
    /** [{label: string, url: string}] 형식 */
    referenceLinks: jsonb("reference_links"),

    // 운영 상태 (AR-7 soft-delete)
    status: resourceStatus("status").notNull().default("draft"),

    // 저작권 동의 (등록 시 필수 체크)
    copyrightAgreed: boolean("copyright_agreed").notNull().default(false),

    // 통계 (직접 UPDATE 금지 — worker 경유)
    downloadCount: integer("download_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    avgRating: numeric("avg_rating", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),

    // 공통 타임스탬프
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("resources_user_id_idx").on(t.userId),
    index("resources_resource_type_idx").on(t.resourceType),
    index("resources_difficulty_idx").on(t.difficulty),
    index("resources_status_idx").on(t.status),
    index("resources_created_at_idx").on(t.createdAt),
    uniqueIndex("resources_slug_uq").on(t.slug),
  ],
);

export type ResourceRow = typeof resources.$inferSelect;
export type NewResourceRow = typeof resources.$inferInsert;

// ── resource_files ─────────────────────────────────────────────────────────────

/**
 * is_primary=true는 resource당 정확히 1개만 허용.
 *
 * 설계 결정: Application service 레이어 보장 방식 채택.
 * - upsert/insert 전 기존 is_primary=true 파일을 false로 변경 후 새 파일을 primary로 지정.
 * - DB 레벨 대안: `CREATE UNIQUE INDEX ON resource_files (resource_id) WHERE is_primary = true;`
 *   (drizzle-kit이 partial index DDL을 generate하지 않으므로 수동 migration 필요)
 * - 현재 구현: application 레이어 보장 (service.ts에서 트랜잭션으로 처리)
 */
export const resourceFiles = pgTable(
  "resource_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 소속 자료 (삭제 시 cascade)
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),

    // 파일 정보
    originalName: text("original_name").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    allowedExtension: allowedExtension("allowed_extension").notNull(),

    // 대표 파일 여부 (resource당 1개만 true — 위 설계 주석 참조)
    isPrimary: boolean("is_primary").notNull().default(false),

    // ClamAV 바이러스 스캔 상태 (worker: resource.scan job)
    scanStatus: scanStatus("scan_status").notNull().default("pending"),
    scanCompletedAt: timestamp("scan_completed_at", { withTimezone: true }),

    // 표시 순서
    displayOrder: integer("display_order").notNull().default(0),

    // 파일 운영 상태 (soft-delete 대용 — AR-7. S3 실제 삭제는 Epic 9 cleanup worker)
    fileStatus: resourceFileStatus("file_status").notNull().default("active"),

    // 타임스탬프
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resource_files_resource_id_idx").on(t.resourceId),
    index("resource_files_scan_status_idx").on(t.scanStatus),
    index("resource_files_file_status_idx").on(t.fileStatus),
    uniqueIndex("resource_files_storage_key_uq").on(t.storageKey),
  ],
);

export type ResourceFileRow = typeof resourceFiles.$inferSelect;
export type NewResourceFileRow = typeof resourceFiles.$inferInsert;

// ── ratings ────────────────────────────────────────────────────────────────────

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 대상 자료
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),

    // 평가자 (탈퇴 시 null — ON DELETE SET NULL)
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    // 점수 (1~5, CHECK constraint)
    score: smallint("score").notNull(),

    // 타임스탬프
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // resource당 user 1개 평점만 허용
    uniqueIndex("ratings_resource_user_uq").on(t.resourceId, t.userId),
    index("ratings_resource_id_idx").on(t.resourceId),
    index("ratings_user_id_idx").on(t.userId),
    // score 범위 제약
    check("ratings_score_range", sql`score BETWEEN 1 AND 5`),
  ],
);

export type RatingRow = typeof ratings.$inferSelect;
export type NewRatingRow = typeof ratings.$inferInsert;
