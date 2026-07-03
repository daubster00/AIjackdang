/**
 * 관리자 봇 가이드 "강의 시리즈" 고정 커리큘럼 정의.
 *
 * 배경(2026-07-03 사용자 지시):
 *  관리자 페르소나(가이드 작성 캐릭터)의 가이드 글을 "그때그때 검색 발굴"이 아니라
 *  강의 챕터처럼 개념→설치→설정→실전→함정으로 이어지는 **고정 커리큘럼**으로 낸다.
 *  각 편은 정해진 학습목표를 다루고, 본문 정해진 자리에 **설명과 일치하는 이미지**를
 *  인라인으로 배치한다(맨 위 1장 방식이 아니라 `[[IMG:assetKey]]` 마커로 여러 장).
 *
 * 이미지 조달(자동):
 *  - kind:"screenshot" → 공식 도움말의 실제 UI 캡처를 sourceUrl에서 다운로드(예: Make S3).
 *    제3자 이미지는 sourceLabel/sourcePageUrl로 출처를 캡션에 표기한다.
 *  - kind:"diagram"    → 실제 스크린샷이 존재하지 않는 개념/흐름은 AI 이미지(genImage)로 생성.
 *    (Claude Code 같은 CLI 도구는 공식문서에 스크린샷이 전무 → 가짜 UI를 만들지 않고 도식으로.)
 *
 * 이 파일은 "무엇을 쓸지"의 원본(source of truth). 실제 자산 URL(버킷 업로드 결과)은
 * 별도 매니페스트(bot_settings.guide_asset_manifest)에 assetKey로 매핑된다.
 */
export const GUIDE_CURRICULUM_VERSION = "2026-07-03";

/** 본문 한 자리에 들어갈 이미지 슬롯. 본문에서는 `[[IMG:assetKey]]` 마커로 위치를 지정한다. */
export interface GuideImageSlot {
  /** 전역 유일 키(매니페스트·마커 공통). 예: "make-first-scenario". */
  assetKey: string;
  /** 본문에 표시할 한국어 캡션(출처가 있으면 파이프라인이 출처를 덧붙임). */
  caption: string;
  /** 이미지 대체 텍스트(접근성·SEO). */
  alt: string;
  /** screenshot=실제 캡처 다운로드 / diagram=AI 생성. */
  kind: "screenshot" | "diagram";
  /** kind=screenshot: 다운로드 원본 URL. */
  sourceUrl?: string;
  /** kind=screenshot: 출처 표기 라벨(예: "Make 공식 도움말"). */
  sourceLabel?: string;
  /** kind=screenshot: 출처 원문 페이지 링크. */
  sourcePageUrl?: string;
  /** kind=diagram: AI 이미지 생성 프롬프트(영문 — 이미지 모델 품질). */
  diagramPrompt?: string;
}

/** 시리즈의 한 편(챕터). */
export interface GuideChapter {
  /** 1-based 편 번호. */
  order: number;
  /** 편 소제목(전체 제목 = "{seriesTitle} {order}강. {title}"). */
  title: string;
  /** 이번 편 학습목표(프롬프트에 주입 — 이 편이 다뤄야 할 범위). */
  goal: string;
  /** 이번 편에서 순서대로 다룰 소주제(프롬프트 가이드). */
  outline: string[];
  /** 본문에 배치할 이미지 슬롯(본문에 [[IMG:assetKey]]로 위치 지정). */
  imageSlots: GuideImageSlot[];
}

/** 하나의 강의 시리즈(고정 커리큘럼). */
export interface GuideSeries {
  /** bot_topics.seriesGroup 및 표시 제목으로 쓰는 키. */
  title: string;
  /** 게시판 슬러그(BOARDS 키). */
  board: string;
  /** 주력 도구명(프롬프트 맥락). */
  tool: string;
  /** 시리즈 한 줄 소개(1강 도입·프롬프트 맥락). */
  intro: string;
  /** 순서대로의 챕터들. */
  chapters: GuideChapter[];
}

// ── 시리즈 1: 제로부터 바이브코딩 (vibe-coding) ──────────────────────────────────
// 주력 도구 Claude Code = CLI. 공식문서에 스크린샷 전무 → 명령은 본문 코드블록,
// 개념·흐름·구조는 AI 생성 도식으로 매칭(가짜 UI 캡처를 만들지 않는다).

const VIBE_CODING: GuideSeries = {
  title: "제로부터 바이브코딩",
  board: "vibe-coding-guide",
  tool: "Claude Code",
  intro:
    "코딩을 몰라도 자연어로 실제 동작하는 프로그램을 만드는 '바이브코딩'을 개념부터 실전까지 단계별로 익히는 시리즈.",
  chapters: [
    {
      order: 1,
      title: "바이브코딩이 대체 뭔가",
      goal:
        "바이브코딩의 개념, 기존 코딩과의 결정적 차이, 왜 지금 가능해졌는지, 어떤 사람에게 실익이 큰지를 오해 없이 잡아준다. 설치·실습은 다음 편으로 미룬다.",
      outline: [
        "바이브코딩 = 자연어로 의도를 말하면 AI가 코드를 쓰고 고치는 개발 방식",
        "기존 코딩(문법을 사람이 직접 타이핑) vs 바이브코딩(의도 전달+검토)의 역할 이동",
        "지금 가능해진 이유: 코드 특화 모델 + 에이전트형 도구의 등장",
        "누구에게 실익이 큰가(기획자·1인 개발·프로토타이핑) / 한계는 무엇인가",
      ],
      imageSlots: [
        {
          assetKey: "vibe-concept-nl-to-code",
          caption: "바이브코딩의 흐름: 자연어 의도 → AI가 코드 작성·수정 → 사람이 검토·승인",
          alt: "자연어 지시가 코드로 변환되고 사람이 검토하는 흐름 도식",
          kind: "diagram",
          diagramPrompt:
            "A clean minimal flat infographic, Korean tech blog style, left-to-right flow with four stages joined by arrows. Under each stage render EXACTLY this Korean label (render the Korean precisely, do NOT translate to English, do NOT invent other words): stage 1 a speech-bubble icon labeled '자연어 지시', stage 2 a glowing AI chip icon labeled 'AI', stage 3 a code editor window icon labeled '코드 작성', stage 4 a green checkmark badge labeled '검토·승인'. Soft purple and white palette, simple line icons, generous whitespace, no other text anywhere, 16:9.",
        },
      ],
    },
    {
      order: 2,
      title: "도구 고르기와 첫 설치",
      goal:
        "바이브코딩 도구 지형(터미널형 Claude Code, 에디터형 Cursor 등)을 짧게 비교하고, Claude Code를 실제로 설치·로그인·첫 실행까지 마치게 한다. 명령은 정확한 코드블록으로 제시한다.",
      outline: [
        "도구 지형 간단 비교: 터미널형 vs 에디터 통합형, 무엇부터 시작할지",
        "설치: OS별 설치 명령(코드블록), 설치 확인 `claude --version`, `claude doctor`",
        "로그인: `claude` 실행 → 브라우저 인증, 계정 종류(Pro/Max/Console)",
        "첫 실행: 프로젝트 폴더로 이동 후 `claude` 진입, `/help`",
      ],
      imageSlots: [
        {
          assetKey: "vibe-install-flow",
          caption: "설치 → 로그인 → 첫 세션 진입까지의 3단계 흐름",
          alt: "Claude Code 설치·로그인·실행 3단계 흐름 도식",
          kind: "diagram",
          diagramPrompt:
            "A minimal 3-step vertical flow diagram, Korean tech tutorial style: step 1 a terminal window icon with a download arrow (install), step 2 a browser window with a login shield (authenticate), step 3 a terminal prompt with a blinking cursor (first session). Numbered badges 1-2-3, soft dark-terminal accents on white, simple line icons, no realistic UI text, 16:9.",
        },
      ],
    },
    {
      order: 3,
      title: "첫 프로젝트 세팅과 설정 파일",
      goal:
        "빈 폴더에서 프로젝트를 시작해, 프로젝트 지침 파일(CLAUDE.md)과 설정(settings)이 무엇이고 왜 만지는지 이해하고 실제로 만들어 보게 한다.",
      outline: [
        "작업 폴더 열기·이동, 프로젝트 인식 방식(파일을 알아서 읽음)",
        "CLAUDE.md: 프로젝트 규칙을 적어두면 매번 설명 안 해도 되는 이유 + 예시(코드블록)",
        "settings.json: 대표 설정 항목 몇 개와 언제 건드리는지",
        "권한 모드: 변경 승인/자동 수락을 언제 쓰는가",
      ],
      imageSlots: [
        {
          assetKey: "vibe-project-structure",
          caption: "프로젝트 폴더에 CLAUDE.md와 .claude/settings.json이 놓이는 구조",
          alt: "프로젝트 폴더 구조와 설정 파일 위치를 보여주는 도식",
          kind: "diagram",
          diagramPrompt:
            "A clean file-tree diagram illustration, Korean dev tutorial style, showing a project folder expanded: a root folder icon containing 'CLAUDE.md' document, a '.claude' folder containing 'settings.json', and a 'src' folder. Monospace-like labels are simple and legible, soft blue/gray palette on white, flat line icons, generous whitespace, 16:9.",
        },
      ],
    },
    {
      order: 4,
      title: "실전 워크플로우: 만들고 고치는 반복",
      goal:
        "실제로 기능 하나를 자연어로 요청 → 제안된 변경 확인 → 승인/수정 요청으로 이어지는 반복 루프를 체득하게 한다. 좋은 요청과 나쁜 요청의 차이를 예시로 보여준다.",
      outline: [
        "요청 → AI가 파일 찾고 변경안 제시 → 사람이 diff 확인 → 승인 루프",
        "좋은 요청 vs 모호한 요청 예시(코드블록/텍스트 대비)",
        "작게 쪼개 시키기(한 번에 한 가지), 테스트로 확인 시키기",
        "커밋도 대화로: 변경 요약·브랜치 생성",
      ],
      imageSlots: [
        {
          assetKey: "vibe-edit-loop",
          caption: "요청 → 변경안(diff) → 검토 → 승인/재요청으로 도는 반복 루프",
          alt: "바이브코딩 반복 워크플로우 루프 도식",
          kind: "diagram",
          diagramPrompt:
            "A circular loop workflow diagram, Korean tech blog style, four nodes arranged in a cycle with arrows: 'request (자연어)', 'AI proposes diff', 'human review', 'approve / ask again' looping back. Soft purple-green accents on white, simple line icons (chat bubble, diff lines, eye, checkmark), no gibberish text, 16:9.",
        },
      ],
    },
    {
      order: 5,
      title: "자주 겪는 함정과 안전장치",
      goal:
        "초보가 실제로 부딪히는 함정(엉뚱한 대량 수정, 맥락 폭주, 비용, 검증 소홀)을 짚고, 되돌리기·맥락 관리·검증 습관 같은 실전 안전장치를 정리한다.",
      outline: [
        "엉뚱한 변경 되돌리기(git·되돌리기 습관)",
        "맥락(컨텍스트)이 길어질 때 정리·새 세션 판단",
        "비용 감각: 무엇이 비용을 키우나",
        "검증 습관: AI 결과를 그대로 믿지 않고 돌려보고 확인",
      ],
      imageSlots: [
        {
          assetKey: "vibe-safety-checklist",
          caption: "바이브코딩 안전장치 체크리스트: 되돌리기·맥락관리·비용·검증",
          alt: "바이브코딩 안전장치 4가지를 정리한 체크리스트 도식",
          kind: "diagram",
          diagramPrompt:
            "A clean checklist card infographic, Korean tech tutorial style. This is about AI CODING safety, NOT house cleaning. Title at top render EXACTLY '바이브코딩 안전장치' (render this Korean precisely). Four checklist rows, each a checkbox plus a small line icon and EXACTLY these Korean labels (render Korean precisely, do NOT translate, do NOT invent other words): row 1 a rewind/undo arrow icon '잘못된 변경 되돌리기', row 2 a stacked-documents icon '대화 맥락 관리', row 3 a coin icon '비용 관리', row 4 a magnifier icon '결과 검증'. Soft blue and purple palette on white, flat minimal icons, no other text, 16:9.",
        },
      ],
    },
  ],
};

// ── 시리즈 2: 반복업무 자동화 실전 (automation) ──────────────────────────────────
// 주력 도구 Make = 웹 UI. 공식 도움말에 실제 화면 캡처가 공개(S3) → 실제 스크린샷 다운로드.
// 개념 편은 도식으로.

const AUTOMATION: GuideSeries = {
  title: "반복업무 자동화 실전",
  board: "automation-guide",
  tool: "Make",
  intro:
    "매번 손으로 하던 반복 작업을 노코드 자동화 도구(Make)로 없애는 과정을 개념부터 실제 시나리오 구축까지 단계별로 익히는 시리즈.",
  chapters: [
    {
      order: 1,
      title: "자동화가 뭐고 어디에 쓰나",
      goal:
        "자동화의 핵심 개념(트리거-액션 모델)과 어떤 반복업무가 자동화 대상인지 감을 잡게 한다. 특정 도구 조작은 다음 편으로.",
      outline: [
        "자동화 = '무슨 일이 생기면(트리거) → 이걸 해라(액션)'의 연결",
        "자동화하기 좋은 일 vs 애매한 일 구분 기준",
        "노코드 자동화 도구가 하는 일(앱과 앱을 잇는 배관)",
        "현실 예시: 새 주문 들어오면 시트 기록 + 알림",
      ],
      imageSlots: [
        {
          assetKey: "auto-trigger-action",
          caption: "자동화의 기본 모델: 트리거(무슨 일이 생기면) → 액션(이걸 한다)",
          alt: "트리거-액션 자동화 개념 도식",
          kind: "diagram",
          diagramPrompt:
            "A clean minimal diagram, Korean tech blog style. Title at top render EXACTLY '트리거와 액션' (render this Korean precisely, no other title). Two cards side by side joined by a right arrow: left card a lightning-bolt icon with header EXACTLY '트리거', right card a gear-with-robot-arm icon with header EXACTLY '액션'. Below, a small example row: an incoming-email icon labeled '새 이메일 도착', a right arrow, a spreadsheet icon labeled '시트에 새 행 기록'. Render all Korean labels precisely, do NOT translate, do NOT add other words. Soft teal and purple palette on white, flat line icons, generous whitespace, 16:9.",
        },
      ],
    },
    {
      order: 2,
      title: "도구 고르기: Make·n8n·Zapier",
      goal:
        "대표 노코드 자동화 도구 3종을 무료 범위·난이도·성격으로 짧게 비교하고, 이 시리즈는 왜 Make로 진행하는지 정한 뒤 계정을 만들게 한다.",
      outline: [
        "Make vs n8n vs Zapier: 가격/무료 범위, 시각 편집, 러닝커브 한눈 비교",
        "왜 입문에 Make인가(시각적 시나리오 편집기)",
        "무료 플랜으로 시작하는 법",
        "대시보드 첫 화면에서 뭘 보게 되나",
      ],
      imageSlots: [
        {
          assetKey: "auto-tool-compare",
          caption: "노코드 자동화 도구 3종 비교: 무료 범위 · 시각적 에디터 · 러닝커브",
          alt: "노코드 자동화 도구 3종 비교 표 도식",
          kind: "diagram",
          diagramPrompt:
            "A clean comparison table infographic, Korean tech blog style. Three columns headed EXACTLY '도구 A', '도구 B', '도구 C'. Four rows, each a left label with EXACTLY these Korean texts (render Korean precisely, do NOT translate, do NOT invent other words): '무료 범위', '시각적 에디터', '러닝커브', '자동화 기능'. Ratings shown as simple filled-dot indicators per cell. Soft neutral palette on white, minimal flat design, no other body text, 16:9.",
        },
      ],
    },
    {
      order: 3,
      title: "앱 연결(Connection) 설정",
      goal:
        "자동화가 내 계정의 앱(예: 구글 시트)에 접근하려면 필요한 '연결(Connection)'의 개념과, 실제로 앱을 인증해 연결을 추가하는 과정을 익히게 한다.",
      outline: [
        "연결(Connection)이란: 자동화 도구가 내 앱 계정에 접근하도록 허가",
        "권한 범위·보안 감각(최소 권한)",
        "실제 연결 추가 흐름: 앱 선택 → 로그인/인증 → 연결 저장",
        "연결 관리(재인증·삭제)",
      ],
      imageSlots: [
        {
          assetKey: "auto-connection-concept",
          caption: "연결(Connection): 자동화 도구가 내 앱 계정에 접근하도록 인증하는 다리",
          alt: "자동화 도구와 앱 계정 사이의 연결 인증 개념 도식",
          kind: "diagram",
          diagramPrompt:
            "A clean diagram, Korean tech tutorial style. Title at top render EXACTLY '앱 연결(Connection)'. An automation-platform node on the left labeled EXACTLY '자동화 도구', connected through a central shield-with-lock (authorization) to three app cards on the right labeled EXACTLY '메일', '스프레드시트', '메신저'. Labels along the arrows render EXACTLY: '앱 연결 요청', '로그인·인증', '접근 권한 부여'. Render all Korean text precisely, do NOT invent other words, names, or subtitles. Soft purple palette on white, flat line icons, 16:9.",
        },
      ],
    },
    {
      order: 4,
      title: "첫 시나리오 만들기",
      goal:
        "모듈(트리거+액션)을 실제로 추가·연결하고, 데이터를 매핑해 테스트 실행까지 성공시키는 첫 자동화를 완성하게 한다. 실제 Make 시나리오 편집기 화면으로 보여준다.",
      outline: [
        "시나리오 = 모듈들을 선으로 이은 파이프라인",
        "트리거 모듈 추가(예: 시트에 새 행) → 액션 모듈 추가(예: 메신저 메시지)",
        "모듈 사이 데이터 매핑(앞 모듈의 값을 뒤 모듈에 꽂기)",
        "한 번 실행(Run once)으로 테스트 → 결과 확인",
      ],
      imageSlots: [
        {
          assetKey: "make-first-scenario",
          caption: "Make 시나리오 편집기: '새 행 감지(Google Sheets) → 메시지 보내기(Slack)' 두 모듈을 연결한 첫 시나리오",
          alt: "Google Sheets 트리거와 Slack 액션 모듈을 연결한 Make 시나리오 편집기 화면",
          kind: "screenshot",
          sourceUrl:
            "https://archbee-image-uploads.s3.amazonaws.com/oAyFj2GHlBeBVWF5OAir2/C-rvwBZHzacULYkRiQAqt-20251104-102546.png",
          sourceLabel: "Make 공식 도움말",
          sourcePageUrl: "https://help.make.com/create-your-first-scenario",
        },
      ],
    },
    {
      order: 5,
      title: "실전: 스케줄·필터·에러 처리",
      goal:
        "만든 시나리오를 실제 운영 수준으로: 언제 돌릴지(스케줄), 필요한 것만 통과시키기(필터), 실패했을 때 대처(에러 처리)를 익히게 한다.",
      outline: [
        "스케줄: 즉시/주기(예: 15분마다)/특정 시각 실행 설정",
        "필터: 조건에 맞는 데이터만 다음 단계로",
        "에러 처리: 실패 시 재시도·알림·중단 정책",
        "운영 팁: 실행 로그로 문제 추적, 사용량(operations) 감각",
      ],
      imageSlots: [
        {
          assetKey: "auto-schedule-filter",
          caption: "운영 3요소: 스케줄(언제) · 필터(무엇만) · 에러 처리(실패 시)",
          alt: "자동화 운영의 스케줄·필터·에러처리 3요소 도식",
          kind: "diagram",
          diagramPrompt:
            "A clean three-part infographic, Korean tech blog style, three cards joined along a pipeline line. Each card an icon and EXACTLY this Korean label (render Korean precisely, do NOT use English, do NOT invent other words): card 1 a clock icon '스케줄', card 2 a funnel icon '필터', card 3 a warning-triangle-with-retry icon '에러 처리'. Soft teal palette on white, flat minimal icons, no other text, 16:9.",
        },
      ],
    },
  ],
};

/** 전체 가이드 시리즈. seriesGroup(=title)으로 조회. */
export const GUIDE_SERIES: GuideSeries[] = [VIBE_CODING, AUTOMATION];

/** seriesGroup(title)으로 시리즈를 찾는다. */
export function getGuideSeries(seriesGroup: string): GuideSeries | undefined {
  return GUIDE_SERIES.find((s) => s.title === seriesGroup);
}

/** 게시판 슬러그에 배정된 가이드 시리즈를 찾는다(게시판당 1개 가정). */
export function getGuideSeriesForBoard(board: string): GuideSeries | undefined {
  return GUIDE_SERIES.find((s) => s.board === board);
}

/** 특정 시리즈의 특정 편(1-based)을 찾는다. */
export function getGuideChapter(
  seriesGroup: string,
  order: number,
): GuideChapter | undefined {
  return getGuideSeries(seriesGroup)?.chapters.find((c) => c.order === order);
}

/** 커리큘럼 전체에서 유일 assetKey 목록(매니페스트 구축·검증용). */
export function collectAssetKeys(): GuideImageSlot[] {
  return GUIDE_SERIES.flatMap((s) => s.chapters.flatMap((c) => c.imageSlots));
}
