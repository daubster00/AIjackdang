/**
 * 광고 관리 스키마 — Story 9.16.
 *
 * ad_slots: 광고 슬롯 정의(위치·기기·유형·노출기간·코드). soft-delete(deleted_at).
 * ad_impressions: 슬롯별 일자 노출/클릭 집계(성과 차트용). 실제 트래킹 연동은 범위 외(샘플 시드).
 */

import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enum ──────────────────────────────────────────────────────────────────────

export const adDevice = pgEnum("ad_device", ["all", "pc", "mobile"]);

export const adType = pgEnum("ad_type", [
  "adsense",
  "direct_banner",
  "text",
  "affiliate",
  "internal",
]);

// ── ad_slots ────────────────────────────────────────────────────────────────────

export const adSlots = pgTable(
  "ad_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    /** 노출 위치 코드 (예: main_top, sidebar, mobile_bottom) */
    placement: text("placement").notNull(),
    device: adDevice("device").notNull().default("all"),
    adType: adType("ad_type").notNull().default("direct_banner"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    clickUrl: text("click_url"),
    code: text("code"),
    imageUrl: text("image_url"),
    memo: text("memo"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("ad_slots_placement_idx").on(t.placement),
    index("ad_slots_is_active_idx").on(t.isActive),
  ],
);

export type AdSlotRow = typeof adSlots.$inferSelect;
export type NewAdSlotRow = typeof adSlots.$inferInsert;

// ── ad_impressions ──────────────────────────────────────────────────────────────

export const adImpressions = pgTable(
  "ad_impressions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => adSlots.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
  },
  (t) => [index("ad_impressions_slot_id_idx").on(t.slotId)],
);

export type AdImpressionRow = typeof adImpressions.$inferSelect;
export type NewAdImpressionRow = typeof adImpressions.$inferInsert;
