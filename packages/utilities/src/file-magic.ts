/**
 * 파일 매직넘버(파일 시그니처) 검증 유틸 — Story 4.5
 *
 * 첨부파일 업로드 전 확장자와 실제 파일 내용이 일치하는지 확인한다.
 * 이진 파일: 파일 앞부분 바이트 패턴(매직넘버)으로 판별.
 * 텍스트 파일(.md/.txt/.json): 첫 512바이트 내 비인쇄 제어문자 비율로 이진 여부 판별.
 *
 * 허용 확장자: zip, docx, xlsx, pdf, md, txt, json
 * (AR-15: 업로드 허용 목록 외 확장자는 서비스 레이어에서 먼저 차단)
 */

/** 허용 확장자 타입 (resource_files.allowed_extension enum과 동일) */
export type AllowedExtension = "zip" | "docx" | "xlsx" | "pdf" | "md" | "txt" | "json";

/** 허용 확장자 목록 */
export const ALLOWED_EXTENSIONS: AllowedExtension[] = [
  "zip",
  "docx",
  "xlsx",
  "pdf",
  "md",
  "txt",
  "json",
];

/**
 * 확장자별 매직넘버(파일 시그니처) 정의.
 * 각 항목은 파일 시작 바이트 배열이다.
 * 복수 매직넘버: 하나라도 일치하면 통과.
 *
 * zip/docx/xlsx: PK\x03\x04 (ZIP 기반 포맷)
 * pdf: %PDF
 * md/txt/json: 매직넘버 없음 — isBinaryContent()로 텍스트 여부 판별
 */
const MAGIC_MAP: Partial<Record<AllowedExtension, Buffer[]>> = {
  zip: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],   // PK\x03\x04
  docx: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],  // PK\x03\x04 (Office Open XML)
  xlsx: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],  // PK\x03\x04 (Office Open XML)
  pdf: [Buffer.from([0x25, 0x50, 0x44, 0x46])],   // %PDF
  // md, txt, json: 텍스트 파일 — MAGIC_MAP에 없으면 isBinaryContent로 판별
};

/** 텍스트 파일로 취급하는 확장자 */
const TEXT_EXTENSIONS: Set<AllowedExtension> = new Set(["md", "txt", "json"]);

/**
 * 이진 파일 여부를 판별한다.
 * 첫 512바이트에서 null byte(\x00) 비율이 5%를 넘으면 이진으로 판단.
 *
 * 주의: UTF-8 한국어 등 멀티바이트 문자(0x80~0xFF)는 정상 텍스트이므로
 * null byte와 ASCII 제어문자(0x01~0x08, 0x0E~0x1F)만 검사한다.
 * 0x7F(DEL), 0x80~0x9F(C1 제어)는 UTF-8 멀티바이트 시퀀스에서 나타나므로 제외.
 *
 * @param buffer 파일 버퍼(최소 0바이트 이상)
 * @returns true이면 이진 파일(텍스트 파일이 아님)
 */
export function isBinaryContent(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 512);
  if (sample.length === 0) return false;

  let suspiciousBytes = 0;
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i]!;
    // null byte: 텍스트 파일에서 거의 등장하지 않음 — 가장 강력한 이진 지표
    // ASCII 제어문자(0x01~0x08, 0x0E~0x1F): 텍스트에서 불필요
    // 단, 탭(0x09), LF(0x0A), CR(0x0D), 폼피드(0x0C), ESC(0x1B)는 허용
    if (
      byte === 0x00 ||
      (byte >= 0x01 && byte <= 0x08) ||
      byte === 0x0b || // VT
      (byte >= 0x0e && byte <= 0x1a) ||
      byte === 0x1c || byte === 0x1d || byte === 0x1e || byte === 0x1f
    ) {
      suspiciousBytes++;
    }
  }

  const ratio = suspiciousBytes / sample.length;
  return ratio >= 0.05; // 5% 이상이면 이진 파일
}

/**
 * 파일 버퍼가 해당 확장자의 매직넘버와 일치하는지 검증한다.
 *
 * @param buffer 파일 전체 버퍼(최소 첫 4~8바이트 이상)
 * @param ext 확장자(점 없이, 소문자) — e.g. "zip", "pdf", "md"
 * @returns 유효한 파일 시그니처이면 true
 *
 * @example
 * // zip 파일 검증
 * validateFileSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, ...]), 'zip') // true
 * // 텍스트 파일 검증
 * validateFileSignature(Buffer.from('# hello'), 'md') // true
 */
export function validateFileSignature(buffer: Buffer, ext: string): boolean {
  const normalizedExt = ext.toLowerCase().replace(/^\./, "") as AllowedExtension;

  // 허용 확장자 목록 체크
  if (!ALLOWED_EXTENSIONS.includes(normalizedExt)) {
    return false;
  }

  // 텍스트 파일: 이진 내용이 아니면 통과
  if (TEXT_EXTENSIONS.has(normalizedExt)) {
    return !isBinaryContent(buffer);
  }

  // 이진 파일: 매직넘버 비교
  const magics = MAGIC_MAP[normalizedExt];
  if (!magics || magics.length === 0) {
    // 매직넘버 정의가 없는 경우 — 통과(보수적)
    return true;
  }

  for (const magic of magics) {
    if (buffer.length < magic.length) continue;
    const prefix = buffer.subarray(0, magic.length);
    if (prefix.equals(magic)) {
      return true;
    }
  }

  return false;
}
