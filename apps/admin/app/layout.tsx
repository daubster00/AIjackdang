import type { Metadata } from "next";
import type { ReactNode } from "react";
// 관리자 전용 디자인 시스템 (재사용 가능한 패키지) — 사용자 사이트 CSS 는 import 하지 않는다
import "@ai-jakdang/admin-design-system/css";
import "remixicon/fonts/remixicon.css";
// 관리자 앱 전용 추가/덮어쓰기 (디자인 시스템 이후에 로드되어야 우선 적용된다)
import "../styles/index.css";

export const metadata: Metadata = {
  title: "AI작당 관리자",
  description: "AI작당 운영 관리자",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
