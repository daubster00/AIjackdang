/**
 * 광고 슬롯 관리 서비스 레이어 (Story 9.16).
 *
 * listAds, getAd, getAdStats, createAd, updateAd, toggleAd, deleteAd
 */

import { getDb } from "@ai-jakdang/database";
import { adSlots, adImpressions } from "@ai-jakdang/database/schema";
import {
  eq,
  and,
  isNull,
  ilike,
  count,
  sum,
  sql,
  gte,
  lte,
  desc,
} from "drizzle-orm";
import type {
  AdminAdsQuery,
  AdminAdCreateInput,
  AdminAdUpdateInput,
  AdminAdStatsQuery,
} from "@ai-jakdang/contracts";

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function computeStatus(
  isActive: boolean,
  startDate: string | null,
  endDate: string | null,
): "active" | "inactive" | "scheduled" | "expired" {
  if (!isActive) return "inactive";
  const today = new Date().toISOString().slice(0, 10);
  if (startDate && startDate > today) return "scheduled";
  if (endDate && endDate < today) return "expired";
  return "active";
}

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export async function listAds(query: AdminAdsQuery) {
  const db = getDb();
  const { placement, device, adType, status, q, page, pageSize } = query;

  const conditions = [isNull(adSlots.deletedAt)];

  if (placement) {
    conditions.push(eq(adSlots.placement, placement));
  }
  if (device) {
    conditions.push(eq(adSlots.device, device));
  }
  if (adType) {
    conditions.push(eq(adSlots.adType, adType));
  }
  if (q) {
    conditions.push(ilike(adSlots.name, `%${q}%`));
  }
  // status 필터는 DB 레벨에서 부분적으로 처리 (isActive 필드 기준)
  if (status === "active" || status === "scheduled") {
    conditions.push(eq(adSlots.isActive, true));
  } else if (status === "inactive") {
    conditions.push(eq(adSlots.isActive, false));
  }
  // "expired" 는 isActive=true + endDate<today 이므로 isActive=true로만 좁힘
  if (status === "expired") {
    conditions.push(eq(adSlots.isActive, true));
    const today = new Date().toISOString().slice(0, 10);
    conditions.push(lte(adSlots.endDate, today));
  }

  const where = and(...conditions);

  // 총 개수
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(adSlots)
    .where(where);

  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: adSlots.id,
      name: adSlots.name,
      placement: adSlots.placement,
      device: adSlots.device,
      adType: adSlots.adType,
      startDate: adSlots.startDate,
      endDate: adSlots.endDate,
      clickUrl: adSlots.clickUrl,
      code: adSlots.code,
      imageUrl: adSlots.imageUrl,
      memo: adSlots.memo,
      isActive: adSlots.isActive,
      createdAt: adSlots.createdAt,
      updatedAt: adSlots.updatedAt,
      deletedAt: adSlots.deletedAt,
      totalImpressions: sql<number>`COALESCE((SELECT SUM(impressions) FROM ad_impressions WHERE slot_id = ${adSlots.id}), 0)::int`,
      totalClicks: sql<number>`COALESCE((SELECT SUM(clicks) FROM ad_impressions WHERE slot_id = ${adSlots.id}), 0)::int`,
    })
    .from(adSlots)
    .where(where)
    .orderBy(desc(adSlots.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = rows.map((r) => ({
    ...r,
    ctr: r.totalImpressions > 0 ? r.totalClicks / r.totalImpressions : 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
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

export async function getAd(id: string) {
  const db = getDb();

  const rows = await db
    .select({
      id: adSlots.id,
      name: adSlots.name,
      placement: adSlots.placement,
      device: adSlots.device,
      adType: adSlots.adType,
      startDate: adSlots.startDate,
      endDate: adSlots.endDate,
      clickUrl: adSlots.clickUrl,
      code: adSlots.code,
      imageUrl: adSlots.imageUrl,
      memo: adSlots.memo,
      isActive: adSlots.isActive,
      createdAt: adSlots.createdAt,
      updatedAt: adSlots.updatedAt,
      deletedAt: adSlots.deletedAt,
      totalImpressions: sql<number>`COALESCE((SELECT SUM(impressions) FROM ad_impressions WHERE slot_id = ${adSlots.id}), 0)::int`,
      totalClicks: sql<number>`COALESCE((SELECT SUM(clicks) FROM ad_impressions WHERE slot_id = ${adSlots.id}), 0)::int`,
    })
    .from(adSlots)
    .where(and(eq(adSlots.id, id), isNull(adSlots.deletedAt)))
    .limit(1);

  const r = rows[0];
  if (!r) {
    throw Object.assign(new Error("광고 슬롯을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  return {
    ...r,
    ctr: r.totalImpressions > 0 ? r.totalClicks / r.totalImpressions : 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

// ── 성과 통계 ─────────────────────────────────────────────────────────────────

export async function getAdStats(id: string, query: AdminAdStatsQuery) {
  const db = getDb();

  // 슬롯 존재 확인
  const [slot] = await db
    .select({ id: adSlots.id })
    .from(adSlots)
    .where(and(eq(adSlots.id, id), isNull(adSlots.deletedAt)))
    .limit(1);

  if (!slot) {
    throw Object.assign(new Error("광고 슬롯을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const conditions = [eq(adImpressions.slotId, id)];

  if (query.dateFrom) {
    conditions.push(gte(adImpressions.date, query.dateFrom));
  }
  if (query.dateTo) {
    conditions.push(lte(adImpressions.date, query.dateTo));
  }

  const rows = await db
    .select({
      date: adImpressions.date,
      impressions: sum(adImpressions.impressions),
      clicks: sum(adImpressions.clicks),
    })
    .from(adImpressions)
    .where(and(...conditions))
    .groupBy(adImpressions.date)
    .orderBy(adImpressions.date);

  const items = rows.map((r) => {
    const imp = Number(r.impressions ?? 0);
    const clk = Number(r.clicks ?? 0);
    return {
      date: r.date,
      impressions: imp,
      clicks: clk,
      ctr: imp > 0 ? clk / imp : 0,
    };
  });

  return { items };
}

// ── 등록 ──────────────────────────────────────────────────────────────────────

export async function createAd(data: AdminAdCreateInput) {
  const db = getDb();

  const [inserted] = await db
    .insert(adSlots)
    .values({
      name: data.name,
      placement: data.placement,
      device: data.device ?? "all",
      adType: data.adType ?? "direct_banner",
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      clickUrl: data.clickUrl ?? null,
      code: data.code ?? null,
      imageUrl: data.imageUrl ?? null,
      memo: data.memo ?? null,
      isActive: data.isActive ?? true,
    })
    .returning({ id: adSlots.id, updatedAt: adSlots.updatedAt });

  return { id: inserted.id, isActive: data.isActive ?? true, updatedAt: inserted.updatedAt.toISOString() };
}

// ── 수정 ──────────────────────────────────────────────────────────────────────

export async function updateAd(id: string, data: AdminAdUpdateInput) {
  const db = getDb();

  const [target] = await db
    .select({ id: adSlots.id })
    .from(adSlots)
    .where(and(eq(adSlots.id, id), isNull(adSlots.deletedAt)))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("광고 슬롯을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.placement !== undefined) updateSet.placement = data.placement;
  if (data.device !== undefined) updateSet.device = data.device;
  if (data.adType !== undefined) updateSet.adType = data.adType;
  if (data.startDate !== undefined) updateSet.startDate = data.startDate;
  if (data.endDate !== undefined) updateSet.endDate = data.endDate;
  if (data.clickUrl !== undefined) updateSet.clickUrl = data.clickUrl;
  if (data.code !== undefined) updateSet.code = data.code;
  if (data.imageUrl !== undefined) updateSet.imageUrl = data.imageUrl;
  if (data.memo !== undefined) updateSet.memo = data.memo;
  if (data.isActive !== undefined) updateSet.isActive = data.isActive;

  const [updated] = await db
    .update(adSlots)
    .set(updateSet)
    .where(eq(adSlots.id, id))
    .returning({ id: adSlots.id, isActive: adSlots.isActive, updatedAt: adSlots.updatedAt });

  return {
    id: updated.id,
    isActive: updated.isActive,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── isActive 토글 ──────────────────────────────────────────────────────────────

export async function toggleAd(id: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: adSlots.id, isActive: adSlots.isActive })
    .from(adSlots)
    .where(and(eq(adSlots.id, id), isNull(adSlots.deletedAt)))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("광고 슬롯을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const [updated] = await db
    .update(adSlots)
    .set({ isActive: !target.isActive, updatedAt: new Date() })
    .where(eq(adSlots.id, id))
    .returning({ id: adSlots.id, isActive: adSlots.isActive, updatedAt: adSlots.updatedAt });

  return {
    id: updated.id,
    isActive: updated.isActive,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 소프트 삭제 (super_admin 전용) ────────────────────────────────────────────

export async function deleteAd(id: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: adSlots.id })
    .from(adSlots)
    .where(and(eq(adSlots.id, id), isNull(adSlots.deletedAt)))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("광고 슬롯을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(adSlots)
    .set({ deletedAt: now, isActive: false, updatedAt: now })
    .where(eq(adSlots.id, id))
    .returning({ id: adSlots.id, isActive: adSlots.isActive, updatedAt: adSlots.updatedAt });

  return {
    id: updated.id,
    isActive: updated.isActive,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 공개 API: placement로 활성 광고 반환 ─────────────────────────────────────

export async function getActiveAdByPlacement(placement: string) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: adSlots.id,
      code: adSlots.code,
      imageUrl: adSlots.imageUrl,
      clickUrl: adSlots.clickUrl,
      adType: adSlots.adType,
      device: adSlots.device,
    })
    .from(adSlots)
    .where(
      and(
        eq(adSlots.placement, placement),
        eq(adSlots.isActive, true),
        isNull(adSlots.deletedAt),
        // startDate 미지정이거나 오늘 이후
        sql`(${adSlots.startDate} IS NULL OR ${adSlots.startDate} <= ${today})`,
        // endDate 미지정이거나 오늘 이전
        sql`(${adSlots.endDate} IS NULL OR ${adSlots.endDate} >= ${today})`,
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// 타입 내보내기(unused warning 방지)
export { computeStatus };
