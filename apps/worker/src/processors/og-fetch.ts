/**
 * og-fetch 잡 처리기 — Story 8.6
 *
 * 게시글·질문 본문의 외부 URL에서 OG 메타태그를 수집하여
 * link_previews 테이블에 upsert한다.
 *
 * 규칙:
 * - 개별 URL 실패는 error_at 기록 후 잡 전체는 완료(resolve) 처리
 * - Promise.allSettled로 병렬 수집
 * - 3초 타임아웃 (AbortSignal.timeout)
 * - node-html-parser 미설치 → 직접 regex로 <meta> 태그 파싱
 */

import type { Job } from "bullmq";
import { getDb, schema } from "@ai-jakdang/database";

export interface OgFetchJobData {
  targetType: "post" | "question";
  targetId: string;
  urls: string[];
}

interface OgMeta {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

/**
 * HTML 문자열에서 <meta> 태그를 추출한다.
 * node-html-parser 미사용 — 정규식으로 직접 파싱.
 */
function parseOgMeta(html: string): OgMeta {
  // <meta property="og:xxx" content="..."> 형태 추출
  // content와 property 순서가 바뀔 수 있으므로 두 패턴 모두 처리
  function getOgValue(property: string): string | null {
    // property="og:xxx" content="yyy"
    const re1 = new RegExp(
      `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`,
      "i",
    );
    const m1 = re1.exec(html);
    if (m1) return decodeHtmlEntities(m1[1] ?? "");

    // content="yyy" property="og:xxx"
    const re2 = new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`,
      "i",
    );
    const m2 = re2.exec(html);
    if (m2) return decodeHtmlEntities(m2[1] ?? "");

    return null;
  }

  // og:description이 없을 때 <meta name="description"> fallback
  function getMetaDescription(): string | null {
    const re1 = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i;
    const m1 = re1.exec(html);
    if (m1) return decodeHtmlEntities(m1[1] ?? "");

    const re2 = /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i;
    const m2 = re2.exec(html);
    if (m2) return decodeHtmlEntities(m2[1] ?? "");

    return null;
  }

  const title = getOgValue("og:title");
  const description = getOgValue("og:description") ?? getMetaDescription();
  const imageUrl = getOgValue("og:image");
  const siteName = getOgValue("og:site_name");

  return { title, description, imageUrl, siteName };
}

/** HTML 엔티티 디코드 (기본 문자만) */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * URL에서 OG 메타를 수집한다.
 * 실패 시 예외를 throw한다 (호출자에서 처리).
 */
async function fetchOgMeta(url: string): Promise<OgMeta> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(3000),
    headers: {
      "User-Agent": "AI작당-OGBot/1.0",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`non-HTML content-type: ${contentType}`);
  }

  // 메모리 절약: 처음 200KB만 파싱
  const reader = response.body?.getReader();
  if (!reader) throw new Error("response body 없음");

  let html = "";
  let totalBytes = 0;
  const limit = 200 * 1024; // 200KB

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    html += new TextDecoder().decode(value);
    totalBytes += value?.length ?? 0;
    if (totalBytes >= limit) {
      reader.cancel().catch(() => {});
      break;
    }
  }

  return parseOgMeta(html);
}

/**
 * og.fetch 잡 처리기.
 * 각 URL에 대해 OG 메타를 수집하고 link_previews에 upsert한다.
 * 개별 URL 실패는 error_at 기록, 잡 전체는 항상 resolve.
 */
export async function ogFetchProcessor(job: Job<OgFetchJobData>): Promise<void> {
  const { urls } = job.data;
  const db = getDb();

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const meta = await fetchOgMeta(url);

        await db
          .insert(schema.linkPreviews)
          .values({
            url,
            title: meta.title,
            description: meta.description,
            imageUrl: meta.imageUrl,
            siteName: meta.siteName,
            fetchedAt: new Date(),
            errorAt: null,
          })
          .onConflictDoUpdate({
            target: schema.linkPreviews.url,
            set: {
              title: meta.title,
              description: meta.description,
              imageUrl: meta.imageUrl,
              siteName: meta.siteName,
              fetchedAt: new Date(),
              errorAt: null,
            },
          });

        console.info(`[og-fetch] 수집 완료: ${url}`);
      } catch (err) {
        console.warn(`[og-fetch] 수집 실패: ${url} —`, (err as Error).message);

        // 실패 기록 (error_at 갱신, 나머지 필드는 기존 값 유지)
        try {
          await db
            .insert(schema.linkPreviews)
            .values({
              url,
              errorAt: new Date(),
            })
            .onConflictDoUpdate({
              target: schema.linkPreviews.url,
              set: {
                errorAt: new Date(),
              },
            });
        } catch (dbErr) {
          console.error(`[og-fetch] DB 기록 실패: ${url} —`, (dbErr as Error).message);
        }
      }
    }),
  );

  // 통계 출력 (디버그용)
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.info(
    `[og-fetch] 잡 완료 (jobId=${job.id}): ${succeeded}건 성공, ${failed}건 실패`,
  );
}
