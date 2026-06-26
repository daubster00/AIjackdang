"use client";

import { useState, useEffect, useCallback } from "react";
import { downloadCsv } from "../../lib/csv";
import type { AnalyticsOverviewItem, KeywordItem } from "@ai-jakdang/contracts";

// ── 인라인 토스트 (3초 자동 닫힘) ────────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 99999,
        background:
          type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff",
        borderRadius: 8,
        padding: "12px 20px",
        fontSize: 14,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <i className={type === "success" ? "ri-check-line" : "ri-error-warning-line"} />
      {message}
    </div>
  );
}

// ── 상단 버튼 2개: "CSV 다운로드" + "리포트 내보내기" ─────────────────────────

interface TopButtonsProps {
  overviewItems: AnalyticsOverviewItem[];
  from: string;
  to: string;
}

/**
 * 접속통계 페이지 상단 내보내기 버튼 2개 (클라이언트 컴포넌트).
 *
 * - "CSV 다운로드" → overview 항목(날짜·신규가입자·신규게시글·다운로드)을 CSV로 저장.
 *   파일명: stats-overview-{from}-{to}.csv
 *
 * - "리포트 내보내기" → 동일한 overview 데이터를 stats-report-{from}-{to}.csv 로 저장.
 *   PDF/통합 리포트 백엔드가 없으므로 CSV로 정직하게 제공하고 토스트로 안내.
 */
export function StatsTopExportButtons({ overviewItems, from, to }: TopButtonsProps) {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => setToast({ message, type }),
    [],
  );

  function buildOverviewRows() {
    return overviewItems.map((r) => ({
      날짜: r.date,
      신규가입자: r.newUsers,
      신규게시글: r.newPosts,
      다운로드: r.downloads,
    }));
  }

  function handleCsvDownload() {
    if (overviewItems.length === 0) {
      showToast("다운로드할 데이터가 없습니다.", "error");
      return;
    }
    downloadCsv(`stats-overview-${from}-${to}.csv`, buildOverviewRows());
    showToast("CSV 다운로드를 시작했습니다.", "success");
  }

  function handleReportExport() {
    if (overviewItems.length === 0) {
      showToast("다운로드할 데이터가 없습니다.", "error");
      return;
    }
    downloadCsv(`stats-report-${from}-${to}.csv`, buildOverviewRows());
    showToast(
      "기간 현황 데이터를 CSV로 내보냈습니다. (통합 PDF 리포트는 지원되지 않습니다.)",
      "success",
    );
  }

  return (
    <>
      <button className="btn btn-outline" type="button" onClick={handleCsvDownload}>
        <i className="ri-file-excel-2-line" />
        CSV 다운로드
      </button>
      <button className="btn btn-primary" type="button" onClick={handleReportExport}>
        <i className="ri-download-2-line" />
        리포트 내보내기
      </button>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

// ── 키워드 섹션 "CSV 다운로드" 버튼 ──────────────────────────────────────────

interface KeywordButtonProps {
  kwItems: KeywordItem[];
  from: string;
  to: string;
}

/**
 * 검색 키워드 섹션 CSV 버튼 (클라이언트 컴포넌트).
 * 현재 페이지의 kwItems 를 props 로 받아 CSV로 저장.
 * 파일명: stats-keywords-{from}-{to}.csv
 */
export function StatsKeywordCsvButton({ kwItems, from, to }: KeywordButtonProps) {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => setToast({ message, type }),
    [],
  );

  function handleCsvDownload() {
    if (kwItems.length === 0) {
      showToast("다운로드할 데이터가 없습니다.", "error");
      return;
    }
    downloadCsv(
      `stats-keywords-${from}-${to}.csv`,
      kwItems.map((k) => ({
        검색어: k.keyword,
        방문수: k.count,
      })),
    );
    showToast("검색 키워드 CSV 다운로드를 시작했습니다.", "success");
  }

  return (
    <>
      <button className="btn btn-outline btn-sm" type="button" onClick={handleCsvDownload}>
        <i className="ri-file-excel-2-line" />
        CSV 다운로드
      </button>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
