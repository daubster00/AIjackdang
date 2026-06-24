"use client";

import { useEffect, useState } from "react";

/**
 * 공개 광고 슬롯 컴포넌트 (Story 9.16).
 *
 * placement(노출 위치 코드)를 prop으로 받아 GET /api/v1/ads/:placement 조회 →
 * isActive=true 인 활성 광고를 렌더한다.
 * 없으면 null을 렌더(비노출).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003";

interface AdData {
  id: string;
  code: string | null;
  imageUrl: string | null;
  clickUrl: string | null;
  adType: string;
  device: string;
}

interface AdSlotProps {
  /** DB에 저장된 placement 코드 (예: "main_top", "sidebar") */
  placement: string;
  /** 추가 CSS 클래스 */
  className?: string;
}

export function AdSlot({ placement, className }: AdSlotProps) {
  const [ad, setAd] = useState<AdData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/ads/${encodeURIComponent(placement)}`)
      .then(async (res) => {
        if (res.status === 204 || !res.ok) return null;
        return (await res.json()) as AdData;
      })
      .then((data) => {
        if (!cancelled) {
          setAd(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [placement]);

  // 로드 전 또는 광고 없음 → 아무것도 렌더하지 않음
  if (!loaded || !ad) return null;

  // HTML 코드 광고 (애드센스 등 스크립트 기반)
  if (ad.code) {
    return (
      <div
        className={className}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: ad.code }}
        data-ad-placement={placement}
        data-ad-id={ad.id}
        aria-label="광고"
      />
    );
  }

  // 이미지 배너 광고
  if (ad.imageUrl) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ad.imageUrl}
        alt="광고"
        style={{ display: "block", maxWidth: "100%" }}
      />
    );

    if (ad.clickUrl) {
      return (
        <div className={className} data-ad-placement={placement} data-ad-id={ad.id}>
          <a href={ad.clickUrl} target="_blank" rel="noopener noreferrer sponsored nofollow">
            {img}
          </a>
        </div>
      );
    }

    return (
      <div className={className} data-ad-placement={placement} data-ad-id={ad.id}>
        {img}
      </div>
    );
  }

  // clickUrl만 있는 텍스트 광고
  if (ad.clickUrl) {
    return (
      <div className={className} data-ad-placement={placement} data-ad-id={ad.id}>
        <a href={ad.clickUrl} target="_blank" rel="noopener noreferrer sponsored nofollow">
          광고
        </a>
      </div>
    );
  }

  return null;
}
