/**
 * /inquiries 레이아웃 — Story 7.5
 *
 * - noindex: 로그인 전용 페이지이므로 검색엔진 색인 제외
 * - 인증 체크는 각 page.tsx 서버 컴포넌트에서 개별 처리
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function InquiriesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
