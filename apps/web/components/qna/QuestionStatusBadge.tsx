/**
 * Q&A 질문 상태 배지 — Story 3.2
 *
 * derivedStatus('waiting'|'answered'|'resolved') 를 받아
 * 색상+텍스트 동반 배지로 렌더한다 (색 단독 전달 금지 규칙, UX-DR-U13).
 *
 * Story 3.5 상세 페이지에서도 이 컴포넌트를 재사용한다.
 *
 * tone 매핑:
 *   waiting  → warning  ("답변대기")
 *   answered → info     ("답변있음")
 *   resolved → success  ("해결됨")
 */

import { Badge } from "@/components/ui";

export type QuestionDerivedStatus = "waiting" | "answered" | "resolved";

export interface QuestionStatusBadgeProps {
  status: QuestionDerivedStatus;
  className?: string;
}

const STATUS_MAP: Record<
  QuestionDerivedStatus,
  { label: string; tone: "warning" | "info" | "success" }
> = {
  waiting: { label: "답변대기", tone: "warning" },
  answered: { label: "답변있음", tone: "info" },
  resolved: { label: "해결됨", tone: "success" },
};

export function QuestionStatusBadge({ status, className }: QuestionStatusBadgeProps) {
  const { label, tone } = STATUS_MAP[status];
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}
