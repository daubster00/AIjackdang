"use client";

// Story 2.12: 작당 의뢰소 필터 클라이언트 컴포넌트.
// URL 쿼리 파라미터 기반 필터 — useRouter + searchParams 로 구현.
// postKind(유형), fields(분야), recruitStatus(상태) 쿼리 파라미터 업데이트.

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SearchInput } from "@/components/ui";
import { GIG_FIELDS } from "./page";
import styles from "./gigs.module.css";

const TYPE_OPTIONS = [
  { value: "", label: "유형 전체" },
  { value: "request", label: "의뢰" },
  { value: "offer", label: "구직" },
];

const FIELD_OPTIONS = [
  { value: "", label: "분야 전체" },
  ...GIG_FIELDS.map((f) => ({ value: f, label: f })),
];

const STATUS_OPTIONS = [
  { value: "", label: "상태 전체" },
  { value: "open", label: "모집중" },
  { value: "closed", label: "마감" },
];

export function GigsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // 필터 변경 시 1페이지로 리셋
    params.delete("page");
    router.push(`/lounge/gigs?${params.toString()}`);
  }

  return (
    <section className={styles.filterToolbar} aria-label="의뢰 목록 필터 및 검색">
      <div className={styles.filterSelects}>
        {/* 글유형 셀렉트 */}
        <div className={styles.selectField}>
          <Select
            label="유형"
            options={TYPE_OPTIONS}
            value={searchParams.get("postKind") ?? ""}
            onChange={(v) => updateParam("postKind", v)}
          />
        </div>

        {/* 분야 셀렉트 */}
        <div className={`${styles.selectField} ${styles.selectFieldWide}`}>
          <Select
            label="분야"
            options={FIELD_OPTIONS}
            value={searchParams.get("fields") ?? ""}
            onChange={(v) => updateParam("fields", v)}
          />
        </div>

        {/* 모집상태 셀렉트 */}
        <div className={styles.selectField}>
          <Select
            label="상태"
            options={STATUS_OPTIONS}
            value={searchParams.get("recruitStatus") ?? ""}
            onChange={(v) => updateParam("recruitStatus", v)}
          />
        </div>
      </div>

      {/* 검색창 — q 쿼리 파라미터 */}
      <div className={styles.filterSearch}>
        <SearchInput
          placeholder="제목·내용 검색"
          buttonLabel="검색"
          defaultValue={searchParams.get("q") ?? ""}
          onSearch={(v) => updateParam("q", v)}
        />
      </div>
    </section>
  );
}
