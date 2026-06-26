"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import shell from "../settings.module.css";
import styles from "./notifications.module.css";

/** 알림 도메인 이벤트 키 타입 */
type NotificationKey =
  | "comment.created"
  | "answer.created"
  | "comment.replied"
  | "reaction.received"
  | "helpful_answer.marked"
  | "message.received"
  | "sanction.applied";

/** 알림 항목 정의 (7종) */
const NOTIFICATION_ITEMS: {
  key: NotificationKey;
  title: string;
  desc: string;
  disabled?: true;
}[] = [
  {
    key: "comment.created",
    title: "댓글 알림",
    desc: "내 글에 새 댓글이 달리면 알려드려요.",
  },
  {
    key: "answer.created",
    title: "답변 알림",
    desc: "내 질문에 새 답변이 달리면 알려드려요.",
  },
  {
    key: "comment.replied",
    title: "대댓글 알림",
    desc: "내 댓글에 답글이 달리면 알려드려요.",
  },
  {
    key: "reaction.received",
    title: "좋아요 알림",
    desc: "내 글이나 댓글이 좋아요를 받으면 알려드려요.",
  },
  {
    key: "helpful_answer.marked",
    title: "도움된 답변 알림",
    desc: "내 답변이 도움된 답변으로 표시되면 알려드려요.",
  },
  {
    key: "message.received",
    title: "쪽지 알림",
    desc: "새 쪽지가 도착하면 알려드려요.",
  },
  {
    key: "sanction.applied",
    title: "제재 알림",
    desc: "항상 수신됩니다. 운영 정책에 따른 필수 알림입니다.",
    disabled: true,
  },
];

/** 기본값 — API 로드 전 초기 상태 (sanction.applied 항상 true) */
const DEFAULT_PREFS: Record<NotificationKey, boolean> = {
  "comment.created": true,
  "answer.created": true,
  "comment.replied": true,
  "reaction.received": true,
  "helpful_answer.marked": true,
  "message.received": true,
  "sanction.applied": true,
};

export function NotificationsForm() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<NotificationKey, boolean>>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  // 마운트 시 GET /api/v1/notifications/settings 호출 → prefs 초기화
  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const res = await fetch("/api/v1/notifications/settings", {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { settings: Record<string, boolean> };
          if (!cancelled) {
            const loaded: Record<NotificationKey, boolean> = { ...DEFAULT_PREFS };
            for (const key of Object.keys(DEFAULT_PREFS) as NotificationKey[]) {
              if (typeof data.settings[key] === "boolean") {
                loaded[key] = data.settings[key];
              }
            }
            // sanction.applied는 항상 true
            loaded["sanction.applied"] = true;
            setPrefs(loaded);
          }
        }
      } catch {
        // 로드 실패 시 기본값 유지
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSettings();
    return () => { cancelled = true; };
  }, []);

  /** 토글 변경 핸들러 — 낙관적 업데이트 + 실패 시 롤백 */
  async function toggle(key: NotificationKey) {
    // sanction.applied는 변경 불가
    if (key === "sanction.applied") return;

    const prev = prefs;
    const nextValue = !prev[key];

    // ① 낙관적 state 업데이트
    setPrefs((p) => ({ ...p, [key]: nextValue }));

    // ② PATCH 즉시 전송
    try {
      const res = await fetch("/api/v1/notifications/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: nextValue }),
      });
      if (!res.ok) throw new Error("API 오류");
    } catch {
      // ③ 실패 시 이전 state 롤백 + danger 토스트
      setPrefs(prev);
      toast({ tone: "danger", title: "저장에 실패했습니다. 다시 시도해 주세요." });
    }
  }

  return (
    <div className={shell.form}>
      <ul className={styles.list}>
        {NOTIFICATION_ITEMS.map((item) => {
          const descId = `notif-${item.key}-desc`;
          return (
            <li key={item.key} className={styles.item}>
              <div className={styles.itemText}>
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.itemDesc} id={descId}>
                  {item.desc}
                </span>
              </div>
              <Switch
                checked={prefs[item.key]}
                onChange={() => void toggle(item.key)}
                aria-label={item.title}
                aria-describedby={descId}
                disabled={loading || item.disabled === true}
              />
            </li>
          );
        })}
      </ul>

      <div className={shell.actions}>
        <Link href="/mypage" className={shell.back}>
          <Icon name="arrow-left-s-line" />
          마이페이지로
        </Link>
      </div>
    </div>
  );
}
