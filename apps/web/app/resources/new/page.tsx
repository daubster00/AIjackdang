/**
 * /resources/new — 자료 등록 페이지 (Story 4.4)
 *
 * 서버 컴포넌트 래퍼 + 클라이언트 게이팅(ResourceWriteGate).
 * 비회원은 로그인 유도 UI를 표시하며, 로그인 후 /resources/new로 복귀한다.
 */

import type { Metadata } from "next";
import { BoardHero } from "@/components/board";
import { ResourceWriteGate } from "./ResourceWriteGate";
import styles from "./resource-new.module.css";

export const metadata: Metadata = {
  title: "자료 등록 — AI작당",
  description: "실전 AI 자료를 한 화면에서 작성해 등록하세요.",
};

export default function ResourceNewPage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="resources" currentSub="자료 등록" />
      <div className={styles.layout}>
        <ResourceWriteGate />
      </div>
    </main>
  );
}
