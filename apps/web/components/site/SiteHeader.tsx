"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, Dropdown, DropdownDivider, DropdownItem, Icon, RankBadge } from "@/components/ui";
import { useMockAuth } from "@/hooks/useMockAuth";
import type { MockUser } from "@/lib/mockAuth";
import styles from "./SiteHeader.module.css";

const navItems: {
  href: string;
  label: string;
  children: { label: string; href: string }[];
}[] = [
  {
    href: "/vibe-coding",
    label: "바이브 코딩",
    children: [
      { label: "바이브코딩 가이드", href: "/vibe-coding" },
      { label: "바이브코딩 팁", href: "/vibe-coding" },
    ],
  },
  {
    href: "/automation",
    label: "AI 자동화",
    children: [
      { label: "자동화 가이드", href: "/automation" },
      { label: "자동화 사례", href: "/automation" },
      { label: "자동화 팁", href: "/automation" },
    ],
  },
  {
    href: "/monetize",
    label: "AI 수익화",
    children: [
      { label: "외주·판매 팁", href: "/monetize" },
      { label: "수익화 사례", href: "/monetize" },
    ],
  },
  {
    href: "/questions",
    label: "묻고답하기",
    children: [],
  },
  {
    href: "/resources/mcp-skills",
    label: "실전자료",
    children: [
      { label: "프롬프트", href: "/resources/prompts" },
      { label: "MCP·Skills", href: "/resources/mcp-skills" },
      { label: "Rules·설정", href: "/resources/rules" },
      { label: "템플릿·체크리스트", href: "/resources/templates" },
    ],
  },
  {
    href: "/lounge",
    label: "작당 라운지",
    children: [
      { label: "AI 창작마당", href: "/lounge" },
      { label: "내가 만든 AI 제품", href: "/lounge/products" },
      { label: "작당 수다방", href: "/lounge/talk" },
      { label: "작당 의뢰소", href: "/lounge/gigs" },
    ],
  },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useMockAuth();

  function handleLogout() {
    logout();
    setOpen(false);
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="AI작당 홈">
          <img src="/logo.svg" alt="" className={styles.logo} />
        </Link>

        <nav className={styles.nav} aria-label="주요 메뉴">
          {navItems.map((item) => (
            <div key={item.href} className={styles.navItem}>
              <a className={styles.navLink} href={item.href}>
                {item.label}
                {item.children.length > 0 && <Icon name="arrow-down-s-line" />}
              </a>
              {item.children.length > 0 && (
                <div className={styles.submenu} role="menu">
                  {item.children.map((child) => (
                    <a key={child.label} href={child.href} role="menuitem">
                      {child.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={styles.authActions}>
          {user ? (
            <>
              <div className={styles.iconActions}>
                <IconAction href="/notifications" label="알림" icon="notification-3-line" count={3} />
                <IconAction href="/messages" label="쪽지함" icon="mail-line" count={1} />
              </div>
              <UserMenu user={user} onLogout={handleLogout} />
            </>
          ) : (
            <>
              <Link href="/login" className={styles.loginLink}>
                로그인
              </Link>
              <Link href="/signup" className={styles.signupLink}>
                회원가입
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className={styles.menuButton}
          aria-label={open ? "모바일 메뉴 닫기" : "모바일 메뉴 열기"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "close-line" : "menu-line"} />
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className={styles.mobilePanel}>
          <nav className={styles.mobileNav} aria-label="모바일 주요 메뉴">
            {navItems.map((item) => (
              <div key={item.href} className={styles.mobileGroup}>
                <a href={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                </a>
                {item.children.length > 0 && (
                  <div className={styles.mobileSubmenu}>
                    {item.children.map((child) => (
                      <a key={child.label} href={child.href} onClick={() => setOpen(false)}>
                        {child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          {user ? (
            <div className={styles.mobileUserBar}>
              <div className={styles.mobileUser}>
                <Avatar name={user.nickname} size="sm" />
                <div className={styles.mobileUserText}>
                  <span className={styles.mobileUserName}>{user.nickname}</span>
                  <RankBadge rank={user.rank} size={16} showLabel />
                </div>
              </div>
              <div className={styles.mobileUserActions}>
                <IconAction href="/notifications" label="알림" icon="notification-3-line" count={3} />
                <IconAction href="/messages" label="쪽지함" icon="mail-line" count={1} />
                <button type="button" className={styles.mobileLogout} onClick={handleLogout}>
                  <Icon name="logout-box-r-line" />
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.mobileAuth}>
              <Link href="/login" onClick={() => setOpen(false)}>
                로그인
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)}>
                회원가입
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

/** 알림·쪽지함처럼 미확인 개수 뱃지가 달린 아이콘 버튼(링크). count>0 일 때만 뱃지 표시. */
function IconAction({
  href,
  label,
  icon,
  count = 0,
}: {
  href: string;
  label: string;
  icon: string;
  count?: number;
}) {
  // 미확인 개수를 접근성 라벨에도 반영한다.
  const ariaLabel = count > 0 ? `${label} (안 읽음 ${count}개)` : label;
  return (
    <Link href={href} className={styles.iconAction} aria-label={ariaLabel}>
      <Icon name={icon} />
      {count > 0 && (
        <span className={styles.iconBadge} aria-hidden="true">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

/** 로그인 상태일 때 헤더 우측에 표시되는 프로필 메뉴(아바타 + 닉네임 + 등급 + 드롭다운). */
function UserMenu({ user, onLogout }: { user: MockUser; onLogout: () => void }) {
  return (
    <Dropdown
      align="end"
      trigger={
        <button type="button" className={styles.userTrigger} aria-label="내 계정 메뉴">
          <Avatar name={user.nickname} size="sm" />
          <span className={styles.userName}>{user.nickname}</span>
          <Icon name="arrow-down-s-line" />
        </button>
      }
    >
      <div className={styles.userSummary}>
        <Avatar name={user.nickname} size="md" />
        <div className={styles.userSummaryText}>
          <span className={styles.userSummaryName}>{user.nickname}</span>
          <RankBadge rank={user.rank} size={18} showLabel />
        </div>
      </div>
      <DropdownDivider />
      <DropdownItem href="/mypage">
        <Icon name="user-line" /> 마이페이지
      </DropdownItem>
      <DropdownItem href="/mypage">
        <Icon name="article-line" /> 내가 쓴 글
      </DropdownItem>
      <DropdownItem href="/mypage">
        <Icon name="bookmark-line" /> 북마크
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem danger onClick={onLogout}>
        <Icon name="logout-box-r-line" /> 로그아웃
      </DropdownItem>
    </Dropdown>
  );
}
