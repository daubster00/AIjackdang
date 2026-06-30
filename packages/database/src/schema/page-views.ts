/**
 * 방문 로그 스키마 — 관리자 접속통계(접속통계·대시보드 방문자 추이) 실데이터용.
 *
 * page_views 테이블: 유저 웹의 페이지 진입을 1행씩 적재한다.
 * - visitorId(브라우저별 익명 식별자, 쿠키 기반 해시): 고유 방문자 집계용
 * - userId(로그인 시 유저 id, 비로그인 null): 신규/재방문 구분 및 가입전환 분석용
 * - referrerHost(유입 도메인): 유입경로(검색/SNS/직접) 분류용
 * - searchKeyword(사이트 내부 검색 유입어): 검색 키워드 분석용
 *
 * 적재는 공개 엔드포인트 POST /api/v1/analytics/collect (adminGuard 미적용)에서 수행한다.
 * 신규 데이터는 적재 시점부터 누적되므로, 도입 직후에는 추이가 희소할 수 있다.
 */

import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const pageViews = pgTable(
  "page_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 방문한 경로 (예: /automation/some-slug) — 쿼리스트링 제외 */
    path: text("path").notNull(),
    /** 브라우저별 익명 방문자 식별자 (쿠키 기반). 고유 방문자 수 집계용 */
    visitorId: text("visitor_id").notNull(),
    /** 로그인 유저 id (비로그인은 null) */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** 원본 referrer 전체 URL (없으면 null = 직접 유입) */
    referrer: text("referrer"),
    /** referrer의 호스트만 추출 (유입경로 분류용, 예: google.com) */
    referrerHost: text("referrer_host"),
    /** 사이트 내부 검색 유입 키워드 (검색 결과 페이지 진입 시) */
    searchKeyword: text("search_keyword"),
    /** 페이지 체류 시간(ms) — 페이지 이탈 시 sendBeacon 으로 갱신. 미측정은 null */
    dwellMs: integer("dwell_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("page_views_created_at_idx").on(t.createdAt),
    index("page_views_visitor_id_idx").on(t.visitorId),
    index("page_views_referrer_host_idx").on(t.referrerHost),
    index("page_views_search_keyword_idx").on(t.searchKeyword),
  ],
);

export type PageViewRow = typeof pageViews.$inferSelect;
export type NewPageViewRow = typeof pageViews.$inferInsert;
