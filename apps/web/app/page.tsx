import Link from "next/link";
import { Badge, Card, CardDesc, CardHead, CardMeta, CardTitle, Icon, Tag } from "@/components/ui";
import { RankingWidget } from "@/features/gamification/RankingWidget";
import styles from "./page.module.css";

const popularPosts = [
  {
    id: "vibe-coding",
    category: "바이브 코딩 인기글",
    title: "Claude Code로 기존 PHP 프로젝트 수정하는 작업 흐름",
    desc: "코드베이스 분석, 수정 요청 작성, 결과 검수까지 실무에서 바로 쓰는 진행 방식입니다.",
    icon: "code-ai-line",
    metric: "인기",
    tags: ["Claude Code", "PHP", "검수"],
  },
  {
    id: "automation",
    category: "AI 자동화 인기글",
    title: "n8n으로 고객 문의를 자동 분류하고 담당자에게 배정하기",
    desc: "메일과 폼으로 들어온 문의를 요약, 분류, 알림까지 연결한 자동화 사례입니다.",
    icon: "flow-chart",
    metric: "인기",
    tags: ["n8n", "문의 분류", "알림"],
  },
  {
    id: "monetize",
    category: "AI 수익화 인기글",
    title: "AI 자동화 외주 견적을 산정할 때 보는 기준",
    desc: "작업 범위, 유지보수, 실패 대응까지 포함해 견적을 잡는 기준을 정리했습니다.",
    icon: "funds-line",
    metric: "인기",
    tags: ["외주", "견적", "자동화 구축"],
  },
];

const resources = [
  {
    title: "quality-review-skill.zip",
    desc: "Claude Code에서 코드 리뷰 기준을 반복 적용하기 위한 Skill 패키지입니다.",
    meta: "Claude Code Skill",
    tone: "primary" as const,
    stats: "다운로드 312 · 평점 4.8",
  },
  {
    title: "github-mcp-guide.zip",
    desc: "MCP 서버 설정, 설치 명령어, 사용 예시, 보안 주의사항을 묶은 자료입니다.",
    meta: "MCP·Skills",
    tone: "success" as const,
    stats: "다운로드 228 · 평점 4.9",
  },
  {
    title: "cursor-php-rules.zip",
    desc: "기존 PHP 프로젝트에서 Cursor Rules로 컨벤션과 작업 범위를 고정하는 설정 파일입니다.",
    meta: "Rules·설정",
    tone: "info" as const,
    stats: "다운로드 186 · 평점 4.7",
  },
];

const questions = [
  "Cursor와 Claude Code 중 기존 프로젝트 수정에는 뭐가 더 나을까요?",
  "n8n 자동화가 실패했을 때 알림을 받는 구조를 어떻게 짜야 하나요?",
  "제가 만든 AI 결과물을 판매해도 되는지 검토 기준이 궁금합니다.",
];

const creativePosts = [
  {
    title: "구름 위 네온 도시",
    desc: "AI로 만든 상상 속 공중도시 이미지",
    image: "/lounge/ai-creative-1.png",
    stats: { likes: 128, views: "2.1k", comments: 24 },
  },
  {
    title: "벽화를 그리는 로봇",
    desc: "로봇이 빛으로 그림을 그리는 장면",
    image: "/lounge/ai-creative-2.png",
    stats: { likes: 96, views: "1.7k", comments: 18 },
  },
  {
    title: "디저트 행성 노트북",
    desc: "간식 우주를 떠다니는 작은 행성들",
    image: "/lounge/ai-creative-3.png",
    stats: { likes: 84, views: "1.3k", comments: 12 },
  },
  {
    title: "회로 숲을 달리는 기차",
    desc: "마법 같은 기술 숲을 지나가는 미니 기차",
    image: "/lounge/ai-creative-4.png",
    stats: { likes: 142, views: "2.4k", comments: 31 },
  },
];

export default function HomePage() {
  return (
    <main id="main" className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <video
          className={styles.heroVideo}
          src="/Office_scene_with_subtle_movements_202606171218.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <Badge tone="primary" variant="solid">
            <Icon name="sparkling-2-line" />
            실전 AI 커뮤니티
          </Badge>
          <h1 id="hero-title">AI로 만들고 자동화하고 수익화하는 사람들의 작업장</h1>
          <p>
            AI작당은 바이브 코딩, 업무 자동화, AI 수익화를 실제로 시도하는 사람들이 경험과 자료,
            막힌 질문을 함께 쌓아가는 커뮤니티입니다.
          </p>
          <div className={styles.heroActions}>
            <Link href="#resources" className={styles.primaryLink}>
              실전자료 보기
              <Icon name="arrow-right-line" />
            </Link>
            <Link href="#questions" className={styles.secondaryLink}>
              묻고답하기
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.popularBand} aria-labelledby="category-title">
        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Popular</span>
              <h2 id="category-title">실전 인기글</h2>
              <p>
                바이브 코딩, AI 자동화, AI 수익화에서 지금 가장 많이 읽히는 글을 바로 확인하세요.
              </p>
            </div>
            <Link href="#" className={styles.moreLink}>
              더보기
              <Icon name="arrow-right-line" />
            </Link>
          </div>
          <div className={styles.categoryGrid}>
            {popularPosts.map((post, index) => (
              <Card
                key={post.id}
                id={post.id}
                variant={index === 0 ? "highlight" : index === 1 ? "resource" : "question"}
                interactive
                className={styles.categoryCard}
              >
                <CardHead>
                  <span className={styles.categoryIcon}>
                    <Icon name={post.icon} />
                  </span>
                  <Badge tone={index === 0 ? "primary" : index === 1 ? "success" : "warning"}>
                    {post.metric}
                  </Badge>
                </CardHead>
                <p className={styles.cardKicker}>{post.category}</p>
                <CardTitle>{post.title}</CardTitle>
                <CardDesc>{post.desc}</CardDesc>
                <CardMeta>
                  {post.tags.map((tag) => (
                    <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                      {tag}
                    </Tag>
                  ))}
                </CardMeta>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="resources" className={styles.resourceBand} aria-labelledby="resource-title">
        <div className={styles.sectionHeaderRow}>
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Resources</span>
            <h2 id="resource-title">바로 써먹는 실전자료</h2>
            <p>
              프롬프트, Claude Code Skill, MCP, Cursor Rules, 설정 파일을 첨부파일 중심으로
              공유합니다.
            </p>
          </div>
          <Link href="#" className={styles.moreLink}>
            더보기
            <Icon name="arrow-right-line" />
          </Link>
        </div>
        <div className={styles.resourceGrid}>
          {resources.map((resource) => (
            <Link key={resource.title} href="#" className={styles.resourceLinkCard}>
              <Card variant="summary" interactive className={styles.resourceCard}>
                <CardHead>
                  <Badge tone={resource.tone}>{resource.meta}</Badge>
                  <Icon name="download-cloud-2-line" />
                </CardHead>
                <CardTitle>{resource.title}</CardTitle>
                <CardDesc>{resource.desc}</CardDesc>
                <div className={styles.resourceStats}>
                  <span>
                    <Icon name="download-2-line" />
                    {resource.stats.split(" · ")[0]}
                  </span>
                  <span>
                    <Icon name="star-line" />
                    {resource.stats.split(" · ")[1]}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section id="questions" className={styles.qnaBand} aria-labelledby="question-title">
        <div className={styles.splitSection}>
          <div className={styles.questionIntro}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>Q&A</span>
                <h2 id="question-title">막힌 지점은 묻고, 해결 과정은 남깁니다</h2>
                <p>
                  코드 오류만이 아니라 도구 선택, 자동화 설계, 외주 견적, 결과물 판매 가능성까지
                  실전 질문을 한곳에서 다룹니다.
                </p>
              </div>
            </div>
            <Link href="#" className={styles.primaryLink}>
              질문 작성하기
              <Icon name="edit-line" />
            </Link>
          </div>
          <div className={styles.questionList}>
            {questions.map((question, index) => (
              <a href="#" key={question} className={styles.questionItem}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{question}</strong>
                <Icon name="arrow-right-s-line" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── [6.5] 랭킹 섹션 ──────────────────────────────────────────────────── */}
      <section id="ranking" className={styles.rankingBand} aria-labelledby="ranking-title">
        <div className={styles.rankingInner}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Ranking</span>
              <h2 id="ranking-title">기여자 랭킹</h2>
              <p>이번 주·이번 달 가장 활발하게 기여한 회원을 확인하세요.</p>
            </div>
            <Link href="/ranking" className={styles.moreLink}>
              전체 랭킹 보기
              <Icon name="arrow-right-line" />
            </Link>
          </div>
          <div className={styles.rankingWidgetWrap}>
            <RankingWidget />
          </div>
        </div>
      </section>
      {/* ── [6.5] END ─────────────────────────────────────────────────────── */}

      <section id="lounge" className={styles.loungeBand} aria-labelledby="cta-title">
        <div className={styles.loungeInner}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Lounge</span>
              <h2 id="cta-title">작당 라운지</h2>
              <p>AI 창작마당에 올라온 재미있는 이미지와 영상형 창작물을 둘러보세요.</p>
            </div>
            <Link href="#" className={styles.moreLink}>
              더보기
              <Icon name="arrow-right-line" />
            </Link>
          </div>
          <div className={styles.creativeGrid}>
            {creativePosts.map((item) => (
              <a key={item.title} href="#" className={styles.creativeCard}>
                <img src={item.image} alt="" className={styles.creativeThumb} />
                <div className={styles.creativeBody}>
                  <strong>{item.title}</strong>
                  <span>{item.desc}</span>
                  <div className={styles.creativeStats}>
                    <span>
                      <Icon name="heart-line" />
                      {item.stats.likes}
                    </span>
                    <span>
                      <Icon name="eye-line" />
                      {item.stats.views}
                    </span>
                    <span>
                      <Icon name="chat-3-line" />
                      {item.stats.comments}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
