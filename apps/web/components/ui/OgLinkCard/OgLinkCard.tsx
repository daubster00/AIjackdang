"use client";

/**
 * OgLinkCard — OG 링크 미리보기 카드 — Story 8.6
 *
 * 게시글 본문의 외부 링크를 시각적으로 표시한다.
 * - onError 핸들러 때문에 "use client" 필요
 * - 이미지 로드 실패 시 파비콘 → 기본 플레이스홀더로 폴백
 * - 접근성: img alt, rel="noopener noreferrer"
 */

import { useState } from "react";
import styles from "./OgLinkCard.module.css";

interface OgLinkCardProps {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getFaviconUrl(url: string): string {
  try {
    const { protocol, hostname } = new URL(url);
    return `${protocol}//${hostname}/favicon.ico`;
  } catch {
    return "";
  }
}

export function OgLinkCard({ url, title, description, imageUrl, siteName }: OgLinkCardProps) {
  const domain = getDomain(url);
  const faviconUrl = getFaviconUrl(url);

  const [imgSrc, setImgSrc] = useState<string | null>(imageUrl);
  const [imgFailed, setImgFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  function handleImgError() {
    if (!imgFailed && faviconUrl) {
      setImgSrc(faviconUrl);
      setImgFailed(true);
    } else {
      setImgSrc(null);
      setFaviconFailed(true);
    }
  }

  const altText = title ? `${title} 링크 미리보기` : "링크 미리보기";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      aria-label={altText}
    >
      <div className={styles.content}>
        <p className={styles.domain}>{siteName ?? domain}</p>
        {title && <p className={styles.title}>{title}</p>}
        {description && <p className={styles.description}>{description}</p>}
        <p className={styles.url}>{domain}</p>
      </div>
      <div className={styles.imageWrapper}>
        {imgSrc && !faviconFailed ? (
          <img
            src={imgSrc}
            alt={altText}
            className={imgFailed ? styles.favicon : styles.thumbnail}
            onError={handleImgError}
          />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
    </a>
  );
}
