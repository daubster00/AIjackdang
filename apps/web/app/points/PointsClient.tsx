"use client";

/**
 * /points 페이지 클라이언트 컴포넌트.
 *
 * 탭1 "내 포인트": 현재 누적 포인트 + 등급 + 진행도 + 적립·회수 내역 목록 (페이지네이션).
 * 탭2 "등급 안내": 전체 등급 목록 카드 (현재 등급 하이라이트). lib/ranks + RankBadge 사용.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, Icon, Pagination, RankBadge } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { rankTierFromGradeLevel } from "@/lib/ranks";
import type {
  MeResponse,
  PointsHistoryResponse,
  GradesListResponse,
} from "@ai-jakdang/contracts";
import styles from "./points.module.css";

// ── 타입 ─────────────────────────────────────────────────────────────────────

type TabKey = "my-points" | "grade-guide";

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "my-points", label: "내 포인트", icon: "coin-line" },
  { key: "grade-guide", label: "등급 안내", icon: "award-line" },
];

const PAGE_SIZE = 20;

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function PointsClient() {
  const { user, ready } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("my-points");

  // ── /gamification/me: 현재 등급 + 포인트 요약 ──
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [meLoading, setMeLoading] = useState(false);

  // ── /gamification/grades: 등급 안내 목록 ──
  const [gradesData, setGradesData] = useState<GradesListResponse | null>(null);

  // ── /gamification/me/points-history: 적립·회수 내역 ──
  const [historyData, setHistoryData] = useState<PointsHistoryResponse | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  // me + grades 병렬 조회 (마운트 + 로그인 시)
  useEffect(() => {
    if (!user) return;
    setMeLoading(true);
    void Promise.all([
      fetch("/api/v1/gamification/me", { credentials: "include" }).then((r) =>
        r.ok ? (r.json() as Promise<MeResponse>) : null,
      ),
      fetch("/api/v1/gamification/grades", { credentials: "include" }).then(
        (r) => (r.ok ? (r.json() as Promise<GradesListResponse>) : null),
      ),
    ])
      .then(([me, grades]) => {
        if (me) setMeData(me);
        if (grades) setGradesData(grades);
      })
      .catch(() => {
        /* 실패 시 무시 */
      })
      .finally(() => setMeLoading(false));
  }, [user]);

  // 포인트 내역: 페이지 변경 시 재조회
  const fetchHistory = useCallback(
    (page: number) => {
      if (!user) return;
      setHistoryLoading(true);
      void fetch(
        `/api/v1/gamification/me/points-history?page=${page}&pageSize=${PAGE_SIZE}`,
        { credentials: "include" },
      )
        .then((r) => (r.ok ? (r.json() as Promise<PointsHistoryResponse>) : null))
        .then((data) => {
          if (data) setHistoryData(data);
        })
        .catch(() => {
          /* 실패 시 무시 */
        })
        .finally(() => setHistoryLoading(false));
    },
    [user],
  );

  useEffect(() => {
    fetchHistory(historyPage);
  }, [fetchHistory, historyPage]);

  // ── 등급 진행률 계산 ──
  const progressPct = useMemo(() => {
    if (!meData) return 0;
    if (meData.pointsToNext === null) return 100; // 최고 등급

    const currentGradeEntry = gradesData?.items.find(
      (g) => g.level === meData.grade.level,
    );
    if (currentGradeEntry) {
      // grades 데이터 로드 시: 현재 등급 내 정확한 진행률
      const pointsInGrade = meData.totalPoints - currentGradeEntry.minPoints;
      const totalForGrade = pointsInGrade + meData.pointsToNext;
      if (totalForGrade === 0) return 0;
      return Math.min(100, Math.round((pointsInGrade / totalForGrade) * 100));
    }
    // grades 미로드 시 폴백
    const total = meData.totalPoints + meData.pointsToNext;
    return total === 0 ? 0 : Math.min(100, Math.round((meData.totalPoints / total) * 100));
  }, [meData, gradesData]);

  // 하이드레이션 불일치 방지
  void ready;

  // ── 비로그인: 로그인 유도 ──
  if (!user) {
    return (
      <main id="main" className={styles.page}>
        <div className={styles.container}>
          <EmptyState
            icon="user-line"
            title="로그인이 필요합니다"
            description="포인트 내역을 보려면 로그인해 주세요."
            actions={
              <Link href="/login?redirectTo=/points" className={styles.loginBtn}>
                로그인하기
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const currentTier = meData ? rankTierFromGradeLevel(meData.grade.level) : null;

  return (
    <main id="main" className={styles.page}>
      <div className={styles.container}>
        {/* 헤더 */}
        <header className={styles.header}>
          <span className={styles.eyebrow}>Points</span>
          <h1 className={styles.title}>포인트</h1>
        </header>

        {/* 탭 */}
        <div className={styles.tabBar} role="tablist" aria-label="포인트 탭">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              className={styles.tab}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── 탭1: 내 포인트 ── */}
        <section
          role="tabpanel"
          id="panel-my-points"
          aria-labelledby="tab-my-points"
          hidden={activeTab !== "my-points"}
          className={styles.panel}
        >
          {/* 포인트 요약 카드 */}
          {meLoading ? (
            <div className={styles.summaryCard} aria-busy="true">
              <div className={styles.loadingPlaceholder} />
            </div>
          ) : meData ? (
            <div className={styles.summaryCard}>
              <div className={styles.summaryTop}>
                <div className={styles.pointsDisplay}>
                  <span className={styles.pointsNumber}>
                    {meData.totalPoints.toLocaleString("ko-KR")}
                  </span>
                  <span className={styles.pointsUnit}>P</span>
                </div>
                {currentTier && (
                  <RankBadge
                    rank={currentTier}
                    size={40}
                    showLabel
                    className={styles.summaryBadge}
                  />
                )}
              </div>

              {meData.nextGrade ? (
                <>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${meData.nextGrade.name}까지 진행률 ${progressPct}%`}
                  >
                    <span
                      className={styles.progressFill}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className={styles.progressText}>
                    다음 등급{" "}
                    <strong>{meData.nextGrade.name}</strong>까지{" "}
                    <strong>
                      {(meData.pointsToNext ?? 0).toLocaleString("ko-KR")} P
                    </strong>{" "}
                    남았어요
                  </p>
                </>
              ) : (
                <p className={styles.progressText}>최고 등급 달성 🎉</p>
              )}
            </div>
          ) : null}

          {/* 적립·회수 내역 */}
          <div className={styles.historySection}>
            <h2 className={styles.sectionTitle}>적립·회수 내역</h2>
            {historyLoading ? (
              <div className={styles.loading} aria-busy="true">
                <Icon name="loader-4-line" />
                <p>내역을 불러오는 중...</p>
              </div>
            ) : !historyData || historyData.items.length === 0 ? (
              <EmptyState
                icon="coin-line"
                title="아직 적립 내역이 없어요"
                description="커뮤니티에 참여하면 포인트가 적립됩니다."
              />
            ) : (
              <>
                <ul className={styles.historyList} aria-label="포인트 적립·회수 내역">
                  {historyData.items.map((item) => (
                    <li key={item.id} className={styles.historyItem}>
                      <div className={styles.historyReason}>
                        <span className={styles.historyLabel}>{item.reasonLabel}</span>
                        <span className={styles.historyDate}>{formatDate(item.createdAt)}</span>
                      </div>
                      <span
                        className={
                          item.delta >= 0 ? styles.deltaPositive : styles.deltaNegative
                        }
                      >
                        {item.delta >= 0
                          ? `+${item.delta.toLocaleString("ko-KR")}`
                          : item.delta.toLocaleString("ko-KR")}{" "}
                        P
                      </span>
                    </li>
                  ))}
                </ul>
                {historyData.meta.totalPages > 1 && (
                  <Pagination
                    page={historyData.meta.page}
                    totalPages={historyData.meta.totalPages}
                    onPageChange={(p) => {
                      setHistoryPage(p);
                    }}
                    className={styles.pagination}
                  />
                )}
              </>
            )}
          </div>
        </section>

        {/* ── 탭2: 등급 안내 ── */}
        <section
          role="tabpanel"
          id="panel-grade-guide"
          aria-labelledby="tab-grade-guide"
          hidden={activeTab !== "grade-guide"}
          className={styles.panel}
        >
          <h2 className={styles.sectionTitle}>등급 안내</h2>
          <p className={styles.sectionDesc}>
            포인트를 쌓으면 자동으로 등급이 올라갑니다.
          </p>
          {!gradesData ? (
            <div className={styles.loading} aria-busy="true">
              <Icon name="loader-4-line" />
              <p>등급 정보를 불러오는 중...</p>
            </div>
          ) : (
            <ul className={styles.gradeList} aria-label="전체 등급 목록">
              {gradesData.items.map((grade) => {
                const tier = rankTierFromGradeLevel(grade.level);
                const isCurrent = meData?.grade.level === grade.level;
                return (
                  <li
                    key={grade.level}
                    className={`${styles.gradeCard} ${isCurrent ? styles.gradeCardCurrent : ""}`}
                    aria-current={isCurrent ? "true" : undefined}
                  >
                    {isCurrent && (
                      <span className={styles.currentBadge} aria-label="현재 내 등급">
                        현재 등급
                      </span>
                    )}
                    <div className={styles.gradeCardLeft}>
                      {/* RankBadge: lib/ranks + rankTierFromGradeLevel 정식 함수 사용 */}
                      <RankBadge rank={tier} size={48} />
                      <div className={styles.gradeInfo}>
                        <strong className={styles.gradeName}>{grade.name}</strong>
                        <span className={styles.gradeRange}>
                          {grade.maxPoints !== null
                            ? `${grade.minPoints.toLocaleString("ko-KR")} ~ ${grade.maxPoints.toLocaleString("ko-KR")} P`
                            : `${grade.minPoints.toLocaleString("ko-KR")} P 이상`}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
