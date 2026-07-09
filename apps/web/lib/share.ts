/**
 * SNS 공유 공용 모듈
 *
 * 게시판마다 복제된 ReactionBar(공유 드롭다운)들이 각자 window.open 링크를
 * 하드코딩하고 있었다. 카카오톡만 공식 방식(Kakao JS SDK)이 필요해 여기로 로직을 모은다.
 *
 * - 페이스북 / X(트위터) / 밴드: API 키 불필요. 공개 공유 URL 을 새 창으로 연다.
 * - 카카오톡: Kakao JS SDK(Kakao.Share.sendDefault)를 써야 정상 공유된다.
 *   NEXT_PUBLIC_KAKAO_JS_KEY(자바스크립트 키)가 있어야 하고,
 *   카카오 개발자 콘솔 플랫폼 Web 사이트 도메인 등록이 선행돼야 한다.
 * - 공유 카드에 들어갈 제목/설명/이미지는 페이지의 OG 메타태그(og:title 등)에서 읽는다.
 *   (buildPostMeta 가 모든 상세 페이지에 이미 심어둔 값 — 별도 prop 배선 불필요.)
 */

import { DEFAULT_OG_IMAGE } from "./seo/site-url";

// 클라이언트에 노출되는 카카오 자바스크립트 키 (로그인용 REST API 키와 별개).
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

// Kakao SDK 전역 타입 (SDK 는 런타임에 window.Kakao 로 주입됨).
type KakaoSdk = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share?: {
    sendDefault: (settings: Record<string, unknown>) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

/** 카카오 공유 사용 가능 여부(키 주입 여부). false 면 카카오 옵션은 링크복사로 폴백. */
export function isKakaoShareEnabled(): boolean {
  return Boolean(KAKAO_JS_KEY);
}

// SDK 스크립트를 중복 없이 한 번만 로드·초기화하기 위한 캐시.
let kakaoLoadPromise: Promise<boolean> | null = null;

/** Kakao JS SDK 를 필요 시점에 1회 로드하고 init 한다. 성공하면 true. */
function loadKakao(): Promise<boolean> {
  if (typeof window === "undefined" || !KAKAO_JS_KEY) return Promise.resolve(false);
  if (window.Kakao?.isInitialized?.()) return Promise.resolve(true);
  if (kakaoLoadPromise) return kakaoLoadPromise;

  kakaoLoadPromise = new Promise<boolean>((resolve) => {
    const finishInit = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(KAKAO_JS_KEY);
        }
        resolve(Boolean(window.Kakao?.isInitialized?.()));
      } catch {
        resolve(false);
      }
    };

    // 이미 다른 경로로 로드돼 있으면 init 만.
    if (window.Kakao) {
      finishInit();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    script.async = true;
    script.onload = finishInit;
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return kakaoLoadPromise;
}

/** 현재 페이지의 OG 메타태그에서 공유 카드용 제목·설명·이미지를 읽는다. */
function readPageShareMeta(url: string): {
  url: string;
  title: string;
  description: string;
  imageUrl: string;
} {
  const getMeta = (property: string): string | undefined =>
    document.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ??
    undefined;
  return {
    url,
    title: getMeta("og:title") || document.title || "AI작당",
    description: getMeta("og:description") || "",
    // og:image 는 buildPostMeta 가 항상 절대 URL 로 심는다. 없으면 기본 OG 이미지.
    imageUrl: getMeta("og:image") || DEFAULT_OG_IMAGE,
  };
}

/** 카카오톡으로 공유. 성공 true, (키 없음·도메인 미등록·취소 등) 실패 false. */
async function shareToKakao(meta: ReturnType<typeof readPageShareMeta>): Promise<boolean> {
  const ready = await loadKakao();
  if (!ready || !window.Kakao?.Share) return false;
  try {
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: meta.title,
        description: meta.description,
        imageUrl: meta.imageUrl,
        link: { mobileWebUrl: meta.url, webUrl: meta.url },
      },
      buttons: [
        {
          title: "자세히 보기",
          link: { mobileWebUrl: meta.url, webUrl: meta.url },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * SNS 공유를 실행한다(카카오/페북/X/밴드). 'copy' 는 컴포넌트에서 직접 처리한다.
 *
 * @returns 카카오가 실패해 링크 복사로 폴백했으면 true (호출부에서 토스트용).
 */
export async function openSocialShare(id: string, url: string): Promise<boolean> {
  if (id === "kakao") {
    const ok = await shareToKakao(readPageShareMeta(url));
    if (ok) return false;
    // 키 미설정·도메인 미등록 등으로 실패 → 링크 복사로 폴백.
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const shareUrls: Record<string, string> = {
    band: `https://band.us/plugin/share?body=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}`,
  };
  if (shareUrls[id]) {
    window.open(shareUrls[id], "_blank", "noopener,noreferrer,width=600,height=500");
  }
  return false;
}
