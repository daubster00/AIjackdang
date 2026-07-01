import Link from "next/link";
import styles from "./SiteFooter.module.css";

const footerGroups = [
  {
    title: "커뮤니티",
    links: [
      { label: "바이브 코딩", href: "/vibe-coding" },
      { label: "AI 자동화", href: "/automation" },
      { label: "AI 수익화", href: "/monetize" },
      { label: "묻고답하기", href: "/questions" },
    ],
  },
  {
    title: "자료실",
    links: [
      { label: "프롬프트", href: "/resources/prompts" },
      { label: "MCP·Skills", href: "/resources/mcp-skills" },
      { label: "Rules·설정", href: "/resources/rules" },
      { label: "템플릿·체크리스트", href: "/resources/templates" },
    ],
  },
  {
    title: "작당 라운지",
    links: [
      { label: "AI 창작마당", href: "/lounge" },
      { label: "내가 만든 AI 제품", href: "/lounge/products" },
      { label: "작당 수다방", href: "/lounge/talk" },
      { label: "작당 의뢰소", href: "/lounge/gigs" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <Link href="/" className={styles.brand}>
            <img src="/logo.svg" alt="" />
          </Link>
          <p>AI로 만들고, 자동화하고, 돈으로 연결하는 실전 커뮤니티</p>
        </div>

        <div className={styles.linkGroups}>
          {footerGroups.map((group) => (
            <div key={group.title} className={styles.group}>
              <strong>{group.title}</strong>
              {group.links.map((link) => (
                <Link key={link.label} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.bottom}>
        <span>© 2026 AI작당. All rights reserved.</span>
        <div>
          <Link href="/notice">공지사항</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/operation-policy">운영정책</Link>
        </div>
      </div>
    </footer>
  );
}
