import { z } from "zod";

// ── 공개 프로필 (응답) — Story 1.10 ──────────────────────────────────────────────
/**
 * GET /api/v1/users/profile/{nickname} 응답 규격.
 * 비회원도 열람하는 공개 프로필이므로 민감 정보(email·status·suspendedUntil·links)는 제외한다.
 *
 * - avatarUrl / bannerUrl: DB의 raw 값(상대 경로 가능)이라 .url() 강제하지 않고 nullable string.
 *   기본 아바타 해석은 클라이언트의 getDefaultAvatarUrl(defaultAvatarIndex)에서 처리.
 * - rank: 등급 키. 포인트 시스템(Epic 6) 전까지 기본 'rookie'(새내기).
 * - followersCount / followingCount: 팔로우 기능(Epic 5 Story 5.12) 전까지 0.
 */
export const publicProfileSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  defaultAvatarIndex: z.number().int().nonnegative(),
  bannerUrl: z.string().nullable(),
  /** 등급 키: 'rookie' | 'regular' | ... (Epic 6 전까지 'rookie') */
  rank: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  followersCount: z.number().int().nonnegative().default(0),
  followingCount: z.number().int().nonnegative().default(0),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;
