"use client";

/**
 * 접속 통계 기간 필터 컴포넌트 (Story 9.5 AC#3, AC#5).
 *
 * 세그먼트(오늘/어제/7일/30일/이번달/지난달/사용자지정) + 날짜 입력.
 * 선택 시 URL searchParams를 업데이트하여 서버 컴포넌트를 재실행한다.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

interface StatsDateFilterProps {
  currentRange: string;
  currentFrom: string;
  currentTo: string;
}

const SEGMENTS = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "7days", label: "최근 7일" },
  { key: "30days", label: "최근 30일" },
  { key: "thismonth", label: "이번달" },
  { key: "lastmonth", label: "지난달" },
  { key: "custom", label: "사용자지정" },
] as const;

export function StatsDateFilter({
  currentRange,
  currentFrom,
  currentTo,
}: StatsDateFilterProps) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo);
  const showCustom = currentRange === "custom";

  function handleSegment(key: string) {
    if (key === "custom") {
      router.push(`/stats?range=custom&from=${customFrom}&to=${customTo}`);
    } else {
      router.push(`/stats?range=${key}`);
    }
  }

  function handleSearch() {
    router.push(`/stats?range=custom&from=${customFrom}&to=${customTo}`);
  }

  return (
    <article className="card" style={{ marginBottom: 16 }}>
      <div className="card-body">
        <div className="filter-row">
          <div className="segmented" role="tablist" aria-label="통계 기간">
            {SEGMENTS.map((seg) => (
              <button
                key={seg.key}
                className={`segment${currentRange === seg.key ? " active" : ""}`}
                role="tab"
                aria-selected={currentRange === seg.key}
                onClick={() => handleSegment(seg.key)}
                type="button"
              >
                {seg.label}
              </button>
            ))}
          </div>
          {showCustom && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input
                  className="control"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="시작 날짜"
                  max={customTo}
                />
              </div>
              <span style={{ color: "var(--gray-400)" }}>~</span>
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input
                  className="control"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="종료 날짜"
                  min={customFrom}
                />
              </div>
              <div className="filter-actions">
                <button className="btn btn-primary" onClick={handleSearch} type="button">
                  <i className="ri-search-line" />
                  조회
                </button>
              </div>
            </div>
          )}
          {!showCustom && (
            <div style={{ color: "var(--gray-500)", fontSize: "13px", display: "flex", alignItems: "center" }}>
              <i className="ri-calendar-line" style={{ marginRight: 4 }} />
              {currentFrom} ~ {currentTo}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
