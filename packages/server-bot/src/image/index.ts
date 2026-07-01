/**
 * 이미지 엔진 통합 진입점 (Story 11.8 AC #4).
 *
 * fetchBotImage()가 전략 결정 → 이미지 조달 → 업로드 → URL 반환을 일괄 처리한다.
 * 이미지 실패로 글 게시 자체가 막히지 않도록 모든 단계에서 예외를 catch한다.
 *
 * ── 업로드 함수 주입 패턴 ────────────────────────────────────────────────────────
 * apps/api/src/services/storage 를 server-bot에서 직접 import하면 패키지 경계
 * 위반이다. 따라서 uploadImage 함수를 FetchBotImageParams.uploadFn으로 주입받는다.
 * 호출 측(Story 11.9 파이프라인)에서 apps/api의 uploadImage를 주입한다:
 *
 *   import { uploadImage } from 'apps/api/src/services/storage/index.js';
 *   fetchBotImage({ ..., uploadFn: uploadImage })
 *
 * uploadFn 미주입 시 stock·ai 전략이더라도 imageUrl=null을 반환한다.
 *
 * ── 'meme' 전략 보류 큐 주의 ─────────────────────────────────────────────────────
 * isMeme=true 반환 시 bot_hold_queue INSERT는 이 파일이 아닌
 * Story 11.9 글 생성 파이프라인에서 수행한다.
 * 이 엔진은 플래그(isMeme)만 반환한다.
 * [Source: docs/seeding-bot/ARCHITECTURE.md#2.8-bot_hold_queue — reason: copyright_risk]
 */

import { decideImageStrategy, type PersonaContext, type ImageStrategy, type PostKind } from "./strategy.js";
import { pickStock } from "./stock.js";
import { genImage } from "./generate.js";

// 하위 모듈 공개 타입 re-export
export type { PersonaContext, ImageStrategy, PostKind } from "./strategy.js";
export type { StockImage } from "./stock.js";
export type { GenImageParams, GenImageResult } from "./generate.js";
export { decideImageStrategy } from "./strategy.js";
export { pickStock } from "./stock.js";
export { genImage } from "./generate.js";
export { prependImageToTiptapDoc } from "./tiptap.js";

/**
 * 이미지 업로드 함수 타입.
 * apps/api/src/services/storage 의 uploadImage 시그니처와 호환된다:
 *   uploadImage(file: ParsedFile, subdir) → Promise<UploadResult>
 */
export type UploadImageFn = (
  file: { filename: string; mimetype: string; data: Buffer },
  subdir: "avatars" | "banners" | "editor-images" | "attachments",
) => Promise<{ url: string; filename: string }>;

/** fetchBotImage 입력 파라미터. */
export interface FetchBotImageParams {
  /** 페르소나 컨텍스트 (이미지 전략 판단에 사용). */
  persona: PersonaContext;
  /** 대상 게시판 슬러그 (예: 'ai-creation', 'talk'). */
  board: string;
  /** 글 종류. */
  postKind: PostKind;
  /** 스톡 이미지 검색 키워드 (주제 title_seed에서 유래). */
  keyword: string;
  /** AI 이미지 생성 프롬프트 (board='ai-creation' 등, 선택). 미설정 시 keyword 기반 자동 생성. */
  aiPrompt?: string;
  /** bot_generation_jobs.id — 비용 기록용 (선택). */
  jobId?: string;
  /**
   * 이미지 업로드 함수 주입 (apps/api/src/services/storage 의 uploadImage 주입).
   * 미주입 시 stock·ai 전략이더라도 imageUrl=null 반환.
   *
   * 주입 방법 (Story 11.9 파이프라인):
   *   import { uploadImage } from '../../services/storage/index.js';
   *   fetchBotImage({ ..., uploadFn: uploadImage })
   */
  uploadFn?: UploadImageFn;
}

/** fetchBotImage 반환 타입. */
export interface FetchBotImageResult {
  /** 최종 S3 URL 또는 외부 URL, 없으면 null. */
  imageUrl: string | null;
  /** 적용된 전략. */
  strategy: ImageStrategy;
  /**
   * true면 copyright_risk 보류 큐 적재 필요.
   * 실제 bot_hold_queue INSERT는 Story 11.9 파이프라인 담당.
   */
  isMeme: boolean;
}

/**
 * 외부 URL에서 이미지 데이터를 다운로드한다.
 * 타임아웃 15초. MIME이 image/* 가 아니면 image/jpeg 기본값 사용.
 * 실패 시 null 반환.
 */
async function downloadImageFromUrl(
  url: string,
): Promise<{ data: Buffer; mimetype: string; filename: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const rawMime = contentType.split(";")[0]?.trim() ?? "image/jpeg";
    // MIME이 image/* 가 아니면 기본값으로 대체
    const mimetype = rawMime.startsWith("image/") ? rawMime : "image/jpeg";

    const data = Buffer.from(await res.arrayBuffer());
    const ext = mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    return { data, mimetype, filename: `bot-image.${ext}` };
  } catch {
    return null;
  }
}

/**
 * 봇 이미지를 조달·업로드하고 URL을 반환한다.
 *
 * 처리 흐름:
 * 1. decideImageStrategy → 전략 결정
 * 2-A. 'stock': pickStock → 다운로드 → uploadFn → S3 URL 반환
 * 2-B. 'ai'  : genImage  → 다운로드 → uploadFn → S3 URL 반환 + 비용 기록
 * 2-C. 'none': null 반환 (이미지 없음)
 * 2-D. 'meme': null + isMeme=true 반환 (11.9 파이프라인이 보류 큐 적재)
 *
 * 모든 단계에서 예외 발생 시 imageUrl=null로 안전 복귀.
 * 이미지 실패로 글 게시 자체가 막히면 안 된다.
 */
export async function fetchBotImage(
  params: FetchBotImageParams,
): Promise<FetchBotImageResult> {
  const { persona, board, postKind, keyword, aiPrompt, jobId, uploadFn } =
    params;

  const strategy = decideImageStrategy(persona, board, postKind);

  const failResult = (overrideStrategy?: ImageStrategy): FetchBotImageResult => ({
    imageUrl: null,
    strategy: overrideStrategy ?? strategy,
    isMeme: false,
  });

  try {
    // 이미지 없음
    if (strategy === "none") {
      return failResult();
    }

    // 밈 전략: imageUrl=null + isMeme=true 플래그
    // 실제 밈 소스(Giphy 등) 미구현. 11.9 파이프라인이 copyright_risk 보류 큐 적재.
    if (strategy === "meme") {
      return { imageUrl: null, strategy, isMeme: true };
    }

    // stock·ai: 업로드 함수 필요
    if (!uploadFn) {
      return failResult();
    }

    // 스톡 이미지 조달
    if (strategy === "stock") {
      const image = await pickStock(keyword);
      if (!image) return failResult();

      const downloaded = await downloadImageFromUrl(image.url);
      if (!downloaded) return failResult();

      const { url } = await uploadFn(downloaded, "editor-images");

      // Unsplash API 이용 약관: 이미지 선택 후 download endpoint fire-and-forget 필수
      if (image.downloadUrl) {
        void fetch(image.downloadUrl, {
          signal: AbortSignal.timeout(10_000),
        }).catch(() => undefined);
      }

      return { imageUrl: url, strategy, isMeme: false };
    }

    // AI 이미지 생성 (strategy === 'ai')
    const prompt =
      aiPrompt ?? `high quality illustration for article: ${keyword}`;
    const result = await genImage({ prompt, jobId });
    if (!result) return failResult();

    const downloaded = await downloadImageFromUrl(result.url);
    if (!downloaded) return failResult();

    const { url } = await uploadFn(downloaded, "editor-images");
    return { imageUrl: url, strategy, isMeme: false };
  } catch {
    return failResult();
  }
}
