/**
 * 이미지 워터마크 합성 (게시판 본문 이미지 전용).
 *
 * 업로드된 이미지의 우측 하단에 흰색 반투명 로고를 얹는다.
 * - 로고 원본은 파란색(#3232cc) SVG 이므로 흰색으로 치환하고 opacity 를 적용한다.
 * - 워터마크 크기는 원본 이미지 폭에 비례(반응형)하며, 너무 작은 이미지는 생략한다.
 * - GIF(애니메이션)는 프레임이 깨지므로 워터마크를 적용하지 않고 원본을 그대로 반환한다.
 * - 어떤 이유로든 처리에 실패하면 원본 버퍼를 그대로 반환한다(업로드가 절대 실패하지 않도록).
 */

import sharp from "sharp";

/** 흰색 로고 불투명도 (0~1). 사용자 지정: 은은하게 35%. */
const WATERMARK_OPACITY = 0.35;
/** 워터마크 폭 = 원본 이미지 폭 × 이 비율 */
const WATERMARK_WIDTH_RATIO = 0.11;
/** 워터마크 최소/최대 폭(px) — 너무 작거나 크지 않도록 */
const WATERMARK_MIN_WIDTH = 45;
const WATERMARK_MAX_WIDTH = 190;
/** 가장자리 여백 = 원본 이미지 폭 × 이 비율 (최소 8px) */
const WATERMARK_MARGIN_RATIO = 0.025;
const WATERMARK_MIN_MARGIN = 8;
/** 이미지 폭이 이보다 작으면 워터마크를 생략(아이콘/썸네일 보호) */
const MIN_IMAGE_WIDTH = 240;
/** 로고 종횡비(height / width) — viewBox 205/282 기준 */
const LOGO_ASPECT = 205 / 282;

/**
 * 흰색 로고 SVG (viewBox 0 0 282 205). __W__/__H__/__OPACITY__ 는 런타임 치환.
 * 원본 apps/web/public/logo.svg 의 path 데이터를 그대로 쓰되 fill 을 흰색으로,
 * 각 path 에 opacity 를 적용한다(로고 path 들은 서로 겹치지 않아 중복 블렌딩 없음).
 */
const LOGO_SVG_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="__W__" height="__H__" viewBox="0 0 282 205">
  <defs>
    <style>
      .st0 { fill: #ffffff; opacity: __OPACITY__; }
    </style>
  </defs>
  <path class="st0" d="M163.89,55.07h-.2L120.12,0h-60.68v50.09c-.24,4.18-1.1,6.36-4.25,9.52h0S0,102.46,0,102.46v71.09h55.2v-103.57c.26-7.72,6.23-13.98,13.82-14.66h52.47c4.97.45,9.26,3.29,11.69,7.37v98.13c-.21,9.95-8.31,17.96-18.29,17.96h-13.08v26.22h26.16v-13.11c0-10.06,8.09-18.23,18.1-18.34h17.82V55.07Z"/>
  <g>
    <path class="st0" d="M199.46,77.33h-9.12l-2.37,6.19h-4.73l9.62-24.28h4.06l9.62,24.28h-4.69l-2.37-6.19ZM194.86,65.08c-.85,2.54-1.6,4.66-2.27,6.37l-.83,2.16h6.26l-.83-2.16c-.66-1.72-1.41-3.84-2.27-6.37h-.07Z"/>
    <path class="st0" d="M209.96,83.52v-24.28h4.44v24.28h-4.44Z"/>
    <path class="st0" d="M190.37,103.84h4.44v17.95c0,.8-.06,1.49-.17,2.06-.12.57-.29,1.08-.52,1.51-.3.58-.68,1.07-1.14,1.48-.46.41-.98.74-1.56,1s-1.2.45-1.86.56c-.66.11-1.35.17-2.06.17s-1.45-.06-2.15-.18-1.28-.28-1.75-.47v-3.79c.53.22,1.1.39,1.7.51.6.12,1.2.18,1.79.18,1.15,0,1.98-.27,2.5-.8.52-.53.78-1.32.78-2.36v-17.82Z"/>
    <path class="st0" d="M214.38,121.93h-9.12l-2.37,6.19h-4.73l9.62-24.28h4.06l9.62,24.28h-4.69l-2.37-6.19ZM209.78,109.68c-.85,2.54-1.6,4.66-2.27,6.37l-.83,2.16h6.26l-.83-2.16c-.66-1.72-1.41-3.84-2.27-6.37h-.07Z"/>
    <path class="st0" d="M236.31,107.14c-1.21,0-2.32.2-3.34.6-1.02.4-1.9.98-2.63,1.74-.73.76-1.3,1.7-1.71,2.82-.41,1.12-.61,2.4-.61,3.84s.19,2.68.56,3.77.91,1.99,1.61,2.71c.7.73,1.55,1.27,2.56,1.64,1.01.37,2.15.55,3.43.55.92,0,1.85-.07,2.81-.22s1.85-.36,2.68-.63v3.83c-.85.24-1.76.43-2.73.57s-1.99.21-3.04.21c-2.05,0-3.86-.29-5.42-.88s-2.86-1.42-3.9-2.49c-1.04-1.07-1.83-2.35-2.35-3.85-.53-1.49-.79-3.14-.79-4.95s.28-3.57.84-5.15c.56-1.58,1.37-2.96,2.43-4.12,1.06-1.16,2.38-2.08,3.97-2.74,1.59-.67,3.38-1,5.39-1.02,1.02,0,2,.07,2.91.21s1.75.34,2.48.59v3.77c-.97-.3-1.86-.51-2.7-.63s-1.65-.18-2.45-.18Z"/>
    <path class="st0" d="M246.2,128.12v-24.28h4.44v11.05h.07l9.15-11.05h5.5l-10.1,12.03,10.94,12.25h-5.69l-9.8-10.96h-.07v10.96h-4.44Z"/>
    <path class="st0" d="M185.59,172.72v-24.28h6.41c.57,0,1.14.02,1.73.05.58.04,1.16.09,1.71.16.55.07,1.09.16,1.61.26s1,.23,1.43.37c1.29.41,2.43.97,3.42,1.67.99.7,1.82,1.53,2.49,2.49.67.96,1.18,2.03,1.52,3.21s.52,2.46.52,3.84c0,1.31-.14,2.53-.43,3.67-.29,1.14-.73,2.19-1.32,3.13s-1.34,1.78-2.24,2.49c-.9.72-1.96,1.31-3.2,1.77-1.03.39-2.19.68-3.5.87-1.3.19-2.77.29-4.4.29h-5.76ZM191.86,169c2.6,0,4.62-.36,6.09-1.07,1.29-.64,2.27-1.57,2.93-2.79s1-2.78,1-4.68c0-.99-.11-1.89-.33-2.69-.22-.8-.53-1.51-.94-2.13-.41-.62-.91-1.16-1.49-1.61-.59-.45-1.25-.82-1.98-1.11-.69-.27-1.46-.46-2.3-.58s-1.79-.18-2.84-.18h-1.96v16.84h1.83Z"/>
    <path class="st0" d="M225.01,166.53h-9.12l-2.37,6.19h-4.73l9.62-24.28h4.06l9.62,24.28h-4.69l-2.37-6.19ZM220.41,154.28c-.85,2.54-1.6,4.66-2.27,6.37l-.83,2.16h6.26l-.83-2.16c-.66-1.72-1.41-3.84-2.27-6.37h-.07Z"/>
    <path class="st0" d="M248.14,159.73c1.74,2.48,3.15,4.68,4.24,6.61h.11c-.14-3.16-.22-5.46-.22-6.9v-11h4.44v24.28h-4.65l-7.89-11.18c-1.39-1.94-2.83-4.18-4.31-6.73h-.11c.14,2.98.22,5.28.22,6.92v11h-4.44v-24.28h4.65l7.97,11.29Z"/>
    <path class="st0" d="M277.56,163.44h-5.43v-3.72h9.87v12.25c-.36.13-.82.27-1.38.42s-1.19.28-1.88.39c-.7.12-1.41.21-2.15.28-.74.07-1.47.11-2.19.11-2.17,0-4.07-.29-5.69-.88-1.62-.58-2.98-1.41-4.06-2.48s-1.89-2.33-2.43-3.8-.81-3.09-.81-4.87c0-1.26.14-2.46.43-3.6s.7-2.2,1.25-3.18c.55-.97,1.22-1.85,2-2.64.78-.79,1.68-1.46,2.69-2.01s2.11-.98,3.31-1.28c1.2-.29,2.49-.45,3.87-.45,1.22,0,2.38.09,3.48.26,1.1.18,2,.39,2.7.65v3.77c-.94-.3-1.89-.53-2.85-.69-.96-.16-1.93-.23-2.91-.23-1.32,0-2.55.19-3.69.59-1.15.39-2.14.97-2.98,1.74-.84.77-1.5,1.71-1.98,2.84-.48,1.12-.72,2.43-.72,3.9.01,2.87.76,5.02,2.25,6.45,1.48,1.43,3.59,2.15,6.32,2.15.51,0,1.03-.03,1.58-.08.54-.06,1.02-.12,1.43-.21v-5.68Z"/>
  </g>
</svg>`;

/** mimetype → sharp 출력 포맷. 지원 외 타입이면 null. */
function sharpFormatFor(mimetype: string): "jpeg" | "png" | "webp" | null {
  switch (mimetype) {
    case "image/jpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

function buildLogoSvg(width: number, height: number): string {
  return LOGO_SVG_TEMPLATE.replace("__W__", String(width))
    .replace("__H__", String(height))
    .replace("__OPACITY__", String(WATERMARK_OPACITY));
}

/**
 * 이미지 버퍼에 우측 하단 흰색 반투명 로고 워터마크를 합성해 반환한다.
 * 실패 시(GIF·소형 이미지·처리 오류 등) 원본 버퍼를 그대로 반환한다.
 */
export async function watermarkImage(input: Buffer, mimetype: string): Promise<Buffer> {
  // GIF 는 애니메이션이 깨지므로 건드리지 않는다.
  if (mimetype === "image/gif") return input;

  const outFormat = sharpFormatFor(mimetype);
  if (!outFormat) return input;

  try {
    const base = sharp(input, { failOn: "none" });
    const meta = await base.metadata();
    if (!meta.width || !meta.height) return input;

    // 아이콘/썸네일급 소형 이미지는 워터마크가 과도하므로 생략.
    if (meta.width < MIN_IMAGE_WIDTH) return input;

    // 워터마크 크기 계산(폭 비례 + 상·하한 클램프).
    const wmWidth = Math.round(
      Math.min(
        WATERMARK_MAX_WIDTH,
        Math.max(WATERMARK_MIN_WIDTH, meta.width * WATERMARK_WIDTH_RATIO),
      ),
    );
    const wmHeight = Math.round(wmWidth * LOGO_ASPECT);

    // 워터마크가 이미지보다 크면 생략(세로로 매우 좁은 이미지 등).
    if (wmWidth >= meta.width || wmHeight >= meta.height) return input;

    const margin = Math.max(
      WATERMARK_MIN_MARGIN,
      Math.round(meta.width * WATERMARK_MARGIN_RATIO),
    );

    const left = Math.max(0, meta.width - wmWidth - margin);
    const top = Math.max(0, meta.height - wmHeight - margin);

    // 흰색 로고 SVG → PNG(투명 배경) 래스터화.
    const logoPng = await sharp(Buffer.from(buildLogoSvg(wmWidth, wmHeight)))
      .png()
      .toBuffer();

    let pipeline = base.composite([{ input: logoPng, top, left }]);
    // 원본과 동일 포맷으로 재인코딩(확장자/ MIME 은 호출 측에서 유지).
    if (outFormat === "jpeg") pipeline = pipeline.jpeg({ quality: 90 });
    else if (outFormat === "png") pipeline = pipeline.png();
    else pipeline = pipeline.webp({ quality: 90 });

    return await pipeline.toBuffer();
  } catch {
    // 어떤 오류든 업로드를 막지 않는다 — 원본 반환.
    return input;
  }
}
