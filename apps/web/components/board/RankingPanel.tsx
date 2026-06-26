"use client";

import { useEffect, useState } from "react";
import { AuthorName } from "@/components/ui";
import { Icon } from "@/components/ui";
import styles from "./BoardSidebar.module.css";

type RankingItem = {
  rank: number;
  userId: string;
  nickname: string;
  gradeLevel: number;
  gradeName: string;
  totalDelta: number;
};

type RankingResponse = {
  period: "weekly" | "monthly";
  items: RankingItem[];
  generatedAt: string;
};

/**
 * 작당 랭킹 패널 — 실 API에서 주간 TOP 10 랭킹을 가져와 렌더한다.
 * 각 닉네임은 AuthorName 컴포넌트로 렌더하여 클릭 시 팔로우/쪽지/계정 바로가기 메뉴가 열린다.
 */
export function RankingPanel() {
  const [items, setItems] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/v1/gamification/ranking?period=weekly&limit=10", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`ranking fetch failed: ${res.status}`);
        return res.json() as Promise<RankingResponse>;
      })
      .then((data) => {
        setItems(data.items);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className={styles.sidePanel}>
      <div className={styles.sideHeader}>
        <Icon name="award-line" />
        <h2>작당 랭킹</h2>
      </div>
      {loading ? (
        <p className={styles.recentEmpty}>불러오는 중…</p>
      ) : error ? (
        <p className={styles.recentEmpty}>랭킹을 불러올 수 없습니다.</p>
      ) : items.length === 0 ? (
        <p className={styles.recentEmpty}>아직 랭킹 데이터가 없습니다.</p>
      ) : (
        <ol className={styles.rankingRealList}>
          {items.map((item) => (
            <li key={item.userId}>
              <span className={styles.rankNumber}>{item.rank}</span>
              {/* AuthorName이 닉네임 + 등급 뱃지를 함께 렌더하고, 클릭 시 팔로우/쪽지/계정 메뉴를 띄운다 */}
              <AuthorName
                name={item.nickname}
                authorId={item.userId}
                gradeLevel={item.gradeLevel}
                badgeSize={22}
                className={styles.rankAuthorName}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
