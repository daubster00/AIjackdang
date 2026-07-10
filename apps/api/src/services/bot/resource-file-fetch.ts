/**
 * 봇 실전자료 큐레이션 — 첨부 파일 다운로더.
 *
 * 큐레이션으로 발굴한 자료의 실제 파일(현재는 GitHub 공개 저장소 전체 zip)을 받아,
 * 기존 사람 업로드 파이프라인(uploadResourceFiles)이 요구하는 버퍼 형태로 반환한다.
 *
 * 정책:
 *  - GitHub 저장소만 지원(codeload zip). 그 외 소스는 null(파일 없이 링크만).
 *  - 기본 브랜치를 몰라도 되도록 main → master 순서로 시도.
 *  - 크기 상한(uploadResourceFiles의 50MB보다 낮은 45MB)으로 과대 저장소 방어.
 *  - zip 매직넘버(PK) 확인 — HTML 오류 페이지 등 비-zip 응답 폐기.
 *  - 실패·예외 시 null(글은 유지, 파일만 생략).
 *
 * ⚠️ 재호스팅: 공개 저장소 파일을 우리 스토리지에 올린다(사용자 결정 2026-07-10).
 *    출처(원본 저장소 링크)는 본문·referenceLinks에 반드시 함께 표기한다.
 */

import type { CuratedFileSource } from "@ai-jakdang/server-bot/search";

/** uploadResourceFiles가 받는 파일 데이터 형태와 동일. */
export interface FetchedResourceFile {
  originalName: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/** 첨부 파일 최대 크기(45MB) — uploadResourceFiles 상한(50MB)보다 여유. */
const MAX_BYTES = 45 * 1024 * 1024;

/** 시도할 기본 브랜치(정확한 기본 브랜치를 몰라도 되도록 순차 시도). */
const BRANCHES = ["main", "master"] as const;

/**
 * 큐레이션 자료의 원본 파일을 받아 첨부 버퍼로 만든다.
 *
 * @param source discoverResource가 돌려준 fileSource(없으면 null).
 * @returns 첨부 가능한 파일 버퍼 또는 null(비지원 소스·다운로드 실패·과대·비-zip).
 */
export async function fetchCuratedResourceFile(
  source: CuratedFileSource | null | undefined,
): Promise<FetchedResourceFile | null> {
  if (!source || source.kind !== "github-repo") return null;
  const { owner, repo } = source;

  for (const branch of BRANCHES) {
    const url = `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zip/refs/heads/${branch}`;
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) continue; // 브랜치 없음(404) 등 → 다음 브랜치 시도

      // Content-Length가 있으면 다운로드 전에 과대 저장소 차단.
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (declared > MAX_BYTES) {
        try {
          await res.body?.cancel();
        } catch {
          /* noop */
        }
        return null;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;

      // zip 매직넘버(PK\x03\x04 / PK\x05\x06 빈 zip) 확인 — 비-zip 응답 폐기.
      if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) continue;

      return {
        originalName: `${repo}-${branch}.zip`,
        mimetype: "application/zip",
        buffer,
        size: buffer.length,
      };
    } catch (err) {
      console.error(
        `[bot/resource-file-fetch] ${owner}/${repo}@${branch} 다운로드 실패:`,
        (err as Error).message,
      );
      continue;
    }
  }

  return null;
}
