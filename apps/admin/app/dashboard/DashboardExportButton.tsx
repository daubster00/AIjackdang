"use client";

import { downloadXlsx, type XlsxColumn } from "@/lib/xlsx";
import { notifyDialog } from "@/lib/dialog";
import type { RecentContentItem } from "@ai-jakdang/contracts";

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
  async function handleExport() {
    if (recentItems.length === 0) {
      void notifyDialog("다운로드할 데이터가 없습니다.", "danger");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);

    const columns: XlsxColumn[] = [
      { header: "유형",  key: "유형",  width: 12 },
      { header: "제목",  key: "제목",  width: 40 },
      { header: "게시판", key: "게시판", width: 16 },
      { header: "작성자", key: "작성자", width: 16 },
      { header: "상태",  key: "상태",  width: 12 },
      { header: "조회수", key: "조회수", width: 12 },
      { header: "등록일", key: "등록일", width: 14 },
    ];

    const rows = recentItems.map((r) => ({
      유형: TYPE_LABELS[r.type] ?? r.type,
      제목: r.title,
      게시판: r.board ?? "",
      작성자: r.authorNickname ?? "(탈퇴)",
      상태: STATUS_LABELS[r.status] ?? r.status,
      조회수: r.views,
      등록일: r.createdAt.slice(0, 10),
    }));

    await downloadXlsx(`dashboard-report-${today}.xlsx`, columns, rows);
    void notifyDialog("최근 콘텐츠를 엑셀(.xlsx)로 내보냈습니다.");
  }

  return (
    <button className="btn btn-outline" type="button" onClick={handleExport}>
      <i className="ri-download-2-line" />
      리포트 내보내기
    </button>
  );
}
