"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import type { RecentViewedItem } from "./RecentViewedTracker";
import styles from "./BoardSidebar.module.css";

const STORAGE_KEY = "aijakdang.recentViewed";

/**
 * localStorage에 기록된 최근 본 글 목록을 렌더하는 클라이언트 컴포넌트.
 * BoardSidebar 내 "최근 본 글" 섹션을 대체한다.
 *
 * hydration mismatch 방지: mounted 상태가 true 이후에만 실제 목록을 렌더.
 * 비어 있으면 "아직 본 글이 없어요." 안내 문구를 표시한다.
 */
export function RecentViewedPanel() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<RecentViewedItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: RecentViewedItem[] = raw ? (JSON.parse(raw) as RecentViewedItem[]) : [];
      setItems(parsed.slice(0, 5));
    } catch {
      setItems([]);
    }
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <section className={styles.sidePanel}>
      <div className={styles.sideHeader}>
        <Icon name="history-line" />
        <h2>최근 본 글</h2>
      </div>
      {items.length === 0 ? (
        <p className={styles.recentEmpty}>아직 본 글이 없어요.</p>
      ) : (
        <ul className={styles.recentList}>
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={styles.recentItem}>
                <span className={styles.recentTag}>{item.board}</span>
                <span className={styles.recentTitle}>{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
