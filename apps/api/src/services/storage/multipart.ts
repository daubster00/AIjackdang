/**
 * 간단한 멀티파트 파서 (Story 1.9).
 *
 * @fastify/multipart 미설치 환경을 위한 순수 Node.js 기반 구현.
 * Content-Type: multipart/form-data 요청에서 첫 번째 파일 필드를 추출한다.
 *
 * 편차: @fastify/multipart 대신 Node.js 내장 Buffer 기반 멀티파트 파싱 사용.
 */

export interface ParsedFile {
  filename: string;
  mimetype: string;
  data: Buffer;
}

/**
 * multipart/form-data body 버퍼에서 첫 번째 파일 part를 추출한다.
 *
 * @param body - 요청 본문 버퍼
 * @param contentType - Content-Type 헤더 전체 (boundary 포함)
 * @returns 파싱된 파일 정보 또는 null
 */
export function parseMultipartFile(body: Buffer, contentType: string): ParsedFile | null {
  // boundary 추출
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return null;
  const boundary = Buffer.from(`--${(boundaryMatch[1] ?? boundaryMatch[2]).trim()}`);

  // boundary 로 parts 분리
  const parts: Buffer[] = [];
  let start = 0;
  while (start < body.length) {
    const boundaryIdx = indexOf(body, boundary, start);
    if (boundaryIdx === -1) break;
    const partStart = boundaryIdx + boundary.length;
    // \r\n 건너뜀
    const contentStart = partStart + 2;
    const nextBoundary = indexOf(body, boundary, partStart);
    if (nextBoundary === -1) break;
    // 마지막 \r\n 제거
    const partEnd = nextBoundary - 2;
    if (partEnd > contentStart) {
      parts.push(body.slice(contentStart, partEnd));
    }
    start = nextBoundary;
  }

  // 각 part 에서 파일 part 검색 (Content-Disposition: form-data; name="file" filename="...")
  for (const part of parts) {
    const headerEnd = indexOf(part, Buffer.from("\r\n\r\n"), 0);
    if (headerEnd === -1) continue;
    const headerBuf = part.slice(0, headerEnd).toString("utf-8");
    const bodyBuf = part.slice(headerEnd + 4);

    // Content-Disposition 파싱
    const dispositionLine = headerBuf.split("\r\n").find((l) => l.toLowerCase().startsWith("content-disposition"));
    if (!dispositionLine) continue;

    const filenameMatch = dispositionLine.match(/filename\*?=(?:"([^"]+)"|([^;\s]+))/i);
    if (!filenameMatch) continue; // 파일 field 아님
    const filename = filenameMatch[1] ?? filenameMatch[2] ?? "upload";

    // Content-Type 파싱
    const ctLine = headerBuf.split("\r\n").find((l) => l.toLowerCase().startsWith("content-type"));
    const mimetype = ctLine ? ctLine.split(":")[1]?.trim() ?? "application/octet-stream" : "application/octet-stream";

    return { filename, mimetype, data: bodyBuf };
  }

  return null;
}

/** Buffer 내에서 패턴의 인덱스 탐색 */
function indexOf(buf: Buffer, pattern: Buffer, offset: number): number {
  for (let i = offset; i <= buf.length - pattern.length; i++) {
    if (buf.slice(i, i + pattern.length).equals(pattern)) return i;
  }
  return -1;
}
