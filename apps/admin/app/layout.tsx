import type { Metadata } from "next";
import type { ReactNode } from "react";
// 관리자 전용 디자인 시스템 (재사용 가능한 패키지) — 사용자 사이트 CSS 는 import 하지 않는다
import "@ai-jakdang/admin-design-system/css";
import "remixicon/fonts/remixicon.css";
// 관리자 앱 전용 추가/덮어쓰기 (디자인 시스템 이후에 로드되어야 우선 적용된다)
import "../styles/index.css";
import { DialogHost } from "@/lib/dialog";

export const metadata: Metadata = {
  title: "AI작당 관리자",
  description: "AI작당 운영 관리자",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    // translate="no": 페이지 번역 확장(Google 번역 등)이 한국어 텍스트 노드를 <font>로
    // 바꿔치기하면 React 재렌더 시 removeChild 충돌(런타임 NotFoundError)이 발생한다.
    // 관리자(운영자 전용) 화면은 자동 번역 대상에서 제외해 이 크래시를 원천 차단한다.
    <html lang="ko" translate="no">
      <body className="notranslate">
        {children}
        <DialogHost />
      </body>
    </html>
  );
}
