import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * 마이페이지 레이아웃.
 * page.tsx가 "use client"이므로 메타데이터는 여기서 처리한다.
 */
export const metadata: Metadata = {
  title: "마이페이지 | AI작당",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MyPageLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
