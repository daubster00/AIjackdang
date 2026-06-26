"use client";

import { useState, useEffect, useCallback } from "react";
import { downloadCsv } from "../../lib/csv";
import type { RecentContentItem } from "@ai-jakdang/contracts";

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

// ── 레이블 매핑 ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  post: "게시글",
  resource: "실전자료",
  question: "묻고답하기",
};

const STATUS_LABELS: Record<string, string> = {
  published: "공개",
  draft: "초안",
  hidden: "숨김",
  deleted: "삭제",
};

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

interface Props {
  recentItems: RecentContentItem[];
}

/**
 * 대시보드 "리포트 내보내기" 버튼 (클라이언트 컴포넌트).
 * 서버 컴포넌트인 dashboard/page.tsx 에서 recentItems 를 props 로 받아
 * downloadCsv() 로 최근 콘텐츠를 CSV로 내보낸다.
 */
export function DashboardExportButton({ recentItems }: Props) {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => setToast({ message, type }),
    [],
  );

  function handleExport() {
    if (recentItems.length === 0) {
      showToast("다운로드할 데이터가 없습니다.", "error");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `dashboard-report-${today}.csv`,
      recentItems.map((r) => ({
        유형: TYPE_LABELS[r.type] ?? r.type,
        제목: r.title,
        게시판: r.board ?? "",
        작성자: r.authorNickname ?? "(탈퇴)",
        상태: STATUS_LABELS[r.status] ?? r.status,
        조회수: r.views,
        등록일: r.createdAt.slice(0, 10),
      })),
    );
    showToast("최근 콘텐츠를 CSV로 내보냈습니다.", "success");
  }

  return (
    <>
      <button className="btn btn-outline" type="button" onClick={handleExport}>
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
