"use client";

import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import styles from "./inquiry.module.css";

// ── 타입 ──────────────────────────────────────────────────────────────────────

export interface InquiryListItemData {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
}

// ── 상태 → Badge 매핑 ────────────────────────────────────────────────────────

const STATUS_TONE: Record<InquiryListItemData["status"], BadgeTone> = {
  pending: "warning",
  in_progress: "info",
  resolved: "success",
};

const STATUS_LABEL: Record<InquiryListItemData["status"], string> = {
  pending: "접수",
  in_progress: "처리중",
  resolved: "완료",
};

// ── 날짜 포맷 헬퍼 ───────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

interface InquiryListItemProps {
  item: InquiryListItemData;
}

export function InquiryListItem({ item }: InquiryListItemProps) {
  const router = useRouter();

  return (
    <Card
      interactive
      className={styles.itemCard}
      onClick={() => router.push(`/inquiries/${item.id}`)}
      aria-label={`문의: ${item.title}`}
    >
      <div className={styles.itemCardBody}>
        <div className={styles.itemLeft}>
          <p className={styles.itemTitle}>{item.title}</p>
          <div className={styles.itemMeta}>
            <span>작성일 {formatDate(item.createdAt)}</span>
            {item.updatedAt !== item.createdAt && (
              <span>업데이트 {formatDate(item.updatedAt)}</span>
            )}
          </div>
        </div>
        <div className={styles.itemRight}>
          <Badge tone={STATUS_TONE[item.status]} variant="soft">
            {STATUS_LABEL[item.status]}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
