/**
 * 게이미피케이션 Zod 스키마 — Epic 6.
 *
 * API 요청/응답 유효성 검증 및 타입 추론용.
 */

import { z } from "zod";

// ── Grade ──────────────────────────────────────────────────────────────────────

export const gradeSchema = z.object({
  id: z.string().uuid(),
  level: z.number().int().min(1).max(5),
  name: z.string().min(1),
  minPoints: z.number().int().nonnegative(),
  maxPoints: z.number().int().nonnegative().nullable(),
});
export type Grade = z.infer<typeof gradeSchema>;

// ── Badge ──────────────────────────────────────────────────────────────────────

export const badgeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  iconUrl: z.string().url(),
  isAuto: z.boolean(),
});
export type Badge = z.infer<typeof badgeSchema>;

// ── UserBadge ─────────────────────────────────────────────────────────────────

export const userBadgeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  badgeId: z.string().uuid(),
  grantedAt: z.string().datetime(),
  grantedBy: z.string().uuid().nullable(),
});
export type UserBadge = z.infer<typeof userBadgeSchema>;

// ── PointsLedgerEntry ─────────────────────────────────────────────────────────

export const pointsLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type PointsLedgerEntry = z.infer<typeof pointsLedgerEntrySchema>;

// ── RankEntry ─────────────────────────────────────────────────────────────────

export const rankEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: z.string().uuid(),
  nickname: z.string().min(1),
  gradeLevel: z.number().int().min(1).max(5),
  gradeName: z.string().min(1),
  totalDelta: z.number().int(),
});
export type RankEntry = z.infer<typeof rankEntrySchema>;

// ── RankingResponse ───────────────────────────────────────────────────────────

export const periodTypeSchema = z.enum(["weekly", "monthly"]);
export type PeriodType = z.infer<typeof periodTypeSchema>;

export const rankingResponseSchema = z.object({
  period: periodTypeSchema,
  items: z.array(rankEntrySchema),
  generatedAt: z.string().datetime(),
});
export type RankingResponse = z.infer<typeof rankingResponseSchema>;

// ── UserBadgesResponse ────────────────────────────────────────────────────────

export const userBadgesResponseSchema = z.object({
  userId: z.string().uuid(),
  badges: z.array(
    z.object({
      badge: badgeSchema,
      grantedAt: z.string().datetime(),
      grantedBy: z.string().uuid().nullable(),
    }),
  ),
  total: z.number().int().nonnegative(),
});
export type UserBadgesResponse = z.infer<typeof userBadgesResponseSchema>;
