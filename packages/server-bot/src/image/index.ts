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
 * ── 'meme' 전략 폴백 ─────────────────────────────────────────────────────────────
 * 전용 밈 소스(Giphy 등)는 미구현이라, 과거에는 isMeme=true로 보류 큐에 넣어
 * 글이 아예 게시되지 않았다. 이제는 스톡 이미지로 폴백해 그냥 게시한다.
 * (isMeme은 하위호환 위해 남겨두되 항상 false.)
 */

import {
  decideImageStrategy,
  type PersonaContext,
  type ImageStrategy,
  type ImageStrategyOptions,
  type PostKind,
} from "./strategy.js";
import { pickStock, type StockImage } from "./stock.js";
import { genImage } from "./generate.js";
import { searchWebImage, type WebImage } from "./web.js";

// 하위 모듈 공개 타입 re-export
export type { PersonaContext, ImageStrategy, ImageStrategyOptions, PostKind } from "./strategy.js";
export type { StockImage } from "./stock.js";
export type { WebImage } from "./web.js";
export type { GenImageParams, GenImageResult } from "./generate.js";
export { DEFAULT_IMAGE_MODEL } from "./generate.js";
export type { ImageSourceCaption, YoutubeSourceCaption } from "./tiptap.js";
export type { GuideAssetManifest, GuideAssetManifestEntry } from "./tiptap.js";
export { decideImageStrategy } from "./strategy.js";
export { pickStock } from "./stock.js";
export { genImage } from "./generate.js";
export { searchWebImage } from "./web.js";
export { prependImageToTiptapDoc, prependImageWithSourceToTiptapDoc, prependYoutubeToTiptapDoc, insertInlineImagesByMarker } from "./tiptap.js";
export type { ImagePlanItem, PostImagePlan, PlanImagesOptions } from './planner.js';
export { planImagesForPost } from './planner.js';

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
  /**
   * 웹 이미지 검색용 영어 키워드(제품/기능명 중심).
   * 검색 주도 발굴에서 얻은 imageQuery. 미설정 시 keyword로 폴백.
   */
  webQuery?: string;
  /** 이미지 전략 옵션(preferWeb 등). decideImageStrategy에 그대로 전달. */
  strategyOptions?: ImageStrategyOptions;
  /** AI 이미지 생성 프롬프트 (board='ai-creation' 등, 선택). 미설정 시 keyword 기반 자동 생성. */
  aiPrompt?: string;
  /**
   * AI 이미지 생성 모델(관리자 할당값). strategy='ai'일 때만 사용.
   * 미지정 시 genImage가 DEFAULT_IMAGE_MODEL(구글 gemini-3.1-flash-image)로 폴백.
   */
  imageModel?: { provider: string; model: string };
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

/** 이미지 출처(타사 이미지를 퍼올 때 반드시 표기). */
export interface ImageSource {
  /** 출처 라벨(도메인·Unsplash 등). */
  label: string;
  /** 출처 원본 페이지 URL(있으면). */
  url?: string;
}

/** fetchBotImage 반환 타입. */
export interface FetchBotImageResult {
  /** 최종 S3 URL 또는 외부 URL, 없으면 null. */
  imageUrl: string | null;
  /** 적용된 전략. */
  strategy: ImageStrategy;
  /**
   * 이미지 출처(웹 검색·스톡). 있으면 파이프라인이 본문에 "이미지 출처: ..." 캡션을 붙인다.
   * AI 생성 이미지는 출처 없음(null).
   */
  source: ImageSource | null;
  /**
   * @deprecated meme 전략도 이제 스톡으로 폴백해 게시하므로 항상 false.
   * (과거: true면 copyright_risk 보류. 보류로 인해 글이 아예 안 올라가던 문제 제거.)
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
 * 이미 검색해 둔 웹 이미지(WebImage)를 다운로드해 스토리지에 업로드한다.
 *
 * 미디어 우선 큐레이션(밈을 먼저 찾고 그 밈 자체를 글감으로 쓰는 경로)처럼
 * 검색 시점과 첨부 시점이 분리될 때 사용한다.
 * 다운로드·업로드 실패 시 null — 이미지 실패로 게시가 막히면 안 된다.
 */
export async function uploadWebImage(
  web: WebImage,
  uploadFn: UploadImageFn,
): Promise<{ imageUrl: string; source: ImageSource } | null> {
  try {
    const downloaded = await downloadImageFromUrl(web.url);
    if (!downloaded) return null;
    const { url } = await uploadFn(downloaded, "editor-images");
    return {
      imageUrl: url,
      source: { label: web.sourceLabel, url: web.sourcePageUrl },
    };
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
 * 2-B. 'ai'  : genImage(할당 모델·기본 구글, base64 Buffer) → uploadFn → S3 URL 반환 + 비용 기록
 * 2-C. 'none': null 반환 (이미지 없음)
 * 2-D. 'meme': null + isMeme=true 반환 (11.9 파이프라인이 보류 큐 적재)
 *
 * 모든 단계에서 예외 발생 시 imageUrl=null로 안전 복귀.
 * 이미지 실패로 글 게시 자체가 막히면 안 된다.
 */
export async function fetchBotImage(
  params: FetchBotImageParams,
): Promise<FetchBotImageResult> {
  const {
    persona,
    board,
    postKind,
    keyword,
    webQuery,
    strategyOptions,
    aiPrompt,
    jobId,
    uploadFn,
    imageModel,
  } = params;

  const strategy = decideImageStrategy(persona, board, postKind, strategyOptions);

  const failResult = (overrideStrategy?: ImageStrategy): FetchBotImageResult => ({
    imageUrl: null,
    strategy: overrideStrategy ?? strategy,
    source: null,
    isMeme: false,
  });

  const stockLabel = (image: StockImage): string =>
    image.source === "unsplash" ? "Unsplash" : "Pexels";

  // 스톡 이미지 조달 공통 로직 (meme 폴백에서도 재사용)
  const fetchStock = async (
    effectiveStrategy: ImageStrategy,
  ): Promise<FetchBotImageResult> => {
    if (!uploadFn) return failResult(effectiveStrategy);
    const image = await pickStock(keyword);
    if (!image) return failResult(effectiveStrategy);

    const downloaded = await downloadImageFromUrl(image.url);
    if (!downloaded) return failResult(effectiveStrategy);

    const { url } = await uploadFn(downloaded, "editor-images");

    // Unsplash API 이용 약관: 이미지 선택 후 download endpoint fire-and-forget 필수
    if (image.downloadUrl) {
      void fetch(image.downloadUrl, {
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
    }

    return {
      imageUrl: url,
      strategy: effectiveStrategy,
      source: { label: stockLabel(image) },
      isMeme: false,
    };
  };

  try {
    // 이미지 없음
    if (strategy === "none") {
      return failResult();
    }

    // 밈 전략: 전용 밈 소스 미구현 → 스톡으로 폴백해 게시(보류로 막지 않음)
    if (strategy === "meme") {
      return await fetchStock("meme");
    }

    // stock·ai·web: 업로드 함수 필요
    if (!uploadFn) {
      return failResult();
    }

    // 웹 검색 이미지(출처 표기). 실패 시 스톡으로 폴백.
    if (strategy === "web") {
      const web = await searchWebImage(webQuery ?? keyword);
      if (web) {
        const uploaded = await uploadWebImage(web, uploadFn);
        if (uploaded) {
          return {
            imageUrl: uploaded.imageUrl,
            strategy: "web",
            source: uploaded.source,
            isMeme: false,
          };
        }
      }
      // 웹 이미지 실패 → 스톡 폴백
      return await fetchStock("stock");
    }

    // 스톡 이미지 조달
    if (strategy === "stock") {
      return await fetchStock("stock");
    }

    // AI 이미지 생성 (strategy === 'ai')
    // gpt-image-2는 base64로 반환하므로 genImage가 Buffer를 직접 준다(다운로드 단계 불필요).
    // 폴백 프롬프트도 게시판 성격에 맞춘다.
    // - ai-creation(창작마당): 창의·신비·비현실의 예술 이미지, 글자 없음.
    // - 그 외: 주제를 상징하는 세련되고 심플한 이미지, 정보 나열·글자 없음.
    const fallbackPrompt =
      board === "ai-creation"
        ? `A highly creative, surreal and dreamlike digital art piece inspired by "${keyword}". Imaginative, mysterious, artistic, bold colors, no text, no charts, no labels.`
        : `A refined, minimal and design-focused image symbolizing "${keyword}". Clean composition, tasteful, no cluttered diagrams, no text or labels.`;
    const prompt = aiPrompt ?? fallbackPrompt;
    const result = await genImage({ prompt, jobId, imageModel });
    if (!result) return failResult();

    const ext = result.mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const { url } = await uploadFn(
      { filename: `bot-image.${ext}`, mimetype: result.mimetype, data: result.data },
      "editor-images",
    );
    return { imageUrl: url, strategy, source: null, isMeme: false };
  } catch {
    return failResult();
  }
}
