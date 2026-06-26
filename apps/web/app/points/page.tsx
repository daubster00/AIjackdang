/**
 * /points 서버 컴포넌트.
 *
 * 메타데이터만 선언하고 실제 UI는 PointsClient(클라이언트 컴포넌트)에 위임한다.
 * 미들웨어에서 비로그인 시 /login?redirectTo=/points 로 리다이렉트한다.
 */

import type { Metadata } from "next";
import { PointsClient } from "./PointsClient";

export const metadata: Metadata = {
  title: "포인트 | AI작당",
  description:
    "내 누적 포인트와 적립·회수 내역을 확인하고 등급 안내를 살펴보세요.",
  robots: { index: false },
};

export default function PointsPage() {
  return <PointsClient />;
}
