export type CrumbLink = { label: string; href: string };

export type BoardHeroConfig = {
  /** 대메뉴 식별 키 */
  key: string;
  /** 히어로 상단 작은 라벨 (예: Guide) */
  eyebrow: string;
  /** 히어로 큰 제목 */
  title: string;
  /** 히어로 설명 문구 */
  description: string;
  /** 배경 미디어 경로. 확장자가 .mp4이면 배경 영상, 그 외(.png 등)이면 배경 이미지로 렌더된다. */
  media: string;
  /** 브레드크럼 대메뉴 드롭다운에 표시되는 현재 대메뉴 라벨 */
  mainLabel: string;
  /** 이 대메뉴에 속한 소메뉴(게시판) 목록 */
  subMenus: CrumbLink[];
};

/** 모든 대메뉴 공통: 브레드크럼 대메뉴 드롭다운 목록 */
export const mainMenus: CrumbLink[] = [
  { label: "바이브 코딩", href: "/vibe-coding" },
  { label: "AI 자동화", href: "/automation" },
  { label: "AI 수익화", href: "/monetize" },
  { label: "묻고답하기", href: "/questions" },
  { label: "실전자료", href: "/resources/mcp-skills" },
  { label: "작당 라운지", href: "/lounge" },
];

/**
 * 대메뉴별 히어로 설정.
 * 대메뉴 하나당 히어로 하나를 정의하고, 해당 대메뉴에 속한
 * 모든 페이지(목록/상세/글쓰기 등)가 이 설정을 공통으로 불러와 사용한다.
 */
export const boardHeroes = {
  "vibe-coding": {
    key: "vibe-coding",
    eyebrow: "Guide",
    title: "바이브 코딩 가이드",
    description:
      "AI에게 일을 맡기고 결과물을 검토해 실제 서비스에 반영하는 실무형 작업 방식을 모았습니다.",
    media: "/hero-vibe-coding.mp4",
    mainLabel: "바이브 코딩",
    subMenus: [
      // 하위 카테고리는 목록 내 분류일 뿐 별도 라우트가 없어 단일 목록 페이지로 통일.
      { label: "바이브코딩 가이드", href: "/vibe-coding" },
      { label: "바이브코딩 팁", href: "/vibe-coding" },
    ],
  },
  // 묻고답하기 대메뉴: 하위메뉴(소메뉴)가 없는 통합 질문 공간이지만,
  // 다른 대메뉴와 동일하게 자기 히어로 1개를 가진다. (대메뉴당 히어로 1개 규칙)
  questions: {
    key: "questions",
    eyebrow: "Q&A",
    title: "묻고답하기",
    description:
      "오류 해결부터 방향성 검토, 수익화 상담까지. AI작당의 모든 질문과 답변을 한곳에 모았습니다.",
    media: "/hero-questions.mp4",
    mainLabel: "묻고답하기",
    // 하위메뉴가 없으므로 자기 자신만 둔다(브레드크럼 현재 위치 표시용).
    subMenus: [{ label: "묻고답하기", href: "/questions" }],
  },
  // 실전자료 대메뉴: 일반 게시판이 아니라 다운로드형 자료실.
  // 하위메뉴(프롬프트 / MCP·Skills / Rules·설정 / 템플릿·체크리스트)가 이 히어로를 공유한다.
  resources: {
    key: "resources",
    eyebrow: "Resources",
    title: "실전자료",
    description:
      "바로 받아서 자기 환경에 적용하는 다운로드형 자료실입니다. 스킬, MCP, 룰, 프롬프트, 템플릿을 평점과 후기로 검증해 공유합니다.",
    media: "/hero-resources.mp4",
    mainLabel: "실전자료",
    subMenus: [
      { label: "프롬프트", href: "/resources/prompts" },
      { label: "MCP·Skills", href: "/resources/mcp-skills" },
      { label: "Rules·설정", href: "/resources/rules" },
      { label: "템플릿·체크리스트", href: "/resources/templates" },
    ],
  },
  // AI 자동화 대메뉴: 반복 작업을 워크플로로 자동화하는 주제를 다루는 게시판.
  automation: {
    key: "automation",
    eyebrow: "Automation",
    title: "AI 자동화",
    description:
      "반복되는 업무를 워크플로로 묶어 자동으로 처리하는 방법을 모았습니다. 도구 선택부터 실전 적용 사례, 작은 팁까지 함께 공유합니다.",
    media: "/hero-automation.mp4",
    mainLabel: "AI 자동화",
    subMenus: [
      // 하위 카테고리는 목록 내 분류일 뿐 별도 라우트가 없어 단일 목록 페이지로 통일.
      { label: "자동화 가이드", href: "/automation" },
      { label: "자동화 사례", href: "/automation" },
      { label: "자동화 팁", href: "/automation" },
    ],
  },
  // AI 수익화 대메뉴: AI로 만든 결과물을 외주·판매로 연결해 수익을 내는 주제를 다루는 게시판.
  monetize: {
    key: "monetize",
    eyebrow: "Monetize",
    title: "AI 수익화",
    description:
      "AI로 만든 결과물을 외주, 판매, 서비스로 연결해 실제 수익을 만드는 방법을 모았습니다. 검증된 팁과 사례를 함께 공유합니다.",
    media: "/hero-monetize.mp4",
    mainLabel: "AI 수익화",
    subMenus: [
      // 하위 카테고리는 목록 내 분류일 뿐 별도 라우트가 없어 단일 목록 페이지로 통일.
      { label: "외주·판매 팁", href: "/monetize" },
      { label: "수익화 사례", href: "/monetize" },
    ],
  },
  // 작당 라운지 대메뉴: 창작물과 직접 만든 AI 제품을 자유롭게 나누는 커뮤니티 공간.
  lounge: {
    key: "lounge",
    eyebrow: "Lounge",
    title: "작당 라운지",
    description:
      "AI로 만든 창작물과 직접 개발한 제품을 자유롭게 나누는 공간입니다. 가볍게 자랑하고 서로 피드백을 주고받습니다.",
    media: "/hero-lounge.png",
    mainLabel: "작당 라운지",
    subMenus: [
      // "AI 창작마당"은 갤러리형 목록(/lounge),
      // "내가 만든 AI 제품"은 리스트형 별도 라우트(/lounge/products),
      // "작당 수다방"(/lounge/talk, 구 자유 게시판)·"작당 의뢰소"(/lounge/gigs, 구인·외주)는
      // 공통 게시판 구조를 재사용하는 별도 라우트로 분리.
      { label: "AI 창작마당", href: "/lounge" },
      { label: "내가 만든 AI 제품", href: "/lounge/products" },
      { label: "작당 수다방", href: "/lounge/talk" },
      { label: "작당 의뢰소", href: "/lounge/gigs" },
    ],
  },
} satisfies Record<string, BoardHeroConfig>;

export type BoardHeroKey = keyof typeof boardHeroes;
