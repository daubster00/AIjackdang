/**
 * LegalPageLayout — 약관·방침 페이지 공통 레이아웃 컴포넌트 (서버 컴포넌트)
 *
 * - H1 + 버전/시행일 메타 헤더
 * - 좌측 본문(흰 카드) + 우측 sticky 목차(ToC, 흰 배경 박스, 스크롤 추종) (데스크톱)
 * - 모바일(<768px): 목차는 static 상단 배치
 * - <main id="main">으로 본문 바로가기 대상 (AC #6)
 */

import type { LegalSection } from "@/app/(legal)/_content/terms";
import styles from "./LegalPageLayout.module.css";

interface LegalPageLayoutProps {
  title: string;
  sections: LegalSection[];
  version: string;
  effectiveDate: string;
}

export function LegalPageLayout({
  title,
  sections,
  version,
  effectiveDate,
}: LegalPageLayoutProps) {
  return (
    <main id="main" className={styles.main}>
      <div className={styles.container}>
        <div className={styles.layout}>
          {/* 좌측: 본문 카드 (헤더 + 섹션 본문) */}
          <article className={styles.article}>
            {/* 헤더: H1 + 버전/시행일 메타 */}
            <header className={styles.header}>
              <h1 className={styles.title}>{title}</h1>
              <p className={styles.meta}>
                버전 {version} &middot; 시행일 {effectiveDate}
              </p>
            </header>

            {/* 본문: 섹션별 H2 + body */}
            <div className={styles.body}>
              {sections.map((section) => (
                <section key={section.id} id={section.id} className={styles.section}>
                  <h2 className={styles.sectionHeading}>{section.heading}</h2>
                  <div
                    className={styles.sectionBody}
                    /* eslint-disable-next-line react/no-danger */
                    dangerouslySetInnerHTML={{ __html: section.body }}
                  />
                </section>
              ))}
            </div>
          </article>

          {/* 우측: 목차(ToC) — 흰 배경 박스, 데스크톱은 sticky 스크롤 추종, 모바일은 static 상단 */}
          <nav className={styles.toc} aria-label="목차">
            <p className={styles.tocTitle}>목차</p>
            <ol className={styles.tocList}>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className={styles.tocLink}>
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </main>
  );
}
