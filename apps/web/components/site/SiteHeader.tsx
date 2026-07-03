"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, Dropdown, DropdownDivider, DropdownItem, Icon, RankBadge } from "@/components/ui";
import { useAuth, type AuthUser } from "@/hooks/useAuth";
import { useNotificationCount } from "@/contexts/NotificationCountContext";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useMyGamification } from "@/hooks/useMyGamification";
import { resolveAvatarUrl } from "@/lib/avatar";
import { rankTierFromGradeLevel, type RankTier } from "@/lib/ranks";
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
      { label: "바이브코딩 팁", href: "/vibe-coding?board=vibe-coding-tips" },
    ],
  },
  {
    href: "/automation",
    label: "AI 자동화",
    children: [
      { label: "자동화 가이드", href: "/automation" },
      { label: "자동화 사례", href: "/automation?board=automation-cases" },
      { label: "자동화 팁", href: "/automation?board=automation-tips" },
    ],
  },
  {
    href: "/monetize",
    label: "AI 수익화",
    children: [
      { label: "외주·판매 팁", href: "/monetize" },
      { label: "수익화 사례", href: "/monetize?board=monetization-cases" },
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
      { label: "공지사항", href: "/notice" },
      { label: "AI 창작마당", href: "/lounge" },
      { label: "내가 만든 AI 제품", href: "/lounge/products" },
      { label: "작당 수다방", href: "/lounge/talk" },
      { label: "작당 의뢰소", href: "/lounge/gigs" },
    ],
  },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  // 모바일 메뉴에서 현재 펼쳐진 대메뉴 href. null이면 모두 접힘(아코디언).
  const [expanded, setExpanded] = useState<string | null>(null);
  const router = useRouter();
  const { user, logout } = useAuth();
  const { count: unreadCount } = useNotificationCount();
  const { count: unreadMessages } = useUnreadMessages(!!user);
  const gamification = useMyGamification(!!user);
  const rank: RankTier = gamification ? rankTierFromGradeLevel(gamification.gradeLevel) : "rookie";

  function closeMobile() {
    setOpen(false);
    setExpanded(null);
  }

  async function handleLogout() {
    await logout();
    closeMobile();
    router.push("/");
    router.refresh();
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
              <a className={styles.navLink} href={item.children[0]?.href ?? item.href}>
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
                <IconAction href="/notifications" label="알림" icon="notification-3-line" count={unreadCount} />
                <IconAction href="/messages" label="쪽지함" icon="mail-line" count={unreadMessages} />
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
          {/* 상단: 인증 영역 (로고·X 버튼 아래, 메뉴 목록 위) */}
          {user ? (
            <div className={styles.mobileUserBar}>
              <div className={styles.mobileUserTop}>
                <div className={styles.mobileUser}>
                  <Avatar name={user.nickname} src={resolveAvatarUrl(user)} size="sm" />
                  <div className={styles.mobileUserText}>
                    <span className={styles.mobileUserName}>{user.nickname}</span>
                    <RankBadge rank={rank} size={16} showLabel />
                  </div>
                </div>
                <div className={styles.mobileUserActions}>
                  <IconAction href="/notifications" label="알림" icon="notification-3-line" count={unreadCount} />
                  <IconAction href="/messages" label="쪽지함" icon="mail-line" count={unreadMessages} />
                  <button type="button" className={styles.mobileLogout} onClick={handleLogout}>
                    <Icon name="logout-box-r-line" />
                    로그아웃
                  </button>
                </div>
              </div>
              {/* 포인트: 아이콘 + 현재 포인트 */}
              <Link href="/points" className={styles.mobilePoints} onClick={closeMobile}>
                <span className={styles.mobilePointsLabel}>
                  <Icon name="coin-line" /> 포인트
                </span>
                <span className={styles.mobilePointsValue}>
                  {(gamification?.totalPoints ?? 0).toLocaleString()}P
                </span>
              </Link>
            </div>
          ) : (
            <div className={styles.mobileAuth}>
              <Link href="/login" onClick={closeMobile}>
                로그인
              </Link>
              <Link href="/signup" onClick={closeMobile}>
                회원가입
              </Link>
            </div>
          )}

          {/* 대메뉴: 클릭하면 아코디언으로 펼쳐지며 하위메뉴가 세로로 노출 */}
          <nav className={styles.mobileNav} aria-label="모바일 주요 메뉴">
            {navItems.map((item) => {
              const hasChildren = item.children.length > 0;
              const isOpen = expanded === item.href;
              return (
                <div key={item.href} className={styles.mobileGroup}>
                  {hasChildren ? (
                    <button
                      type="button"
                      className={styles.mobileGroupToggle}
                      aria-expanded={isOpen}
                      onClick={() => setExpanded((cur) => (cur === item.href ? null : item.href))}
                    >
                      {item.label}
                      <Icon
                        name="arrow-down-s-line"
                        className={isOpen ? styles.mobileChevronOpen : styles.mobileChevron}
                      />
                    </button>
                  ) : (
                    <a className={styles.mobileGroupLink} href={item.href} onClick={closeMobile}>
                      {item.label}
                    </a>
                  )}
                  {hasChildren && isOpen && (
                    <div className={styles.mobileSubmenu}>
                      {item.children.map((child) => (
                        <a key={child.label} href={child.href} onClick={closeMobile}>
                          {child.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* 하단: 계정 관련 바로가기 (로그인 상태 전용) */}
          {user && (
            <div className={styles.mobileAccount}>
              <Link href={`/u/${encodeURIComponent(user.nickname)}`} onClick={closeMobile}>
                <Icon name="account-circle-line" /> 나의 계정
              </Link>
              <Link href="/mypage" onClick={closeMobile}>
                <Icon name="user-line" /> 마이페이지
              </Link>
              <Link href="/settings/membership" onClick={closeMobile}>
                <Icon name="user-settings-line" /> 회원정보
              </Link>
              <Link href="/inquiries" onClick={closeMobile}>
                <Icon name="question-answer-line" /> 1:1문의
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

/**
 * 로그인 상태일 때 헤더 우측에 표시되는 프로필 메뉴(아바타 + 닉네임 + 등급 + 드롭다운).
 * rank는 게이미피케이션 API 구현 후 연동 예정. 현재는 "member"로 임시 표시.
 */
function UserMenu({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <Dropdown
      align="end"
      trigger={
        <button type="button" className={styles.userTrigger} aria-label="내 계정 메뉴">
          <Avatar name={user.nickname} src={resolveAvatarUrl(user)} size="sm" />
          <span className={styles.userName}>{user.nickname}</span>
          <Icon name="arrow-down-s-line" />
        </button>
      }
    >
      <div className={styles.userSummary}>
        <Avatar name={user.nickname} src={resolveAvatarUrl(user)} size="md" />
        <div className={styles.userSummaryText}>
          <span className={styles.userSummaryName}>{user.nickname}</span>
          <RankBadge rank={"member" as RankTier} size={18} showLabel />
        </div>
      </div>
      <DropdownDivider />
      <DropdownItem href={`/u/${encodeURIComponent(user.nickname)}`}>
        <Icon name="account-circle-line" /> 내 계정
      </DropdownItem>
      <DropdownItem href="/mypage">
        <Icon name="user-line" /> 마이페이지
      </DropdownItem>
      <DropdownItem href="/settings/membership">
        <Icon name="user-settings-line" /> 회원정보
      </DropdownItem>
      <DropdownItem href="/inquiries">
        <Icon name="question-answer-line" /> 1:1문의
      </DropdownItem>
      <DropdownItem href="/points">
        <Icon name="coin-line" /> 포인트
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem danger onClick={onLogout}>
        <Icon name="logout-box-r-line" /> 로그아웃
      </DropdownItem>
    </Dropdown>
  );
}
