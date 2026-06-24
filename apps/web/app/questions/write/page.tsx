/**
 * 질문 작성 페이지 — Story 3.3
 *
 * SSR 서버 컴포넌트:
 * - 비회원: middleware.ts 가 /login?redirectTo=/questions/write 로 이미 리다이렉트.
 *   클라이언트에서도 API 401 시 /login?redirectTo=/questions/write 처리.
 * - 회원: draft 조회 → QuestionWriteClient 에 initialDraft 주입.
 *
 * ⚠️ SSR 500 방지: process.env 상수는 constants.ts에서만 정의하고 import한다.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { BoardHero } from "@/components/board";
import styles from "@/components/board/PostWriteForm.module.css";
import { QuestionWriteClient } from "./QuestionWriteClient";
import { API_URL } from "./constants";
import type { DraftInitialValue } from "./QuestionWriteClient";

export const metadata: Metadata = {
  title: "질문하기 | 묻고답하기 - AI작당",
  description: "묻고답하기에 새 질문을 작성합니다.",
};

// ── 드래프트 조회 (서버 컴포넌트에서 SSR) ──────────────────────────────────────

async function fetchDraft(cookie?: string): Promise<DraftInitialValue | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/qna/questions/draft`, {
      headers: cookie ? { cookie } : {},
      cache: "no-store",
    });
    if (res.status === 204 || !res.ok) return null;
    const data = (await res.json()) as DraftInitialValue & { slug: string };
    return {
      id: data.id,
      title: data.title,
      contentJson: data.contentJson,
      tags: data.tags,
    };
  } catch {
    return null;
  }
}

export default async function QuestionWritePage() {
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? undefined;

  // 회원이면 기존 draft 복원
  const initialDraft = await fetchDraft(cookie);

  return (
    <main id="main" className={styles.page}>
      {/* 히어로 섹션: 묻고답하기 대메뉴 공통 히어로 */}
      <BoardHero menu="questions" currentSub="묻고답하기" />

      {/* 질문 작성 폼 — questions 전용 엔드포인트 사용 */}
      <QuestionWriteClient initialDraft={initialDraft} />
    </main>
  );
}
