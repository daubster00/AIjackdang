/**
 * /messages 레이아웃 — Story 7.4
 *
 * /messages 및 /messages/[userId] 공용 레이아웃.
 * 인증 체크는 각 page.tsx 서버 컴포넌트에서 개별 수행한다.
 */

import type { ReactNode } from "react";

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
