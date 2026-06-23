// 작당 의뢰소 글쓰기 페이지 (서버 컴포넌트 래퍼).
// 실제 폼 로직은 "use client" 인 RecruitForm에 위임한다.
// 비회원 게이팅: RecruitForm 내부에서 useMockAuth를 쓸 수도 있지만,
// 이 페이지에서는 GigWriteGate(client) 컴포넌트로 처리.

import type { Metadata } from "next";
import { BoardHero } from "@/components/board";
import { GigWriteGate } from "./GigWriteGate";
import styles from "../gigs.module.css";

export const metadata: Metadata = {
  title: "의뢰·구직 글쓰기 | 작당 의뢰소 - AI작당",
  description: "AI작당 작당 의뢰소에 의뢰 또는 구직 글을 작성합니다.",
};

export default function GigsWritePage() {
  return (
    <main id="main" className={styles.writePage}>
      {/* 히어로: 작당 라운지 대메뉴 공통 히어로 */}
      <BoardHero menu="lounge" currentSub="작당 의뢰소" />

      {/* 비회원 게이팅 래퍼: 로그인 상태면 폼 렌더, 아니면 로그인 유도 */}
      <GigWriteGate />
    </main>
  );
}
