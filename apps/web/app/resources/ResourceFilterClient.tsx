"use client";

/**
 * ResourceFilterClient — 실전자료 필터 클라이언트 컴포넌트 (Story 4.2)
 *
 * 4개 독립 페이지가 공유하는 필터 영역.
 * 필터 변경 시 URL 쿼리 갱신 → 서버 컴포넌트 SSR re-render.
 *
 * - 검색창: 텍스트 (q) — Enter 또는 검색 버튼
 * - 지원환경 Select: 단일 선택 (environment)
 * - 정렬 Select: 단일 선택 (sort)
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Select } from "@/components/ui/Select";
import { SearchInput } from "@/components/ui/SearchInput";
import localStyles from "./ResourceFilterClient.module.css";

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "downloads", label: "다운로드순" },
  { value: "rating", label: "평점순" },
  { value: "popular", label: "인기순" },
];

/** 지원환경 옵션 — 상단에 "지원환경 전체" 포함, 단일 선택 */
const environmentOptions = [
  { value: "", label: "지원환경 전체" },
  { value: "Claude Code", label: "Claude Code" },
  { value: "Cursor", label: "Cursor" },
  { value: "Claude.ai", label: "Claude.ai" },
  { value: "API", label: "API" },
  { value: "Windsurf", label: "Windsurf" },
  { value: "기타", label: "기타" },
];

export interface ResourceFilterClientProps {
  styles: {
    toolbarRight: string;
    sortGroup: string;
    /** 하위 호환 유지용 (더 이상 컴포넌트 내부에서 사용하지 않음) */
    toolbar?: string;
    typeFilter?: string;
    typeChip?: string;
  };
  /** 검색 자동완성 인기 태그 (향후 확장용) */
  popularTags?: string[];
}

export function ResourceFilterClient({ styles }: ResourceFilterClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort") ?? "latest";
  const currentEnv = searchParams.get("environment") ?? "";
  const currentQ = searchParams.get("q") ?? "";

  /** URL 쿼리를 업데이트하는 헬퍼 */
  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      // 필터 변경 시 page 항상 1로 리셋
      params.set("page", "1");

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <>
      {/* ── 검색창 ── */}
      {/* key={currentQ}: URL의 q 파라미터가 바뀔 때마다 내부 상태를 최신값으로 리셋 */}
      <div className={localStyles.searchWrapper}>
        <SearchInput
          key={currentQ}
          defaultValue={currentQ}
          placeholder="자료 검색"
          onSearch={(value) => updateQuery({ q: value || null })}
        />
      </div>

      {/* ── 지원환경 Select + 정렬 Select ── */}
      <div className={styles.toolbarRight}>
        <div className={localStyles.sortGroup}>
          <Select
            options={environmentOptions}
            value={currentEnv}
            onChange={(v) => updateQuery({ environment: v || null })}
          />
        </div>
        <div className={localStyles.sortGroup}>
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
