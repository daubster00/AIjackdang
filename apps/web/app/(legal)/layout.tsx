/**
 * (legal) Route Group 레이아웃
 *
 * 현재 세 법무 페이지(terms, privacy, operation-policy)는 이 Route Group
 * 바깥에 배치되어 있으므로(app/terms/, app/privacy/, app/operation-policy/),
 * 이 레이아웃은 _content 폴더와 함께 조직화 목적으로 존재한다.
 * 향후 법무 페이지들을 이 그룹 안으로 이동하면 공통 레이아웃이 자동 적용된다.
 */

import type { ReactNode } from "react";

export default function LegalGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
