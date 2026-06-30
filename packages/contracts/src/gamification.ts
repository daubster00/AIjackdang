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

// ── GradeUpJob ────────────────────────────────────────────────────────────────

/** BullMQ gamification.grade-up 잡 페이로드 (Story 6.3) */
export const gradeUpJobSchema = z.object({
  userId: z.string().uuid(),
  prevLevel: z.number().int().min(1).max(5),
  newLevel: z.number().int().min(1).max(5),
  newGradeName: z.string().min(1),
});
export type GradeUpJobPayload = z.infer<typeof gradeUpJobSchema>;

// ── [6.5] RankingComputeJob ───────────────────────────────────────────────────

/** BullMQ ranking.compute 잡 페이로드 (Story 6.5) */
export const rankingComputeJobSchema = z.object({
  period: periodTypeSchema,
});
export type RankingComputeJobPayload = z.infer<typeof rankingComputeJobSchema>;

// ── [6.5] END ─────────────────────────────────────────────────────────────────

// ── [6.6] MeResponse ─────────────────────────────────────────────────────────

/** GET /api/v1/gamification/me 응답 스키마 (grade + points) */
const gradeInfoSchema = z.object({
  level: z.number().int().min(1).max(5),
  name: z.string().min(1),
});

export const meResponseSchema = z.object({
  totalPoints: z.number().int().nonnegative(),
  grade: gradeInfoSchema,
  nextGrade: gradeInfoSchema.nullable(),
  pointsToNext: z.number().int().nonnegative().nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

// ── [6.6] END ─────────────────────────────────────────────────────────────────

// ── [수정요청 G] 포인트 적립 내역 ───────────────────────────────────────────────

/**
 * GET /api/v1/gamification/me/points-history 단건 항목.
 * reasonLabel 은 서버가 reason 코드를 한국어 설명으로 변환해 내려준다.
 */
export const pointsHistoryItemSchema = z.object({
  id: z.string().uuid(),
  /** 양수=적립, 음수=회수 */
  delta: z.number().int(),
  /** 원본 사유 코드 (예: 'post.created') */
  reason: z.string().min(1),
  /** 사람이 읽는 한국어 사유 (예: '게시글 작성') */
  reasonLabel: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type PointsHistoryItem = z.infer<typeof pointsHistoryItemSchema>;

/** GET /api/v1/gamification/me/points-history 응답 (현재 누적 포인트 + 페이지 내역) */
export const pointsHistoryResponseSchema = z.object({
  totalPoints: z.number().int(),
  items: z.array(pointsHistoryItemSchema),
  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type PointsHistoryResponse = z.infer<typeof pointsHistoryResponseSchema>;

// ── [수정요청 G] 등급 안내 목록 ─────────────────────────────────────────────────

/** GET /api/v1/gamification/grades 응답 (등급 안내 페이지용 전체 등급 목록) */
export const gradesListResponseSchema = z.object({
  items: z.array(
    z.object({
      level: z.number().int().min(1).max(5),
      name: z.string().min(1),
      minPoints: z.number().int().nonnegative(),
      maxPoints: z.number().int().nonnegative().nullable(),
    }),
  ),
});
export type GradesListResponse = z.infer<typeof gradesListResponseSchema>;
