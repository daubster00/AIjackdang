"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Icon, Switch } from "@/components/ui";
import shell from "../settings.module.css";
import styles from "./notifications.module.css";

/** 알림 항목 정의 (key: 상태 키, title: 라벨, desc: 설명) */
const NOTIFICATION_ITEMS = [
  {
    key: "comment",
    title: "댓글 알림",
    desc: "내 글에 새 댓글이 달리면 알려드려요.",
  },
  {
    key: "like",
    title: "좋아요 알림",
    desc: "내 글이나 댓글이 좋아요를 받으면 알려드려요.",
  },
  {
    key: "accepted",
    title: "답변 채택 알림",
    desc: "내가 단 답변이 채택되면 알려드려요.",
  },
  {
    key: "message",
    title: "쪽지 알림",
    desc: "새 쪽지가 도착하면 알려드려요.",
  },
  {
    key: "marketing",
    title: "마케팅 정보 수신",
    desc: "이벤트·신규 기능 등 AI작당 소식을 받아볼게요.",
  },
] as const;

type NotificationKey = (typeof NOTIFICATION_ITEMS)[number]["key"];

/** 항목별 on/off 초기값 (목업: 마케팅만 off) */
const DEFAULT_STATE: Record<NotificationKey, boolean> = {
  comment: true,
  like: true,
  accepted: true,
  message: true,
  marketing: false,
};

export function NotificationsForm() {
  // 항목별 토글 상태
  const [prefs, setPrefs] = useState<Record<NotificationKey, boolean>>(DEFAULT_STATE);

  function toggle(key: NotificationKey) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 목업 단계: 실제 저장 API 가 붙기 전이라 안내만 한다.
    alert("저장 기능은 아직 개발 중입니다.");
  }

  return (
    <form className={shell.form} onSubmit={handleSubmit}>
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
                onChange={() => toggle(item.key)}
                aria-label={item.title}
                aria-describedby={descId}
              />
            </li>
          );
        })}
      </ul>

      <div className={shell.actions}>
        <Link href="/mypage">
          <Button type="button" variant="secondary">
            취소
          </Button>
        </Link>
        <Button type="submit" leftIcon={<Icon name="save-line" />}>
          저장
        </Button>
      </div>
    </form>
  );
}
