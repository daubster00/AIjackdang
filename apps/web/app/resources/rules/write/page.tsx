/**
 * /resources/rules/write — Rules·설정 자료 등록 페이지
 *
 * 게시판별 고정 유형 등록: resourceType="rules-config" 고정 전달.
 * 유형 선택 UI는 ResourceWriteForm 내부에서 숨긴다.
 */

import type { Metadata } from "next";
import { BoardHero } from "@/components/board";
import { ResourceWriteGate } from "../../new/ResourceWriteGate";
import styles from "../../new/resource-new.module.css";

export const metadata: Metadata = {
  title: "Rules·설정 자료 등록 — AI작당",
  description: "Rules·설정 자료를 한 화면에서 작성해 등록하세요.",
};

export default function RulesWritePage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="resources" currentSub="자료 등록" />
      <div className={styles.layout}>
        <ResourceWriteGate fixedResourceType="rules-config" />
      </div>
    </main>
  );
}
