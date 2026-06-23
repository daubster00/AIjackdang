import type { Metadata } from "next";
import { BoardHero } from "@/components/board";
import styles from "@/components/board/PostWriteForm.module.css";
import { LoungeWriteClient } from "./LoungeWriteClient";

export const metadata: Metadata = {
  title: "글쓰기 | 작당 라운지 - AI작당",
  description: "작당 라운지에 새 글을 작성합니다.",
};

export default function LoungeWritePage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로 섹션: 작당 라운지 대메뉴 공통 히어로 */}
      <BoardHero menu="lounge" currentSub="AI 창작마당" />

      {/* Story 2.11: LoungeWriteClient가 PostWriteForm + CreativeSpecFields를 연결 */}
      <LoungeWriteClient />
    </main>
  );
}
