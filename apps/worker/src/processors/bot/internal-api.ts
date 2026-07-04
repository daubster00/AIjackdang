/**
 * 봇 워커 → apps/api 내부 API 브리지 헬퍼.
 *
 * worker 프로세스는 apps/api/src/* 를 직접 import할 수 없으므로(프로세스 경계),
 * 봇 파이프라인 실행을 apps/api의 /internal/bots/* 엔드포인트로 위임한다.
 * (커리큘럼 예약 게시 curriculumPublish.processor.ts와 동일 패턴)
 *
 * throw 금지 — 네트워크 오류·비정상 응답 모두 null 반환. BullMQ 재시도 큐 오염 방지.
 */

/**
 * 내부 봇 API로 POST 요청을 보낸다.
 *
 * @param path  "/internal/bots/write" 등 경로
 * @param body  JSON 바디 (없으면 undefined)
 * @param jobId 로깅용 BullMQ jobId
 * @returns 파싱된 JSON 응답, 실패 시 null
 */
export async function postInternalBotApi<T = unknown>(
  path: string,
  body: unknown,
  jobId?: string,
): Promise<T | null> {
  const apiBaseUrl = (process.env.API_INTERNAL_URL ?? "http://localhost:4003").replace(/\/$/, "");
  const internalKey = process.env.INTERNAL_API_KEY ?? "";

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": internalKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(
        `[bot-internal] ${path} 응답 오류: ${response.status} ${response.statusText} (jobId=${jobId})`,
      );
      return null; // throw 금지
    }

    return (await response.json()) as T;
  } catch (err) {
    console.error(
      `[bot-internal] ${path} 미도달 — 네트워크 오류 (jobId=${jobId}):`,
      (err as Error).message,
    );
    return null; // throw 금지
  }
}
