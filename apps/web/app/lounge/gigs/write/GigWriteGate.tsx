"use client";

// 비회원 게이팅 래퍼.
// useMockAuth로 로그인 여부를 판단해 폼 또는 로그인 유도 메시지를 렌더한다.
// hydration 불일치를 피하기 위해 ready 상태 확인 후 렌더.

import Link from "next/link";
import { Button, Icon } from "@/components/ui";
import { useMockAuth } from "@/hooks/useMockAuth";
import { RecruitForm } from "./RecruitForm";
import styles from "../gigs.module.css";

export function GigWriteGate() {
  const { user, ready } = useMockAuth();

  // hydration 전: 아무것도 렌더하지 않음 (깜빡임 방지)
  if (!ready) return null;

  // 비회원: 로그인 유도 UI
  if (!user) {
    return (
      <div className={styles.writeContainer}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-5)",
            padding: "80px var(--space-6)",
            textAlign: "center",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--color-primary-soft)",
              color: "var(--color-primary)",
              fontSize: 28,
            }}
            aria-hidden="true"
          >
            <Icon name="lock-line" />
          </span>
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <p style={{ fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-xl)" }}>
              로그인이 필요합니다
            </p>
            <p style={{ color: "var(--color-text-sub)", lineHeight: "var(--line-height-relaxed)" }}>
              의뢰·구직 글을 작성하려면 로그인하세요.
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <Link href="/login">
              <Button>로그인</Button>
            </Link>
            <Link href="/lounge/gigs">
              <Button variant="ghost">목록으로</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 회원: 폼 렌더
  return (
    <div className={styles.writeContainer}>
      <RecruitForm />
    </div>
  );
}
