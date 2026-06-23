import Link from "next/link";
import { Icon } from "@/components/ui";
import styles from "./BoardHero.module.css";
import { boardHeroes, mainMenus, type BoardHeroKey } from "./heroConfig";

type BoardHeroProps = {
  /** 어느 대메뉴의 히어로를 불러올지 (예: "vibe-coding") */
  menu: BoardHeroKey;
  /** 현재 페이지가 속한 소메뉴(게시판) 라벨. 브레드크럼에서 현재 위치로 표시된다. */
  currentSub: string;
};

/**
 * 대메뉴별 공통 히어로 섹션.
 * 목록/상세/글쓰기 등 같은 대메뉴에 속한 모든 페이지가 이 컴포넌트를 불러와 사용한다.
 * 같은 대메뉴라면 모든 페이지에서 완전히 동일하게 렌더된다.
 */
export function BoardHero({ menu, currentSub }: BoardHeroProps) {
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
          <h1 id="board-hero-title">{config.title}</h1>
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
