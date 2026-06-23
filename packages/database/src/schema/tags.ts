/**
 * 태그 스키마 — AR-6 다형성 taggable 패턴
 *
 * tags: 태그 마스터 (slug = slugify(name), 한글 태그 포함)
 * taggable: 다형 참조 테이블 — target_type/target_id 조합으로 post/question/resource 등에 태그 연결.
 * 현재 허용 target_type: 'post' (Epic 3=question, Epic 4=resource 확장 예정).
 */

import { index, pgTable, primaryKey, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// ── tags ──────────────────────────────────────────────────────────────────────

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tags_slug_idx").on(t.slug),
    index("tags_name_idx").on(t.name),
  ],
);

export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;

// ── taggable ──────────────────────────────────────────────────────────────────

export const taggable = pgTable(
  "taggable",
  {
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: uuid("target_id").notNull(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.targetType, t.targetId, t.tagId] }),
    index("taggable_target_idx").on(t.targetType, t.targetId),
    index("taggable_tag_id_idx").on(t.tagId),
  ],
);

export type TaggableRow = typeof taggable.$inferSelect;
export type NewTaggableRow = typeof taggable.$inferInsert;
