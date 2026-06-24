/**
 * Next.js On-Demand Revalidation 트리거 헬퍼 — Story 8.9 (AR-17)
 *
 * apps/api(Fastify)는 별도 프로세스이므로 revalidatePath/revalidateTag 직접 호출 불가.
 * apps/web의 POST /api/revalidate Route Handler를 HTTP로 호출하는 방식을 사용한다.
 * REVALIDATE_SECRET 미일치 시 401 반환 → 무단 호출 방지.
 *
 * 글 작성/수정/삭제 성공 후 호출하면 해당 경로 캐시를 즉시 무효화한다.
 * 호출 실패는 치명적이지 않으므로 warn 로그만 남기고 오류를 전파하지 않는다.
 */

import pino from "pino";

const logger = pino({ name: "revalidate" });

/**
 * Next.js 캐시 On-Demand 무효화 요청을 전송한다.
 *
 * @param path  무효화할 경로 (예: '/vibe-coding', '/questions')
 * @param tag   무효화할 태그 (예: 'posts')
 */
export async function triggerRevalidate(path?: string, tag?: string): Promise<void> {
  const url = process.env.WEB_PUBLIC_URL ?? "http://localhost:3003";
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    logger.warn({ path, tag }, "REVALIDATE_SECRET 미설정 — revalidate 건너뜀");
    return;
  }

  try {
    const response = await fetch(`${url}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ path, tag }),
    });

    if (!response.ok) {
      logger.warn(
        { status: response.status, path, tag },
        "revalidate 응답 비정상",
      );
    }
  } catch (e) {
    // 무효화 실패는 치명적이지 않음 — 다음 TTL 만료 시 자동 갱신됨
    logger.warn({ err: e, path, tag }, "revalidate 호출 실패");
  }
}
