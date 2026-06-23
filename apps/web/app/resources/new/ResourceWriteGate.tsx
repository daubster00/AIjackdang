"use client";

/**
 * ResourceWriteGate — 비회원 게이팅 래퍼 (Story 4.4, AC #1)
 *
 * - useMockAuth로 로그인 여부를 확인한다.
 * - 비회원: /login?redirectTo=/resources/new 로 이동 유도 UI 표시.
 * - 회원: ResourceWriteForm(7-Step 폼) 렌더.
 * - hydration 불일치 방지: ready 상태 확인 후 렌더.
 */

import Link from "next/link";
import { Button, Icon } from "@/components/ui";
import { useMockAuth } from "@/hooks/useMockAuth";
import { ResourceWriteForm } from "./ResourceWriteForm";
import styles from "./resource-new.module.css";

const REDIRECT_PATH = "/resources/new";

export function ResourceWriteGate() {
  const { user, ready } = useMockAuth();

  // hydration 전: 아무것도 렌더하지 않음 (깜빡임 방지)
  if (!ready) return null;

  // 비회원: 로그인 유도 UI
  if (!user) {
    return (
      <div className={styles.gateWrap}>
        <span className={styles.gateIcon} aria-hidden="true">
          <Icon name="lock-line" />
        </span>
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <p className={styles.gateTitle}>로그인이 필요합니다</p>
          <p className={styles.gateDesc}>자료를 등록하려면 로그인하세요.</p>
        </div>
        <div className={styles.gateBtns}>
          <Link href={`/login?redirectTo=${encodeURIComponent(REDIRECT_PATH)}`}>
            <Button>로그인</Button>
          </Link>
          <Link href="/resources/prompts">
            <Button variant="ghost">자료실 보기</Button>
          </Link>
        </div>
      </div>
    );
  }

  // 회원: 7-Step 등록 폼 렌더
  return <ResourceWriteForm />;
}
