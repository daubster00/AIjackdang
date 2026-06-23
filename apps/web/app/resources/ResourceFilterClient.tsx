"use client";

/**
 * ResourceFilterClient — 실전자료 필터 클라이언트 컴포넌트 (Story 4.2)
 *
 * 4개 독립 페이지가 공유하는 필터 영역.
 * 필터 변경 시 URL 쿼리 갱신 → 서버 컴포넌트 SSR re-render.
 *
 * - 지원환경 칩: 다중 선택 (environment 배열)
 * - 난이도 Select: 단일 선택
 * - 정렬 Select: 단일 선택
 * - 검색: 텍스트 (q)
 * - 모바일(<768px): 필터 아코디언 접힘
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Select } from "@/components/ui/Select";

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "downloads", label: "다운로드순" },
  { value: "rating", label: "평점순" },
  { value: "popular", label: "인기순" },
];

const difficultyOptions = [
  { value: "", label: "난이도 전체" },
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
];

/** 지원환경 옵션 (자료실에서 공통으로 사용하는 환경 목록) */
const environmentOptions = [
  { value: "Claude Code", label: "Claude Code" },
  { value: "Cursor", label: "Cursor" },
  { value: "Claude.ai", label: "Claude.ai" },
  { value: "API", label: "API" },
  { value: "Windsurf", label: "Windsurf" },
  { value: "기타", label: "기타" },
];

export interface ResourceFilterClientProps {
  styles: {
    toolbar: string;
    typeFilter: string;
    typeChip: string;
    toolbarRight: string;
    sortGroup: string;
    filterAccordion?: string;
    filterAccordionSummary?: string;
    filterChips?: string;
    envChip?: string;
  };
  /** 검색 자동완성 인기 태그 */
  popularTags?: string[];
}

export function ResourceFilterClient({ styles }: ResourceFilterClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort") ?? "latest";
  const currentDifficulty = searchParams.get("difficulty") ?? "";
  const currentEnvs = searchParams.getAll("environment");

  /** URL 쿼리를 업데이트하는 헬퍼 */
  const updateQuery = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      // page를 항상 1로 리셋 (필터 변경 시)
      params.set("page", "1");

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          params.delete(key);
          for (const v of value) params.append(key, v);
        } else {
          params.set(key, value);
        }
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  /** 환경 칩 토글 */
  const toggleEnv = (env: string) => {
    const newEnvs = currentEnvs.includes(env)
      ? currentEnvs.filter((e) => e !== env)
      : [...currentEnvs, env];
    updateQuery({ environment: newEnvs.length > 0 ? newEnvs : null });
  };

  return (
    <>
      {/* ── 모바일 필터 아코디언 ── */}
      <details className={styles.filterAccordion ?? styles.typeFilter} style={{ width: "100%" }}>
        <summary
          className={styles.filterAccordionSummary ?? styles.typeChip}
          style={{ cursor: "pointer", listStyle: "none" }}
        >
          지원환경 필터
        </summary>
        <div
          className={styles.filterChips ?? styles.typeFilter}
          role="group"
          aria-label="지원환경 필터"
        >
          {environmentOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={styles.envChip ?? styles.typeChip}
              aria-pressed={currentEnvs.includes(opt.value)}
              onClick={() => toggleEnv(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </details>

      {/* ── 데스크탑: 환경 필터 칩 (인라인) ── */}
      <div
        className={styles.typeFilter}
        role="group"
        aria-label="지원환경 필터"
        style={{ display: "none" }}
        aria-hidden="true"
      >
        {environmentOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={styles.typeChip}
            aria-pressed={currentEnvs.includes(opt.value)}
            onClick={() => toggleEnv(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className={styles.toolbarRight}>
        <div className={styles.sortGroup}>
          <Select
            options={difficultyOptions}
            value={currentDifficulty}
            onChange={(v) => updateQuery({ difficulty: v })}
          />
        </div>
        <div className={styles.sortGroup}>
          <Select
            options={sortOptions}
            value={currentSort}
            onChange={(v) => updateQuery({ sort: v })}
          />
        </div>
      </div>
    </>
  );
}
