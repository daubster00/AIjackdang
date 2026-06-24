import Link from "next/link";
import { Icon } from "@/components/ui";
import styles from "./BoardHero.module.css";
import { boardHeroes, mainMenus, type BoardHeroKey } from "./heroConfig";

type BoardHeroProps = {
  /** 어느 대메뉴의 히어로를 불러올지 (예: "vibe-coding") */
  menu: BoardHeroKey;
  /** 현재 페이지가 속한 소메뉴(게시판) 라벨. 브레드크럼에서 현재 위치로 표시된다. */
  currentSub: string;
  /**
   * 히어로 타이틀의 HTML 태그. 기본값: "h1".
   * 상세 페이지처럼 페이지 내에 별도 <h1>이 존재하는 경우 "h2"로 강등하여
   * 페이지당 <h1> 1개 SEO 규칙을 준수한다(Story 2.10 AC #1).
   */
  titleAs?: "h1" | "h2";
};

/**
 * 대메뉴별 공통 히어로 섹션.
 * 목록/상세/글쓰기 등 같은 대메뉴에 속한 모든 페이지가 이 컴포넌트를 불러와 사용한다.
 * 같은 대메뉴라면 모든 페이지에서 완전히 동일하게 렌더된다.
 */
export function BoardHero({ menu, currentSub, titleAs: TitleTag = "h1" }: BoardHeroProps) {
  const config = boardHeroes[menu];
  // 배경 미디어가 영상(.mp4)이면 자동재생 video로, 이미지면 img로 렌더한다.
  const isVideo = config.media.endsWith(".mp4");

  return (
    <section className={styles.hero} aria-labelledby="board-hero-title">
      {isVideo ? (
        <video
          className={styles.heroVideo}
          src={config.media}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.heroVideo} src={config.media} alt="" aria-hidden="true" />
      )}
      <div className={styles.heroOverlay} aria-hidden="true" />
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <span>{config.eyebrow}</span>
          <TitleTag id="board-hero-title">{config.title}</TitleTag>
          <p>{config.description}</p>
          <nav className={styles.breadcrumb} aria-label="현재 위치">
            <Link href="/" className={styles.homeCrumb} aria-label="홈">
              <Icon name="home-5-line" />
            </Link>
            <Icon name="arrow-right-s-line" className={styles.crumbDivider} />
            <details className={styles.crumbMenu}>
              <summary>
                {config.mainLabel}
                <Icon name="arrow-down-s-line" />
              </summary>
              <div className={styles.crumbDropdown}>
                {mainMenus.map((item) => (
                  <Link key={item.label} href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
            <Icon name="arrow-right-s-line" className={styles.crumbDivider} />
            <details className={`${styles.crumbMenu} ${styles.currentCrumb}`}>
              <summary>
                {currentSub}
                <Icon name="arrow-down-s-line" />
              </summary>
              <div className={styles.crumbDropdown}>
                {config.subMenus.map((item) => (
                  <Link key={item.label} href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          </nav>
        </div>
      </div>
    </section>
  );
}
