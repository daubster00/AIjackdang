/**
 * 유저 회원 관리 서비스 레이어 (Story 9.12).
 *
 * sanctionMember, grantPoints, deductPoints, changeGrade, grantBadge, revokeBadge
 *
 * 스키마 실제 기준:
 *  - user_sanctions: type("warning"|"suspend"|"permaban"), reason(NOT note)
 *  - users: status("active"|"suspended"|"withdrawn"), suspendedUntil(nullable timestamptz)
 *  - points_ledger: delta(int +/-), reason(text), sourceType(text)
 *  - grade는 users 컬럼 없음 — points_ledger SUM으로 도출, changeGrade는 포인트 조정으로 구현
 */

import { getDb } from "@ai-jakdang/database";
import {
  users,
  userSanctions,
  pointsLedger,
  grades,
  badges,
  userBadges,
} from "@ai-jakdang/database/schema";
import { eq, sql, and, count, ilike, or, gte, lte, asc, desc } from "drizzle-orm";

/** 목록 쿼리 파라미터 타입 (contracts/admin/members.ts 미노출 시 로컬 정의) */
interface AdminUserMembersQuery {
  status?: "active" | "suspended" | "withdrawn";
  grade?: number;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page: number;
  pageSize: number;
}

// ── 내부 헬퍼: 사용자 포인트 합계 + 등급 도출 ────────────────────────────────────

/**
 * 사용자의 현재 총 포인트와 등급을 계산한다.
 * points_ledger SUM(delta) → grades 테이블에서 minPoints <= total < (다음 등급 minPoints) 범위 탐색.
 */
async function getUserPointsAndGrade(userId: string): Promise<{
  totalPoints: number;
  gradeLevel: number;
  gradeName: string;
  gradeId: string;
  gradeMinPoints: number;
}> {
  const db = getDb();

  // 포인트 합계
  const [ledgerSum] = await db
    .select({ total: sql<number>`COALESCE(SUM(${pointsLedger.delta}), 0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId));

  const totalPoints = Number(ledgerSum?.total ?? 0);

  // 전체 등급 목록 (레벨 오름차순)
  const allGrades = await db
    .select()
    .from(grades)
    .orderBy(asc(grades.level));

  if (allGrades.length === 0) {
    return { totalPoints, gradeLevel: 1, gradeName: "새내기", gradeId: "", gradeMinPoints: 0 };
  }

  // 포인트에 해당하는 등급 탐색 (내림차순으로 첫 번째 minPoints <= total)
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
  const { status, grade, dateFrom, dateTo, q, page, pageSize } = query;

  const conditions = [];

  if (status) {
    conditions.push(eq(users.status, status));
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

  // 총 개수
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(users)
    .where(where);

  const offset = (page - 1) * pageSize;

  // 목록 + 활동 수치 서브쿼리
  const rows = await db
    .select({
      id: users.id,
      nickname: users.nickname,
      email: users.email,
      status: users.status,
      suspendedUntil: users.suspendedUntil,
      createdAt: users.createdAt,
      totalPoints: sql<number>`COALESCE((SELECT SUM(pl.delta)::int FROM points_ledger pl WHERE pl.user_id = ${users.id}), 0)`,
      postCount: sql<number>`(SELECT COUNT(*)::int FROM posts WHERE user_id = ${users.id} AND status != 'deleted')`,
      // 신고 테이블에는 "신고당한 유저" 컬럼이 없고 target_type/target_id로 콘텐츠를 가리킨다.
      // → 이 유저가 작성한 게시글·댓글을 대상으로 한 신고 수를 합산한다.
      reportCount: sql<number>`(
        SELECT COUNT(*)::int FROM reports r
        WHERE (r.target_type = 'post' AND r.target_id IN (SELECT id FROM posts WHERE user_id = ${users.id}))
           OR (r.target_type = 'comment' AND r.target_id IN (SELECT id FROM comments WHERE author_id = ${users.id}))
      )`,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset);

  // 전체 등급 목록 (레벨 오름차순)
  const allGrades = await db.select().from(grades).orderBy(asc(grades.level));

  const deriveGrade = (totalPoints: number): { gradeLevel: number; gradeName: string } => {
    if (allGrades.length === 0) return { gradeLevel: 1, gradeName: "새내기" };
    let matched = allGrades[0];
    for (const g of allGrades) {
      if (totalPoints >= g.minPoints) matched = g;
    }
    return { gradeLevel: matched.level, gradeName: matched.name };
  };

  // 등급 필터 적용 (포인트 기반 파생값이므로 DB where로 불가, 메모리 필터)
  let items = rows.map((r) => {
    const { gradeLevel, gradeName } = deriveGrade(Number(r.totalPoints));
    return {
      id: r.id,
      nickname: r.nickname,
      email: r.email,
      status: r.status,
      suspendedUntil: r.suspendedUntil ? r.suspendedUntil.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      totalPoints: Number(r.totalPoints),
      gradeLevel,
      gradeName,
      postCount: Number(r.postCount),
      reportCount: Number(r.reportCount),
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
    })
    .from(users)
    .where(eq(users.id, userId));

  // 제재 이력
  const sanctionRows = await db
    .select()
    .from(userSanctions)
    .where(eq(userSanctions.userId, userId))
    .orderBy(desc(userSanctions.createdAt));

  // 보유 뱃지 (badges join)
  const badgeRows = await db
    .select({
      id: userBadges.id,
      badgeId: userBadges.badgeId,
      slug: badges.slug,
      name: badges.name,
      iconUrl: badges.iconUrl,
      grantedAt: userBadges.grantedAt,
      grantedBy: userBadges.grantedBy,
    })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(eq(userBadges.userId, userId))
    .orderBy(desc(userBadges.grantedAt));

  return {
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    bio: user.bio ?? null,
    status: user.status,
    suspendedUntil: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    totalPoints,
    gradeLevel,
    gradeName,
    postCount: Number(stats?.postCount ?? 0),
    reportCount: Number(stats?.reportCount ?? 0),
    sanctions: sanctionRows.map((s) => ({
      id: s.id,
      type: s.type,
      reason: s.reason,
      issuedBy: s.issuedBy ?? null,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
    })),
    badges: badgeRows.map((b) => ({
      id: b.id,
      badgeId: b.badgeId,
      slug: b.slug,
      name: b.name,
      iconUrl: b.iconUrl,
      grantedAt: b.grantedAt.toISOString(),
      grantedBy: b.grantedBy ?? null,
    })),
  };
}

// ── 제재 생성 ──────────────────────────────────────────────────────────────────

/**
 * 회원 제재 생성.
 *
 * - warning: user_sanctions INSERT, users.status 변경 없음
 * - suspend: user_sanctions INSERT + users.status="suspended" + suspendedUntil=endsAt
 * - permaban: user_sanctions INSERT + users.status="suspended" + suspendedUntil=null (영구)
 *   (endsAt=null → 사실상 영구 정지. 해제하려면 DELETE /sanctions/:id 사용)
 */
export async function sanctionMember(
  userId: string,
  type: "warning" | "suspend" | "permaban",
  reason: string,
  endsAt: Date | null,
  issuedBy: string | null,
) {
  const db = getDb();

  // 대상 회원 확인
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
    newSuspendedUntil = null; // null = 영구
  }
  // warning: 상태 변경 없음

  return await db.transaction(async (tx) => {
    // 1. user_sanctions 삽입
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

    // 2. users 상태 갱신 (warning 이외)
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

/**
 * 제재 레코드 삭제 + users.status="active" + suspendedUntil=null 복구.
 */
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

    // 남은 suspend/permaban 제재가 없으면 상태 복구
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

/**
 * 포인트 수동 지급.
 * points_ledger INSERT: delta=+amount, reason="admin.grant", sourceType="admin"
 */
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

  // 최신 총 포인트 계산
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

/**
 * 포인트 수동 차감 (super_admin 전용).
 * points_ledger INSERT: delta=-amount, reason="admin.deduct", sourceType="admin"
 * 음수 잔액 허용 (이벤트소싱 패턴).
 */
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

/**
 * 등급 수동 변경 (super_admin 전용).
 *
 * grade는 users에 컬럼이 없고 points_ledger SUM으로 도출된다.
 * 따라서 "등급 변경"은 포인트 조정으로 구현:
 *   1. 현재 포인트 합계 계산
 *   2. 목표 등급(targetLevel)의 minPoints 조회
 *   3. delta = targetMinPoints - currentTotal 의 포인트 행 삽입
 *   → 이후 SUM이 targetMinPoints 이상이 되어 해당 등급에 진입
 *
 * 주의: 같은 등급 범위 내 포인트 조정은 delta=0 이 될 수 있으므로
 * 그 경우에도 reason "admin.grade_set" 행을 삽입해 변경 이력을 남긴다.
 */
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

  // 목표 등급 조회
  const [targetGrade] = await db
    .select()
    .from(grades)
    .where(eq(grades.level, targetLevel))
    .limit(1);

  if (!targetGrade) {
    throw Object.assign(new Error("존재하지 않는 등급 레벨입니다."), { code: "NOT_FOUND" });
  }

  // 현재 포인트 합계
  const [{ total }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${pointsLedger.delta}), 0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId));

  const currentTotal = Number(total);
  // targetMinPoints가 현재보다 낮으면 음수 delta(차감)도 허용
  const adjustedDelta = targetGrade.minPoints - currentTotal;

  // delta = 0 이어도 이력 삽입 (사유 기록 목적)
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

// ── 뱃지 지급 ──────────────────────────────────────────────────────────────────

/**
 * 뱃지 수동 지급.
 * (userId, badgeId) UNIQUE 충돌 시 이미 보유 → 에러.
 * user_badges.granted_by 는 현재 users FK 이므로 관리자 admin_users.id 를 넣지 않는다.
 * 운영자 지급 이력은 별도 감사 로그가 생기기 전까지 null 로 저장한다.
 */
export async function grantBadge(userId: string, badgeId: string, _grantedBy: string) {
  const db = getDb();

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw Object.assign(new Error("회원을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const [badge] = await db
    .select({ id: badges.id, name: badges.name })
    .from(badges)
    .where(eq(badges.id, badgeId))
    .limit(1);

  if (!badge) {
    throw Object.assign(new Error("존재하지 않는 뱃지입니다."), { code: "NOT_FOUND" });
  }

  // 이미 보유 확인
  const [existing] = await db
    .select({ id: userBadges.id })
    .from(userBadges)
    .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)))
    .limit(1);

  if (existing) {
    throw Object.assign(new Error("이미 보유한 뱃지입니다."), { code: "CONFLICT" });
  }

  const [ub] = await db
    .insert(userBadges)
    .values({
      userId,
      badgeId,
      grantedBy: null,
    })
    .returning();

  return {
    userBadgeId: ub.id,
    userId,
    badgeId,
    badgeName: badge.name,
  };
}

// ── 뱃지 회수 ──────────────────────────────────────────────────────────────────

export async function revokeBadge(userId: string, badgeId: string) {
  const db = getDb();

  const [ub] = await db
    .select({ id: userBadges.id })
    .from(userBadges)
    .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)))
    .limit(1);

  if (!ub) {
    throw Object.assign(new Error("보유하지 않은 뱃지입니다."), { code: "NOT_FOUND" });
  }

  await db.delete(userBadges).where(eq(userBadges.id, ub.id));

  return { deleted: true, userId, badgeId };
}

// ── 뱃지 마스터 목록 ──────────────────────────────────────────────────────────

export async function listBadges() {
  const db = getDb();
  const rows = await db
    .select()
    .from(badges)
    .orderBy(asc(badges.slug));

  return rows.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    iconUrl: b.iconUrl,
    isAuto: b.isAuto,
  }));
}
