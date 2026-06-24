"use client";

/**
 * RankingWidget — Story 6.5
 *
 * 메인 페이지 랭킹 위젯. 주간·월간 기여자 TOP 5 표시.
 * 클라이언트 컴포넌트: 탭 전환(주간/월간) 상태를 클라이언트에서 관리.
 *
 * API: GET /api/v1/gamification/ranking?period=weekly|monthly&limit=5
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { RankBadge } from "@/components/ui/RankBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { rankTierFromGradeLevel } from "@/lib/ranks";
import styles from "./RankingWidget.module.css";

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface RankItem {
  rank: number;
  userId: string;
  nickname: string;
  gradeLevel: number;
  gradeName: string;
  totalDelta: number;
}

interface RankingData {
  period: "weekly" | "monthly";
  items: RankItem[];
  generatedAt: string;
}

// ── gradeLevel → RankTier 매핑: lib/ranks 정식 함수 사용 (Story 6.6) ────────

// ── 위젯 컴포넌트 ─────────────────────────────────────────────────────────────

export function RankingWidget() {
  const [activePeriod, setActivePeriod] = useState<"weekly" | "monthly">("weekly");
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003";
    const url = `${apiBase}/api/v1/gamification/ranking?period=${activePeriod}&limit=5`;

    fetch(url)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<RankingData>;
      })
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [activePeriod]);

  return (
    <div className={styles.widget}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>기여자 랭킹</h3>
          <Link href="/ranking" className={styles.moreLink}>
            전체보기
          </Link>
        </div>
        {/* 탭 */}
        <div className={styles.tabs} role="tablist" aria-label="랭킹 기간 선택">
          <button
            role="tab"
            aria-selected={activePeriod === "weekly"}
            className={`${styles.tab} ${activePeriod === "weekly" ? styles.tabActive : ""}`}
            onClick={() => setActivePeriod("weekly")}
            type="button"
          >
            주간
          </button>
          <button
            role="tab"
            aria-selected={activePeriod === "monthly"}
            className={`${styles.tab} ${activePeriod === "monthly" ? styles.tabActive : ""}`}
            onClick={() => setActivePeriod("monthly")}
            type="button"
          >
            월간
          </button>
        </div>
      </div>

      {/* 목록 */}
      <div className={styles.list}>
        {loading && (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={styles.skeletonRow}>
                <Skeleton variant="short" width={24} height={20} />
                <Skeleton variant="line" width="60%" />
                <Skeleton variant="short" width={48} />
              </div>
            ))}
          </>
        )}

        {!loading && (!data || data.items.length === 0) && (
          <EmptyState
            icon="trophy-line"
            title="아직 랭킹 데이터가 없습니다"
          />
        )}

        {!loading && data && data.items.length > 0 && (
          <ol className={styles.rankList}>
            {data.items.map((item) => (
              <li key={item.userId} className={styles.rankItem}>
                <span
                  className={`${styles.rank} ${item.rank <= 3 ? styles.rankTop3 : ""}`}
                  aria-label={`${item.rank}위`}
                >
                  {item.rank}
                </span>
                <span className={styles.nickname}>{item.nickname}</span>
                <span className={styles.grade}>
                  <RankBadge
                    rank={rankTierFromGradeLevel(item.gradeLevel)}
                    size={20}
                  />
                </span>
                <span className={styles.points}>
                  {item.totalDelta.toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
