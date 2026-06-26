"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";
import styles from "./settings.module.css";

/** 설정 페이지 내 탭 내비게이션 항목 */
const NAV_ITEMS = [
  { href: "/settings/profile", label: "프로필 수정", icon: "user-line" },
  { href: "/settings/membership", label: "회원정보", icon: "id-card-line" },
] as const;

/**
 * 설정 섹션 상단에 표시되는 탭 내비게이션.
 * 현재 경로에 해당하는 탭을 활성 상태로 표시한다.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.settingsNav} aria-label="설정 탭 메뉴">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.settingsNavItem}${isActive ? ` ${styles.settingsNavItemActive}` : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
