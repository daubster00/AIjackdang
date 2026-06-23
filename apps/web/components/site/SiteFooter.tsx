import Link from "next/link";
import styles from "./SiteFooter.module.css";

const footerGroups = [
  {
    title: "커뮤니티",
    links: ["바이브 코딩", "AI 자동화", "AI 수익화", "묻고답하기"],
  },
  {
    title: "자료실",
    links: ["프롬프트", "MCP·Skills", "Rules·설정", "템플릿·체크리스트"],
  },
  {
    title: "라운지",
    links: ["AI 창작마당", "내가 만든 AI 제품"],
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
                <a key={link} href="#">
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.bottom}>
        <span>© 2026 AI작당. All rights reserved.</span>
        <div>
          <a href="/notice">공지사항</a>
          <a href="#">이용약관</a>
          <a href="#">개인정보처리방침</a>
        </div>
      </div>
    </footer>
  );
}
