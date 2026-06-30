"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BOARDS } from "@/lib/boards";
import { API_BASE_URL } from "@/lib/api";
import type { AdminSessionUser } from "@/lib/adminSession";
import { AdminInteractions } from "./AdminInteractions";
import { NotificationMenu } from "./NotificationMenu";
import { HelpMenu } from "./HelpMenu";
import { AdminAccountMenu } from "./AdminAccountMenu";

/**
 * 관리자 기본 레이아웃 — @ai-jakdang/admin-design-system 의 .app-shell 마크업을 사용한다.
 * 사이드바(브랜드/메뉴/프로필) + 상단바(검색/알림) + 본문 .page 컨테이너를 제공한다.
 * 사용자 사이트(apps/web)의 레이아웃/CSS 는 가져오지 않는다(관리자 전용).
 *
 * adminUser: 세션 사용자 정보. 미전달 시 getAdminSession()으로 내부 조회(AC#7).
 * pendingReportsCount: 미처리 신고 수. 0이면 배지 미표시, 1 이상이면 danger pill(UX-DR-A1).
 */

type NavItem = {
  key: string;
  href: string;
  icon: string;
  label: string;
  badge?: string;
  subKey?: string;
  children?: NavItem[];
};
type NavGroup = { label: string; items: NavItem[] };

const POSTS_CHILDREN: NavItem[] = [
  { key: "posts-all", href: "/posts", icon: "ri-list-check", label: "전체", subKey: "" },
  ...BOARDS.map((b) => ({
    key: `posts-${b.slug}`,
    href: `/posts/${b.slug}`,
    icon: "ri-bookmark-line",
    label: b.label,
    subKey: b.slug,
  })),
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", href: "/dashboard", icon: "ri-dashboard-line", label: "대시보드" },
      { key: "stats", href: "/stats", icon: "ri-line-chart-line", label: "접속 통계" },
    ],
  },
  {
    label: "Content",
    items: [
      { key: "posts", href: "/posts", icon: "ri-article-line", label: "게시글 관리", children: POSTS_CHILDREN },
      { key: "qna", href: "/qna", icon: "ri-question-answer-line", label: "묻고답하기 관리" },
      { key: "resources", href: "/resources", icon: "ri-folder-download-line", label: "실전자료 관리" },
      { key: "comments", href: "/comments", icon: "ri-chat-3-line", label: "댓글·후기 관리" },
    ],
  },
  {
    label: "Operation",
    items: [
      { key: "reports", href: "/reports", icon: "ri-alarm-warning-line", label: "신고 관리" },
      { key: "messages", href: "/messages", icon: "ri-mail-line", label: "쪽지 관리" },
      { key: "inquiries", href: "/inquiries", icon: "ri-customer-service-2-line", label: "문의 관리" },
      { key: "members", href: "/members", icon: "ri-user-settings-line", label: "유저 회원 관리" },
      {
        key: "admin-members",
        href: "/admin-members",
        icon: "ri-shield-user-line",
        label: "관리회원 관리",
        children: [
          { key: "admin-members-list", href: "/admin-members", icon: "ri-group-line", label: "관리회원", subKey: "" },
          { key: "admin-members-grades", href: "/admin-members/grades", icon: "ri-award-line", label: "관리자 역할", subKey: "grades" },
          { key: "admin-members-perms", href: "/admin-members/permissions", icon: "ri-key-2-line", label: "권한 설정", subKey: "permissions" },
        ],
      },
    ],
  },
  {
    label: "Engagement",
    items: [
      { key: "points", href: "/points", icon: "ri-copper-coin-line", label: "포인트 관리" },
      { key: "ranks", href: "/ranks", icon: "ri-medal-line", label: "등급 관리" },
    ],
  },
  {
    label: "Business",
    items: [
      { key: "ads", href: "/ads", icon: "ri-advertisement-line", label: "광고 관리" },
      { key: "settings", href: "/settings", icon: "ri-settings-3-line", label: "사이트 설정" },
    ],
  },
];

/** super_admin 전용으로 숨길 메뉴 key 집합(UX-DR-A6: 숨김, disabled 아님) */
const SUPER_ADMIN_ONLY_KEYS = new Set(["ads", "settings", "admin-members"]);

export function AdminShell({
  breadcrumb,
  activeKey,
  activeSubKey,
  adminUser: adminUserProp,
  pendingReportsCount = 0,
  children,
}: {
  /** 상단바 경로 표시. 마지막 항목이 현재 위치로 강조된다. */
  breadcrumb: string[];
  /** 현재 활성 메뉴 key (NAV_GROUPS 의 item.key) */
  activeKey: string;
  /**
   * 현재 활성 하위 메뉴 키(선택). 게시글 관리 서브메뉴에서 child.subKey 와 일치하면 active 강조.
   * 예: "/posts/vibe-tip" 페이지면 activeSubKey="vibe-tip", "/posts"(전체)면 activeSubKey=""(빈 문자열).
   */
  activeSubKey?: string;
  /**
   * 현재 로그인한 관리자 세션(선택). 미전달 시 getAdminSession()으로 내부 조회(AC#7).
   * 사이드바 프로필 및 메뉴 필터링에 사용한다.
   */
  adminUser?: AdminSessionUser | null;
  /**
   * 미처리 신고 수(선택). 0이면 배지 미표시, 1 이상이면 danger pill 표시(UX-DR-A1).
   * 기본값 0. 9.5/9.6에서 실집계로 교체 예정.
   */
  pendingReportsCount?: number;
  children: ReactNode;
}) {
  // adminUser prop 미전달 시 클라이언트에서 세션 조회(AC#7).
  // 서버 컴포넌트가 직접 값을 내려준 경우(undefined 가 아님)에는 그 값을 그대로 사용한다.
  const [fetchedUser, setFetchedUser] = useState<AdminSessionUser | null>(null);
  useEffect(() => {
    if (adminUserProp !== undefined) return; // 서버에서 주입됨 → fetch 불필요
    let active = true;
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setFetchedUser((d?.user as AdminSessionUser) ?? null); })
      .catch(() => { if (active) setFetchedUser(null); });
    return () => { active = false; };
  }, [adminUserProp]);
  const adminUser = adminUserProp !== undefined ? adminUserProp : fetchedUser;

  const crumbs = breadcrumb.length ? breadcrumb : ["관리자"];
  const role = adminUser?.role ?? "super_admin"; // 세션 없으면 super_admin으로 간주(미들웨어가 보호)

  /** role에 따라 접근 가능한 그룹/항목만 필터링(UX-DR-A6) */
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !SUPER_ADMIN_ONLY_KEYS.has(item.key) || role === "super_admin"),
  })).filter((group) => group.items.length > 0);

  /** 사이드바 프로필 표시 정보 */
  const profileName = adminUser?.name ?? "관리자";
  const profileRole = role === "super_admin" ? "Super Admin" : "Staff";
  const profileInitial = profileName.charAt(0) || "관";

  return (
    <div className="app-shell" id="appShell">
      <aside className="sidebar" id="sidebar" aria-label="관리자 주 메뉴">
        <div className="sidebar-brand">
          <img className="brand-logo" src="/logo-mark.svg" alt="AI작당" width={34} height={34} />
          <div className="brand-copy">
            <strong className="brand-title">AI작당 Admin</strong>
            <span className="brand-subtitle">운영 관리자</span>
          </div>
          <button className="icon-button" data-admin-sidebar-toggle aria-label="사이드바 축소">
            <i className="ri-contract-left-line" />
          </button>
        </div>

        <div className="sidebar-scroll">
          <nav>
            {visibleGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                <div className="nav-label">{group.label}</div>
                {group.items.map((item) => {
                  const parentActive = item.key === activeKey;
                  // 신고 관리 배지: pendingReportsCount > 0 이면 danger pill(UX-DR-A1)
                  const reportsCount = item.key === "reports" ? pendingReportsCount : 0;
                  const badgeText = reportsCount > 0 ? String(reportsCount) : (item.badge ?? null);
                  const isDanger = item.key === "reports" && reportsCount > 0;
                  return (
                    <div key={item.key}>
                      <a className={`nav-item${parentActive ? " active" : ""}`} href={item.href}>
                        <i className={item.icon} />
                        <span>{item.label}</span>
                        {badgeText ? (
                          <span
                            className="nav-badge"
                            style={isDanger ? { background: "var(--danger)", color: "#fff" } : undefined}
                          >
                            {badgeText}
                          </span>
                        ) : null}
                        {item.children ? (
                          <i
                            className={parentActive ? "ri-arrow-down-s-line" : "ri-arrow-right-s-line"}
                            style={{ marginLeft: "auto", fontSize: 16 }}
                            aria-hidden="true"
                          />
                        ) : null}
                      </a>

                      {item.children && parentActive ? (
                        <div style={{ marginTop: 3, paddingLeft: 16 }}>
                          {item.children.map((child) => {
                            const childActive = child.subKey === (activeSubKey ?? "");
                            return (
                              <a
                                key={child.key}
                                className={`nav-item${childActive ? " active" : ""}`}
                                href={child.href}
                                style={{ minHeight: 34, fontSize: 13 }}
                              >
                                <i className={child.icon} style={{ fontSize: 15 }} />
                                <span>{child.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="admin-profile">
            <div className="avatar">{profileInitial}</div>
            <div className="profile-copy">
              <span className="profile-name">{profileName}</span>
              <span className="profile-role">{profileRole}</span>
            </div>
            <button className="icon-button" aria-label="프로필 메뉴">
              <i className="ri-more-2-fill" />
            </button>
          </div>
        </div>
      </aside>

      <div className="mobile-backdrop" />

      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button mobile-menu" data-admin-mobile-menu aria-label="메뉴 열기">
            <i className="ri-menu-line" />
          </button>
          <div className="breadcrumb">
            {crumbs.map((c, i) =>
              i === crumbs.length - 1 ? (
                <strong key={i}>{c}</strong>
              ) : (
                <span key={i} style={{ display: "contents" }}>
                  <span>{c}</span>
                  <i className="ri-arrow-right-s-line" />
                </span>
              ),
            )}
          </div>
        </div>
        <div className="topbar-right">
          <div className="global-search">
            <i className="ri-search-line" />
            <input type="search" placeholder="메뉴, 회원, 게시글 검색" aria-label="전체 검색" />
            <span className="search-shortcut">Ctrl K</span>
          </div>
          <NotificationMenu />
          <HelpMenu />
          <AdminAccountMenu />
        </div>
      </header>

      <main className="main">
        <div className="page">{children}</div>
      </main>

      <AdminInteractions />
    </div>
  );
}
