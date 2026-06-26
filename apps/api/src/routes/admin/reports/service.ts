/**
 * 신고 관리 서비스 레이어 (Story 9.10).
 *
 * listReports, getReport, markReviewing, hideTarget, rejectReport
 *
 * DB 상태 어휘 매핑:
 *   pending   = 접수
 *   reviewing = 확인중
 *   resolved  = 처리완료
 *   dismissed = 반려
 */

import { getDb } from "@ai-jakdang/database";
import {
  reports,
  users,
  posts,
  questions,
  answers,
  comments,
  resources,
} from "@ai-jakdang/database/schema";
import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import type { AdminReportsQuery } from "@ai-jakdang/contracts";

// ── 동적 대상 테이블 매핑 ────────────────────────────────────────────────────
// targetType → { table, statusColumn } 매핑
// 각 테이블이 지원하는 'hidden' 상태값:
//   post      → posts.status = 'hidden'      (postStatus enum 포함)
//   question  → questions.status = 'hidden'  (questionStatus enum 포함)
//   answer    → answers.status = 'hidden'    (answerStatus enum 포함)
//   comment   → comments.status = 'hidden'   (commentStatus enum 포함)
//   resource  → resources.status = 'hidden'  (resourceStatus enum 포함)
//   message   → messages 테이블은 hidden 상태 없음 → 처리완료만 기록(숨김 생략)

const TARGET_TABLE_MAP = {
  post: posts,
  question: questions,
  answer: answers,
  comment: comments,
  resource: resources,
} as const;

type HideableTargetType = keyof typeof TARGET_TABLE_MAP;

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export async function listReports(query: AdminReportsQuery, autoHiddenFilter?: boolean) {
  const db = getDb();
  const { status, targetType, dateFrom, dateTo, q, page, pageSize } = query;

  const conditions = [];

  if (status) {
    conditions.push(eq(reports.status, status));
  }
  if (targetType) {
    conditions.push(eq(reports.targetType, targetType));
  }
  if (dateFrom) {
    conditions.push(gte(reports.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(reports.createdAt, toDate));
  }
  // Story 9.11 "자동 숨김" 서브 필터
  if (autoHiddenFilter === true) {
    conditions.push(eq(reports.autoHidden, true));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 총 개수
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(reports)
    .where(where);

  const offset = (page - 1) * pageSize;

  // 목록: reports + 신고자 nickname + 처리자 이름(admin_users) + 대상 미리보기
  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reasonCode: reports.reasonCode,
      detail: reports.detail,
      status: reports.status,
      autoHidden: reports.autoHidden,
      reporterId: reports.reporterId,
      reporterNickname: users.nickname,
      reviewedBy: reports.reviewedBy,
      reviewedAt: reports.reviewedAt,
      createdAt: reports.createdAt,
      // 처리자 이름은 reviewedBy(admin_users.id)로 별도 서브쿼리
      reviewedByName: sql<string | null>`(
        SELECT name FROM admin_users WHERE id = ${reports.reviewedBy}
      )`,
      // 대상 콘텐츠 미리보기 — targetType별 동적 서브쿼리
      targetPreview: sql<string | null>`CASE
        WHEN ${reports.targetType} = 'post'
          THEN (SELECT title FROM posts WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'question'
          THEN (SELECT title FROM questions WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'answer'
          THEN (SELECT LEFT(content_json::text, 100) FROM answers WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'comment'
          THEN (SELECT LEFT(content, 100) FROM comments WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'resource'
          THEN (SELECT title FROM resources WHERE id = ${reports.targetId})
        ELSE NULL
      END`,
    })
    .from(reports)
    .leftJoin(users, eq(reports.reporterId, users.id))
    .where(where)
    .orderBy(sql`${reports.createdAt} DESC`)
    .limit(pageSize)
    .offset(offset);

  // 검색어 필터 (targetPreview 또는 신고자 닉네임)
  const filtered = q
    ? rows.filter((r) =>
        (r.targetPreview ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (r.reporterNickname ?? "").toLowerCase().includes(q.toLowerCase()),
      )
    : rows;

  const items = filtered.map((r) => ({
    ...r,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems: Number(totalItems),
      totalPages: Math.ceil(Number(totalItems) / pageSize),
    },
  };
}

// ── 상세 조회 ─────────────────────────────────────────────────────────────────

export async function getReport(id: string) {
  const db = getDb();

  const [row] = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reasonCode: reports.reasonCode,
      detail: reports.detail,
      status: reports.status,
      autoHidden: reports.autoHidden,
      reporterId: reports.reporterId,
      reporterNickname: users.nickname,
      reviewedBy: reports.reviewedBy,
      reviewedAt: reports.reviewedAt,
      createdAt: reports.createdAt,
      reviewedByName: sql<string | null>`(
        SELECT name FROM admin_users WHERE id = ${reports.reviewedBy}
      )`,
      targetPreview: sql<string | null>`CASE
        WHEN ${reports.targetType} = 'post'
          THEN (SELECT title FROM posts WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'question'
          THEN (SELECT title FROM questions WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'answer'
          THEN (SELECT LEFT(content_json::text, 100) FROM answers WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'comment'
          THEN (SELECT LEFT(content, 100) FROM comments WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'resource'
          THEN (SELECT title FROM resources WHERE id = ${reports.targetId})
        ELSE NULL
      END`,
      targetContentJson: sql<unknown | null>`CASE
        WHEN ${reports.targetType} = 'post'
          THEN (SELECT content_json FROM posts WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'question'
          THEN (SELECT content_json FROM questions WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'answer'
          THEN (SELECT content_json FROM answers WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'comment'
          THEN (SELECT to_jsonb(content) FROM comments WHERE id = ${reports.targetId})
        WHEN ${reports.targetType} = 'resource'
          THEN (SELECT description_json FROM resources WHERE id = ${reports.targetId})
        ELSE NULL
      END`,
    })
    .from(reports)
    .leftJoin(users, eq(reports.reporterId, users.id))
    .where(eq(reports.id, id))
    .limit(1);

  if (!row) {
    throw Object.assign(new Error("신고를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  return {
    ...row,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── 접수→확인중 변경 ───────────────────────────────────────────────────────────

export async function markReviewing(reportId: string, adminId: string) {
  const db = getDb();

  const [existing] = await db
    .select({ id: reports.id, status: reports.status })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!existing) {
    throw Object.assign(new Error("신고를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(reports)
    .set({
      status: "reviewing",
      reviewedBy: adminId,
      reviewedAt: now,
    })
    .where(eq(reports.id, reportId))
    .returning({ id: reports.id, status: reports.status, reviewedAt: reports.reviewedAt });

  return {
    id: updated.id,
    status: updated.status,
    reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : null,
  };
}

// ── 숨김 처리 (트랜잭션: reports.status='resolved' + target status='hidden') ──

export async function hideTarget(reportId: string, adminId: string) {
  const db = getDb();

  const [existing] = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!existing) {
    throw Object.assign(new Error("신고를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const targetType = existing.targetType as string;
  const targetId = existing.targetId;

  const updated = await db.transaction(async (tx) => {
    // 1) reports.status = 'resolved'
    const [reportRow] = await tx
      .update(reports)
      .set({ status: "resolved", reviewedBy: adminId, reviewedAt: now })
      .where(eq(reports.id, reportId))
      .returning({ id: reports.id, status: reports.status, reviewedAt: reports.reviewedAt });

    // 2) 대상 콘텐츠 status = 'hidden'
    // message 타입은 hidden 상태를 지원하지 않으므로 skip
    if (targetType in TARGET_TABLE_MAP) {
      const table = TARGET_TABLE_MAP[targetType as HideableTargetType];
      await tx
        .update(table)
        .set({ status: "hidden" as never, updatedAt: now } as never)
        .where(eq((table as typeof posts).id, targetId));
    }

    return reportRow;
  });

  return {
    id: updated.id,
    status: updated.status,
    reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : null,
  };
}

// ── 복구 상태 매핑 ─────────────────────────────────────────────────────────────
// 각 targetType의 "정상" 상태값. commentStatus는 visible|hidden|deleted 이므로
// post/question/answer/resource의 "published" 와 다르다.
const RESTORE_STATUS: Record<HideableTargetType, string> = {
  post: "published",
  question: "published",
  answer: "published",
  comment: "visible",
  resource: "published",
};

// ── 자동 숨김 복구 (Story 9.11, AC #2) ───────────────────────────────────────
// 자동 숨김(autoHidden=true)된 콘텐츠를 타입별 정상 상태로 복구하고
// 신고를 'resolved' 처리한다.

export async function restoreAutoHidden(reportId: string, adminId: string) {
  const db = getDb();

  const [existing] = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      autoHidden: reports.autoHidden,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!existing) {
    throw Object.assign(new Error("신고를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const targetType = existing.targetType as string;
  const targetId = existing.targetId;

  const updated = await db.transaction(async (tx) => {
    // 1) 대상 콘텐츠를 타입별 정상 상태로 복구 (자동 숨김 가능한 타입만)
    //    comment는 "visible", 나머지(post/question/answer/resource)는 "published"
    if (targetType in TARGET_TABLE_MAP) {
      const table = TARGET_TABLE_MAP[targetType as HideableTargetType];
      const restoreStatus = RESTORE_STATUS[targetType as HideableTargetType];
      await tx
        .update(table)
        .set({ status: restoreStatus as never, updatedAt: now } as never)
        .where(eq((table as typeof posts).id, targetId));
    }

    // 2) 신고 상태 resolved + autoHidden=false + 처리자 기록
    const [reportRow] = await tx
      .update(reports)
      .set({ status: "resolved", autoHidden: false, reviewedBy: adminId, reviewedAt: now })
      .where(eq(reports.id, reportId))
      .returning({ id: reports.id, status: reports.status, reviewedAt: reports.reviewedAt });

    return reportRow;
  });

  return {
    id: updated.id,
    status: updated.status,
    reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : null,
  };
}

// ── 반려 처리 ─────────────────────────────────────────────────────────────────

export async function rejectReport(reportId: string, adminId: string, note: string) {
  const db = getDb();

  const [existing] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!existing) {
    throw Object.assign(new Error("신고를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(reports)
    .set({
      status: "dismissed",
      detail: note, // 반려 사유를 detail 에 저장
      reviewedBy: adminId,
      reviewedAt: now,
    })
    .where(eq(reports.id, reportId))
    .returning({ id: reports.id, status: reports.status, reviewedAt: reports.reviewedAt });

  return {
    id: updated.id,
    status: updated.status,
    reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : null,
  };
}
