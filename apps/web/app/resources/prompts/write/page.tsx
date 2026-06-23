import type { Metadata } from "next";
import { BoardHero } from "@/components/board";
import { ResourceWriteForm } from "./ResourceWriteForm";
import styles from "./resource-write.module.css";

export const metadata: Metadata = {
  title: "자료 등록 | 프롬프트 - AI작당",
  description: "프롬프트 자료실에 새 자료를 등록합니다.",
};

export default function PromptsWritePage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로 섹션: 실전자료 대메뉴 공통 히어로 */}
      <BoardHero menu="resources" currentSub="프롬프트" />

      <div className={styles.layout}>
        <ResourceWriteForm />
      </div>
    </main>
  );
}
