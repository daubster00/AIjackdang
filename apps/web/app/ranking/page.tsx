/**
 * /ranking 페이지 — Story 6.5
 *
 * SSR 서버 컴포넌트. 주간·월간 기여자 TOP 10 테이블.
 * 비회원 열람 가능 (인증 불필요). SEO 색인 허용(noindex 미적용).
 *
 * searchParams.period: 'weekly' | 'monthly' (기본 'weekly')
 * 탭 전환: URL 파라미터 기반 서버 렌더 (SEO 친화·URL 공유 가능)
 */

import type { Metadata } from "next";
import Link from "next/link";
import { RankBadge } from "@/components/ui/RankBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { rankTierFromGradeLevel } from "@/lib/ranks";
import styles from "./ranking.module.css";

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

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "기여자 랭킹 | AI작당",
    description:
      "AI작당 주간·월간 기여자 TOP 10 랭킹. 가장 활발하게 기여하는 회원을 확인하세요.",
    openGraph: {
      title: "기여자 랭킹 | AI작당",
      description: "AI작당 주간·월간 기여자 TOP 10 랭킹",
      type: "website",
    },
    // noindex 미적용: 검색 색인 허용 (AC#5)
  };
}

// ── 데이터 패칭 ───────────────────────────────────────────────────────────────

async function fetchRanking(period: "weekly" | "monthly"): Promise<RankingData | null> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003";
  const url = `${apiBase}/api/v1/gamification/ranking?period=${period}&limit=10`;

  try {
    const res = await fetch(url, {
      // Next.js 캐시: 60초마다 재검증 (Redis TTL 1h보다 짧게)
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as RankingData;
  } catch {
    return null;
  }
}

// ── 테이블 컴포넌트 ────────────────────────────────────────────────────────────

function RankingTable({
  data,
  period,
}: {
  data: RankingData | null;
  period: "weekly" | "monthly";
}) {
  const ariaLabel =
    period === "weekly" ? "주간 기여자 랭킹" : "월간 기여자 랭킹";

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon="trophy-line"
        title="아직 랭킹 데이터가 없습니다"
        description="이번 기간에 포인트를 적립한 회원이 아직 없습니다."
      />
    );
  }

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table} aria-label={ariaLabel}>
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">회원</th>
              <th scope="col">등급</th>
              <th scope="col">기여 포인트</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.userId}>
                <td
                  className={`${styles.rank} ${item.rank <= 3 ? styles.rankTop3 : ""}`}
                  aria-label={`${item.rank}위`}
                >
                  {item.rank}
                </td>
                <td className={styles.nicknameCell}>{item.nickname}</td>
                <td>
                  <div className={styles.gradeCell}>
                    <RankBadge
                      rank={rankTierFromGradeLevel(item.gradeLevel)}
                      size={22}
                      showLabel
                    />
                  </div>
                </td>
                <td className={styles.points}>
                  {item.totalDelta.toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.generatedAt}>
        기준 시각: {new Date(data.generatedAt).toLocaleString("ko-KR")}
      </p>
    </>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function RankingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period: "weekly" | "monthly" =
    params.period === "monthly" ? "monthly" : "weekly";

  // 주간·월간 병렬 패칭 (탭 전환 시 서버 재렌더)
  const [weeklyData, monthlyData] = await Promise.all([
    fetchRanking("weekly"),
    fetchRanking("monthly"),
  ]);

  const activeData = period === "weekly" ? weeklyData : monthlyData;

  return (
    <main id="main" className={styles.page}>
      <div className={styles.container}>
        {/* 헤더 */}
        <header className={styles.header}>
          <span className={styles.eyebrow}>Ranking</span>
          <h1 className={styles.title}>기여자 랭킹</h1>
          <p className={styles.description}>
            AI작당에서 가장 활발하게 기여한 회원을 주간·월간으로 확인하세요.
          </p>
        </header>

        {/* 탭 */}
        <nav aria-label="랭킹 기간 선택">
          <div className={styles.tabs}>
            <Link
              href="/ranking?period=weekly"
              className={`${styles.tab} ${period === "weekly" ? styles.tabActive : ""}`}
              aria-current={period === "weekly" ? "page" : undefined}
            >
              주간 랭킹
            </Link>
            <Link
              href="/ranking?period=monthly"
              className={`${styles.tab} ${period === "monthly" ? styles.tabActive : ""}`}
              aria-current={period === "monthly" ? "page" : undefined}
            >
              월간 랭킹
            </Link>
          </div>
        </nav>

        {/* 테이블 */}
        <RankingTable data={activeData} period={period} />
      </div>
    </main>
  );
}
