/**
 * 유저 회원 관리 서비스 레이어 (Story 9.12).
 *
 * sanctionMember, grantPoints, deductPoints, changeGrade
 *
 * 스키마 실제 기준:
 *  - user_sanctions: type("warning"|"suspend"|"permaban"), reason(NOT note)
 *  - users: status("active"|"suspended"|"withdrawn"), suspendedUntil(nullable timestamptz)
 *  - points_ledger: delta(int +/-), reason(text), sourceType(text)
 *  - grade는 users 컬럼 없음 — points_ledger SUM으로 도출, changeGrade는 포인트 조정으로 구현
 *
 * 수정요청 #20: badges/user_badges 테이블 DROP → 뱃지 관련 함수 전부 제거
 * 수정요청 #21: 성별/생년월일/마케팅동의/약관동의/연락처 반환
 * 수정요청 #22: 최근 게시글·댓글·로그인 세션 반환
 */

import { getDb } from "@ai-jakdang/database";
import {
  users,
  userSanctions,
  pointsLedger,
  grades,
  sessions,
  posts,
  comments,
} from "@ai-jakdang/database/schema";
import { eq, sql, and, count, ilike, or, gte, lte, asc, desc } from "drizzle-orm";
import { getSiteSetting } from "../../../lib/siteSettings.js";

/** 목록 쿼리 파라미터 타입 */
interface AdminUserMembersQuery {
  status?: "active" | "suspended" | "withdrawn";
  grade?: number;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page: number;
  pageSize: number;
  /** Story 12.5: resolvedReportCount >= threshold AND status='active' 인 회원만 */
  escalated?: boolean;
}

// ── 내부 헬퍼: 사용자 포인트 합계 + 등급 도출 ────────────────────────────────────

async function getUserPointsAndGrade(userId: string): Promise<{
  totalPoints: number;
  gradeLevel: number;
  gradeName: string;
  gradeId: string;
  gradeMinPoints: number;
}> {
  const db = getDb();

  const [ledgerSum] = await db
    .select({ total: sql<number>`COALESCE(SUM(${pointsLedger.delta}), 0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId));

  const totalPoints = Number(ledgerSum?.total ?? 0);

  const allGrades = await db
    .select()
    .from(grades)
    .orderBy(asc(grades.level));

  if (allGrades.length === 0) {
    return { totalPoints, gradeLevel: 1, gradeName: "새내기", gradeId: "", gradeMinPoints: 0 };
  }

  let matched = allGrades[0];
  for (const g of allGrades) {
    if (totalPoints >= g.minPoints) {
      matched = g;
    }
  }

  return {
    totalPoints,
    gradeLevel: matched.level,
    gradeName: matched.name,
    gradeId: matched.id,
    gradeMinPoints: matched.minPoints,
  };
}

// ── 목록 조회 ──────────────────────────────────────────────────────────────────

export async function listUserMembers(query: AdminUserMembersQuery) {
  const db = getDb();

  // 만료된 기간제 정지를 일괄 해제하여 관리자 목록에 정확한 상태를 표시한다
  await db.execute(
    sql`UPDATE users SET status='active', suspended_until=NULL, updated_at=now() WHERE status='suspended' AND suspended_until IS NOT NULL AND suspended_until <= now()`,
  );

  const { status, grade, dateFrom, dateTo, q, page, pageSize, escalated } = query;

  // 상관 서브쿼리에서 외부 users 행을 참조할 때 반드시 테이블 한정 식별자를 써야 한다.
  // drizzle 의 sql 템플릿은 `${usersId}` 를 SELECT 프로젝션 안에서 비한정 `"id"` 로 렌더링하는데,
  // 서브쿼리 FROM(예: reports r) 안의 `"id"` 는 그 테이블의 id 로 바인딩돼 상관이 깨진다
  // (postCount/totalPoints/reportCount/resolvedReportCount 가 전부 0 으로 잘못 집계되던 원인).
  const usersId = sql.raw('"users"."id"');

  const conditions = [];

  if (escalated === true) {
    // 검토 요망: resolvedReportCount >= threshold AND status='active'
    // threshold는 site_settings에서 조회(없으면 5)
    const thresholdRaw = await getSiteSetting<number>("report_escalation_threshold");
    const threshold = typeof thresholdRaw === "number" ? thresholdRaw : 5;
    // WHERE: status='active' + 누적 처리완료 신고 >= 임계치 (서브쿼리)
    conditions.push(eq(users.status, "active"));
    conditions.push(
      sql`(
        SELECT COUNT(*)::int FROM reports r
        WHERE r.status = 'resolved'
        AND (
          (r.target_type = 'post'     AND r.target_id IN (SELECT id FROM posts     WHERE user_id   = ${usersId}))
          OR (r.target_type = 'comment'  AND r.target_id IN (SELECT id FROM comments  WHERE author_id = ${usersId}))
          OR (r.target_type = 'question' AND r.target_id IN (SELECT id FROM questions WHERE user_id   = ${usersId}))
          OR (r.target_type = 'answer'   AND r.target_id IN (SELECT id FROM answers   WHERE user_id   = ${usersId}))
          OR (r.target_type = 'resource' AND r.target_id IN (SELECT id FROM resources WHERE user_id   = ${usersId}))
          OR (r.target_type = 'user'     AND r.target_id = ${usersId})
        )
      ) >= ${threshold}`,
    );
  } else {
    if (status) {
      conditions.push(eq(users.status, status));
    }
  }

  if (dateFrom) {
    conditions.push(gte(users.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(users.createdAt, toDate));
  }
  if (q) {
    conditions.push(
      or(
        ilike(users.nickname, `%${q}%`),
        ilike(users.email, `%${q}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(users)
    .where(where);

  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: users.id,
      nickname: users.nickname,
      email: users.email,
      status: users.status,
      suspendedUntil: users.suspendedUntil,
      createdAt: users.createdAt,
      // 아바타 필드 (#5)
      avatarUrl: users.avatarUrl,
      image: users.image,
      defaultAvatarIndex: users.defaultAvatarIndex,
      isBot: users.isBot,
      totalPoints: sql<number>`COALESCE((SELECT SUM(pl.delta)::int FROM points_ledger pl WHERE pl.user_id = ${usersId}), 0)`,
      postCount: sql<number>`(SELECT COUNT(*)::int FROM posts WHERE user_id = ${usersId} AND status != 'deleted')`,
      reportCount: sql<number>`(
        SELECT COUNT(*)::int FROM reports r
        WHERE (r.target_type = 'post' AND r.target_id IN (SELECT id FROM posts WHERE user_id = ${usersId}))
           OR (r.target_type = 'comment' AND r.target_id IN (SELECT id FROM comments WHERE author_id = ${usersId}))
      )`,
      resolvedReportCount: sql<number>`(
        SELECT COUNT(*)::int FROM reports r
        WHERE r.status = 'resolved'
        AND (
          (r.target_type = 'post'     AND r.target_id IN (SELECT id FROM posts     WHERE user_id   = ${usersId}))
          OR (r.target_type = 'comment'  AND r.target_id IN (SELECT id FROM comments  WHERE author_id = ${usersId}))
          OR (r.target_type = 'question' AND r.target_id IN (SELECT id FROM questions WHERE user_id   = ${usersId}))
          OR (r.target_type = 'answer'   AND r.target_id IN (SELECT id FROM answers   WHERE user_id   = ${usersId}))
          OR (r.target_type = 'resource' AND r.target_id IN (SELECT id FROM resources WHERE user_id   = ${usersId}))
          OR (r.target_type = 'user'     AND r.target_id = ${usersId})
        )
      )`,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset);

  const allGrades = await db.select().from(grades).orderBy(asc(grades.level));

  const deriveGrade = (totalPoints: number): { gradeLevel: number; gradeName: string } => {
    if (allGrades.length === 0) return { gradeLevel: 1, gradeName: "새내기" };
    let matched = allGrades[0];
    for (const g of allGrades) {
      if (totalPoints >= g.minPoints) matched = g;
    }
    return { gradeLevel: matched.level, gradeName: matched.name };
  };

  let items = rows.map((r) => {
    const { gradeLevel, gradeName } = deriveGrade(Number(r.totalPoints));
    return {
      id: r.id,
      nickname: r.nickname,
      email: r.email,
      status: r.status,
      suspendedUntil: r.suspendedUntil ? r.suspendedUntil.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      avatarUrl: r.avatarUrl ?? null,
      image: r.image ?? null,
      defaultAvatarIndex: r.defaultAvatarIndex,
      isBot: r.isBot ?? false,
      totalPoints: Number(r.totalPoints),
      gradeLevel,
      gradeName,
      postCount: Number(r.postCount),
      reportCount: Number(r.reportCount),
      resolvedReportCount: Number(r.resolvedReportCount),
    };
  });

  if (grade !== undefined) {
    items = items.filter((m) => m.gradeLevel === grade);
  }

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems: grade !== undefined ? items.length : Number(totalItems),
      totalPages: grade !== undefined
        ? Math.ceil(items.length / pageSize)
        : Math.ceil(Number(totalItems) / pageSize),
    },
  };
}

// ── 회원 상세 조회 ─────────────────────────────────────────────────────────────

export async function getUserMemberDetail(userId: string) {
  const db = getDb();

  // 만료된 기간제 정지를 해제하여 상세 조회 시 정확한 상태를 반환한다
  await db.execute(
    sql`UPDATE users SET status='active', suspended_until=NULL, updated_at=now() WHERE status='suspended' AND suspended_until IS NOT NULL AND suspended_until <= now()`,
  );

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw Object.assign(new Error("회원을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  // 포인트 + 등급
  const { totalPoints, gradeLevel, gradeName } = await getUserPointsAndGrade(userId);

  // 활동 수치
  const [stats] = await db
    .select({
      postCount: sql<number>`(SELECT COUNT(*)::int FROM posts WHERE user_id = ${userId} AND status != 'deleted')`,
      reportCount: sql<number>`(
        SELECT COUNT(*)::int FROM reports r
        WHERE (r.target_type = 'post' AND r.target_id IN (SELECT id FROM posts WHERE user_id = ${userId}))
           OR (r.target_type = 'comment' AND r.target_id IN (SELECT id FROM comments WHERE author_id = ${userId}))
      )`,
      resolvedReportCount: sql<number>`(
        SELECT COUNT(*)::int FROM reports r
        WHERE r.status = 'resolved'
        AND (
          (r.target_type = 'post'     AND r.target_id IN (SELECT id FROM posts     WHERE user_id   = ${userId}))
          OR (r.target_type = 'comment'  AND r.target_id IN (SELECT id FROM comments  WHERE author_id = ${userId}))
          OR (r.target_type = 'question' AND r.target_id IN (SELECT id FROM questions WHERE user_id   = ${userId}))
          OR (r.target_type = 'answer'   AND r.target_id IN (SELECT id FROM answers   WHERE user_id   = ${userId}))
          OR (r.target_type = 'resource' AND r.target_id IN (SELECT id FROM resources WHERE user_id   = ${userId}))
          OR (r.target_type = 'user'     AND r.target_id = ${userId})
        )
      )`,
    })
    .from(users)
    .where(eq(users.id, userId));

  // 제재 이력
  const sanctionRows = await db
    .select()
    .from(userSanctions)
    .where(eq(userSanctions.userId, userId))
    .orderBy(desc(userSanctions.createdAt));

  // 최근 게시글 (최대 20건, deleted 제외) — #22
  const postRows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      createdAt: posts.createdAt,
      board: posts.board,
    })
    .from(posts)
    .where(and(eq(posts.userId, userId), sql`${posts.status} != 'deleted'`))
    .orderBy(desc(posts.createdAt))
    .limit(20);

  // 최근 댓글 (최대 20건) — #22
  // postBoard: 댓글 대상이 게시글(post)인 경우 해당 게시글의 board 값을 서브쿼리로 조회.
  // getCrossLink 에서 게시글 상세 URL(/posts/{boardSlug}/{postId}) 을 구성할 때 사용한다.
  const commentRows = await db
    .select({
      id: comments.id,
      targetType: comments.targetType,
      targetId: comments.targetId,
      content: comments.content,
      createdAt: comments.createdAt,
      postBoard: sql<string | null>`(CASE WHEN ${comments.targetType} = 'post' THEN (SELECT board FROM posts WHERE id = ${comments.targetId}) ELSE NULL END)`,
    })
    .from(comments)
    .where(eq(comments.authorId, userId))
    .orderBy(desc(comments.createdAt))
    .limit(20);

  // 로그인 세션 이력 (최대 20건, 최신순) — #22
  // 명시적 로그아웃 이력은 없으므로 createdAt=로그인 시각, updatedAt=마지막 갱신, expiresAt=만료로 표시
  const sessionRows = await db
    .select({
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(20);

  // 신고 임계치 (site_settings, 없으면 fallback 5)
  const thresholdRaw = await getSiteSetting<number>("report_escalation_threshold");
  const reportEscalationThreshold = typeof thresholdRaw === "number" ? thresholdRaw : 5;

  // 처리완료 신고 목록 (최대 20건, 최신순) — 12.3
  const receivedReportRows = await db
    .select({
      id: sql<string>`r.id`,
      targetType: sql<string>`r.target_type`,
      reasonCode: sql<string>`r.reason_code`,
      reviewedAt: sql<Date | null>`r.reviewed_at`,
      reviewedByName: sql<string | null>`au.name`,
    })
    .from(sql`reports r`)
    .leftJoin(sql`admin_users au`, sql`au.id = r.reviewed_by`)
    .where(sql`
      r.status = 'resolved'
      AND (
        (r.target_type = 'post'     AND r.target_id IN (SELECT id FROM posts     WHERE user_id   = ${userId}))
        OR (r.target_type = 'comment'  AND r.target_id IN (SELECT id FROM comments  WHERE author_id = ${userId}))
        OR (r.target_type = 'question' AND r.target_id IN (SELECT id FROM questions WHERE user_id   = ${userId}))
        OR (r.target_type = 'answer'   AND r.target_id IN (SELECT id FROM answers   WHERE user_id   = ${userId}))
        OR (r.target_type = 'resource' AND r.target_id IN (SELECT id FROM resources WHERE user_id   = ${userId}))
        OR (r.target_type = 'user'     AND r.target_id = ${userId})
      )
    `)
    .orderBy(sql`r.reviewed_at DESC NULLS LAST`)
    .limit(20);

  return {
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    name: user.name ?? null,
    // 아바타 필드 (#5)
    avatarUrl: user.avatarUrl ?? null,
    image: user.image ?? null,
    defaultAvatarIndex: user.defaultAvatarIndex,
    isBot: user.isBot ?? false,
    bio: user.bio ?? null,
    // 추가 기본정보 (#21)
    phone: user.phone ?? null,
    gender: user.gender ?? null,
    birthDate: user.birthDate ?? null,
    termsAgreedAt: user.termsAgreedAt ? user.termsAgreedAt.toISOString() : null,
    marketingAgreedAt: user.marketingAgreedAt ? user.marketingAgreedAt.toISOString() : null,
    status: user.status,
    suspendedUntil: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    totalPoints,
    gradeLevel,
    gradeName,
    postCount: Number(stats?.postCount ?? 0),
    reportCount: Number(stats?.reportCount ?? 0),
    resolvedReportCount: Number(stats?.resolvedReportCount ?? 0),
    reportEscalationThreshold,
    receivedReports: receivedReportRows.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      reasonCode: r.reasonCode,
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
      reviewedByName: r.reviewedByName ?? null,
    })),
    sanctions: sanctionRows.map((s) => ({
      id: s.id,
      type: s.type,
      reason: s.reason,
      issuedBy: s.issuedBy ?? null,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
    })),
    // 활동내역 탭 데이터 (#22)
    recentPosts: postRows.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      board: p.board,
    })),
    recentComments: commentRows.map((c) => ({
      id: c.id,
      targetType: c.targetType,
      targetId: c.targetId,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      board: c.postBoard ?? null,
    })),
    loginSessions: sessionRows.map((s) => ({
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    })),
  };
}

// ── 제재 생성 ──────────────────────────────────────────────────────────────────

export async function sanctionMember(
  userId: string,
  type: "warning" | "suspend" | "permaban",
  reason: string,
  endsAt: Date | null,
  issuedBy: string | null,
) {
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw Object.assign(new Error("회원을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }
  if (reason.trim() === "") {
    throw Object.assign(new Error("사유를 입력하세요."), { code: "VALIDATION_ERROR" });
  }

  let newStatus = user.status;
  let newSuspendedUntil = user.suspendedUntil;

  if (type === "suspend") {
    newStatus = "suspended";
    newSuspendedUntil = endsAt;
  } else if (type === "permaban") {
    newStatus = "suspended";
    newSuspendedUntil = null;
  }

  return await db.transaction(async (tx) => {
    const [sanction] = await tx
      .insert(userSanctions)
      .values({
        userId,
        type,
        reason,
        issuedBy,
        endsAt,
      })
      .returning();

    if (type !== "warning") {
      await tx
        .update(users)
        .set({
          status: newStatus,
          suspendedUntil: newSuspendedUntil,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }

    return {
      sanctionId: sanction.id,
      userId,
      type,
      status: newStatus,
    };
  });
}

// ── 제재 해제 ──────────────────────────────────────────────────────────────────

export async function removeSanction(userId: string, sanctionId: string) {
  const db = getDb();

  const [sanction] = await db
    .select()
    .from(userSanctions)
    .where(and(eq(userSanctions.id, sanctionId), eq(userSanctions.userId, userId)))
    .limit(1);

  if (!sanction) {
    throw Object.assign(new Error("제재 이력을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  return await db.transaction(async (tx) => {
    await tx.delete(userSanctions).where(eq(userSanctions.id, sanctionId));

    const [remaining] = await tx
      .select({ cnt: count() })
      .from(userSanctions)
      .where(
        and(
          eq(userSanctions.userId, userId),
          sql`${userSanctions.type} IN ('suspend', 'permaban')`,
        ),
      );

    if (Number(remaining?.cnt ?? 0) === 0) {
      await tx
        .update(users)
        .set({ status: "active", suspendedUntil: null, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return { deleted: true, sanctionId };
  });
}

// ── 포인트 지급 ────────────────────────────────────────────────────────────────

export async function grantPoints(
  userId: string,
  amount: number,
  reason: string,
) {
  const db = getDb();

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw Object.assign(new Error("회원을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const [ledger] = await db
    .insert(pointsLedger)
    .values({
      userId,
      delta: amount,
      reason: reason.trim() || "admin.grant",
      sourceType: "admin",
    })
    .returning();

  const [{ total }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${pointsLedger.delta}), 0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId));

  return {
    ledgerId: ledger.id,
    userId,
    delta: ledger.delta,
    totalPoints: Number(total),
  };
}

// ── 포인트 차감 ────────────────────────────────────────────────────────────────

export async function deductPoints(
  userId: string,
  amount: number,
  reason: string,
) {
  const db = getDb();

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw Object.assign(new Error("회원을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }
  if (reason.trim() === "") {
    throw Object.assign(new Error("차감 사유를 입력하세요."), { code: "VALIDATION_ERROR" });
  }

  const [ledger] = await db
    .insert(pointsLedger)
    .values({
      userId,
      delta: -amount,
      reason: reason.trim() || "admin.deduct",
      sourceType: "admin",
    })
    .returning();

  const [{ total }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${pointsLedger.delta}), 0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId));

  return {
    ledgerId: ledger.id,
    userId,
    delta: ledger.delta,
    totalPoints: Number(total),
  };
}

// ── 등급 수동 변경 ─────────────────────────────────────────────────────────────

export async function changeGrade(
  userId: string,
  targetLevel: number,
  reason: string,
) {
  const db = getDb();

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw Object.assign(new Error("회원을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }
  if (reason.trim() === "") {
    throw Object.assign(new Error("사유를 입력하세요."), { code: "VALIDATION_ERROR" });
  }

  const [targetGrade] = await db
    .select()
    .from(grades)
    .where(eq(grades.level, targetLevel))
    .limit(1);

  if (!targetGrade) {
    throw Object.assign(new Error("존재하지 않는 등급 레벨입니다."), { code: "NOT_FOUND" });
  }

  const [{ total }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${pointsLedger.delta}), 0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId));

  const currentTotal = Number(total);
  const adjustedDelta = targetGrade.minPoints - currentTotal;

  const [ledger] = await db
    .insert(pointsLedger)
    .values({
      userId,
      delta: adjustedDelta,
      reason: "admin.grade_set",
      sourceType: "admin",
    })
    .returning();

  const newTotal = currentTotal + adjustedDelta;

  return {
    userId,
    gradeLevel: targetGrade.level,
    gradeName: targetGrade.name,
    totalPoints: newTotal,
    adjustedDelta: ledger.delta,
  };
}

// ── 포인트 내역 조회 (Item 27) ─────────────────────────────────────────────────

/**
 * 회원 포인트 원장 페이지네이션 조회.
 *
 * - 최신순 정렬.
 * - balance: 각 행 시점의 누적 잔액 (window function으로 계산).
 * - totalBalance: 전체 현재 잔액.
 */
export async function getMemberPointsHistory(
  userId: string,
  page: number,
  pageSize: number,
) {
  const db = getDb();

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw Object.assign(new Error("회원을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  // 전체 건수 + 잔액
  const [summary] = await db
    .select({
      totalCount: sql<number>`COUNT(*)::int`,
      totalBalance: sql<number>`COALESCE(SUM(${pointsLedger.delta}), 0)::int`,
    })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId));

  const totalItems = Number(summary?.totalCount ?? 0);
  const totalBalance = Number(summary?.totalBalance ?? 0);
  const totalPages = Math.ceil(totalItems / pageSize);
  const offset = (page - 1) * pageSize;

  // 페이지된 행 + 누적 잔액 (ascending window → outer DESC sort)
  const rows = await db
    .select({
      id: pointsLedger.id,
      delta: pointsLedger.delta,
      reason: pointsLedger.reason,
      sourceType: pointsLedger.sourceType,
      createdAt: pointsLedger.createdAt,
      balance: sql<number>`SUM(${pointsLedger.delta}) OVER (ORDER BY ${pointsLedger.createdAt} ASC, ${pointsLedger.id} ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::int`,
    })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId))
    .orderBy(desc(pointsLedger.createdAt), desc(pointsLedger.id))
    .limit(pageSize)
    .offset(offset);

  return {
    items: rows.map((r) => ({
      id: r.id,
      delta: Number(r.delta),
      reason: r.reason,
      sourceType: r.sourceType,
      createdAt: r.createdAt.toISOString(),
      balance: Number(r.balance),
    })),
    totalBalance,
    meta: { page, pageSize, totalItems, totalPages },
  };
}
