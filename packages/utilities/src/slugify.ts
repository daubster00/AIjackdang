/**
 * 슬러그 생성 유틸 — Story 2.7
 *
 * `slugify`는 string.ts 에 원본이 있으며, 이 파일에서는
 * DB 유니크 충돌 방지를 위한 `generateUniqueSlug` 를 추가로 제공한다.
 * API service 레이어에서 DB uniqueness 체크 후 suffix 를 붙일 때 사용한다.
 */

import { customAlphabet } from "nanoid";
import { slugify } from "./string.js";

export { slugify };

/** URL-safe 소문자+숫자 6자리 ID 생성기 */
const nanoid6 = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

/**
 * baseSlug 가 이미 존재하는지 확인하고, 중복이면 `-{nanoid6()}` suffix 를 붙여 반환한다.
 *
 * @param baseSlug    - `slugify(title)` 로 생성한 기본 슬러그
 * @param existsCheck - DB 또는 임의 저장소에서 slug 존재 여부를 확인하는 비동기 함수
 * @returns 사용 가능한 고유 슬러그
 *
 * @example
 * ```ts
 * const base = slugify(title);                // "내-첫-게시글"
 * const slug = await generateUniqueSlug(base, async (s) => {
 *   const rows = await db.select().from(posts).where(eq(posts.slug, s)).limit(1);
 *   return rows.length > 0;
 * });
 * ```
 */
export async function generateUniqueSlug(
  baseSlug: string,
  existsCheck: (slug: string) => Promise<boolean>,
): Promise<string> {
  // 빈 슬러그 방어
  const base = baseSlug.trim() || "post";

  // 원본 슬러그가 사용 가능하면 그대로 반환
  if (!(await existsCheck(base))) {
    return base;
  }

  // 최대 5회 재시도 (실무 상 충분)
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${nanoid6()}`;
    if (!(await existsCheck(candidate))) {
      return candidate;
    }
  }

  // 극히 드문 충돌: timestamp suffix 로 최종 fallback
  return `${base}-${Date.now()}`;
}
