/**
 * "바이브 코딩 입문 로드맵" 12편 커리큘럼 시드 스크립트 (멱등).
 *
 * 사용자가 확정한 12편 구성안을 bot_curriculum_series / _chapters / _image_slots 에 적재한다.
 *  - 시리즈: "바이브 코딩 입문 로드맵" (board=vibe-coding-guide) — 기존 "제로부터 바이브코딩"과 공존.
 *  - 1편: 사용자가 직접 준 원고를 이모지 제거·O/X 유지·이미지 프롬프트→[[IMG]] 마커로 정리한
 *         본문을 draft로 저장(status=drafted)하고, ai_diagram 슬롯 2개를 만든다.
 *         이후 fillImageSlot(Gemini)로 이미지를 생성·업로드하고 checkAndPromoteChapter로
 *         status=ready(발행 대기, 발행은 하지 않음)로 승격한다.
 *  - 2~12편: 제목/학습목표/소주제만 status=planned 로 적재(본문·이미지는 이후 단계에서 생성).
 *
 * 재실행 안전:
 *  - 시리즈/챕터/슬롯은 유니크 키 기준 ON CONFLICT.
 *  - 1편 본문은 재실행 시 항상 최신 원고로 UPDATE(단, 이미 published 면 건드리지 않음).
 *  - 이미지가 이미 ready 인 슬롯은 FORCE=1 없이는 재생성하지 않는다.
 *
 * 실행:
 *   pnpm --filter @ai-jakdang/api exec tsx src/scripts/seed-roadmap-curriculum.ts
 *   FORCE=1 ... (이미지 재생성)
 *   SKIP_IMAGES=1 ... (이미지 생성 건너뛰고 슬롯만 pending 으로 남김)
 */

import { getDb, closeDb } from "@ai-jakdang/database";
import {
  botCurriculumSeries,
  botCurriculumChapters,
  botCurriculumImageSlots,
} from "@ai-jakdang/database/schema";
import { eq, and } from "drizzle-orm";
import { parseResponseToTiptap } from "../services/bot/_tiptap-parser.js";
import { fillImageSlot } from "../services/bot/slot-filler.js";
import { checkAndPromoteChapter } from "../services/bot/curriculum-staging.js";

const FORCE = process.env.FORCE === "1";
const SKIP_IMAGES = process.env.SKIP_IMAGES === "1";

// ── 시리즈 헤더 ─────────────────────────────────────────────────────────────────

const SERIES = {
  title: "바이브 코딩 입문 로드맵",
  board: "vibe-coding-guide",
  tool: "ChatGPT · Claude Code · Cursor · Codex",
  intro:
    "개발자가 아니어도 AI와 함께 서비스를 만드는 '바이브 코딩'을, 개념부터 도구·기획·프롬프트·검수·실전까지 12편에 걸쳐 단계별로 익히는 입문 로드맵.",
};

// ── 1편 본문 (이모지 제거 · O/X 유지 · 이미지 프롬프트→[[IMG]] 마커) ──────────────

const CHAPTER1_BODY = `AI 코딩 도구가 하루가 다르게 발전하면서 주변에서 이런 이야기들이 심심치 않게 들려옵니다. "이제 개발 몰라도 서비스 다 만들 수 있대", "말만 하면 AI가 알아서 코드 다 짜주던데?" 이러한 흐름 속에서 최근 가장 뜨겁게 떠오른 키워드가 바로 '바이브 코딩(Vibe Coding)'입니다.

바이브 코딩을 쉽게 정의하자면, 사람이 코드를 한 줄 한 줄 직접 타이핑하는 대신 AI와 대화하며 원하는 기능을 말로 만들고, 수정하고, 조율해 나가는 개발 방식을 뜻합니다.

과거에는 웹사이트 하나를 만들려 해도 개발자가 밤을 새워가며 구조를 설계하고, 오타 하나 때문에 몇 시간씩 에러를 찾아 헤매야 했습니다. 하지만 지금은 Cursor, Claude Code, ChatGPT 같은 도구들이 코드 작성부터 에러 분석, 문서 정리까지 척척 해냅니다. 덕분에 개발 경험이 전혀 없는 비개발자도 나만의 웹사이트나 업무 자동화 툴, 심지어 서비스의 최소 기능 제품(MVP)까지 뚝딱 만들어내는 시대가 열렸습니다.

하지만 여기서 꼭 짚고 넘어가야 할 점이 있습니다. 바이브 코딩은 버튼만 누르면 뚝딱 결과물이 나오는 마법이 아닙니다. 냉정하게 말해, 개발을 '대신' 해주는 게 아니라 AI라는 초고속 조수와 '함께' 협업하는 과정에 가깝습니다.

## 1. 바이브 코딩, 도대체 어떻게 하는 건가요?

바이브 코딩은 교과서에 나오는 정형화된 이론이 아닙니다. 실무에서 일어나는 과정을 들여다보면 대략 다음과 같은 핑퐁(Ping-Pong) 게임에 가깝습니다.

1단계: 사용자가 만들고 싶은 기능이나 화면을 말로 설명합니다.
2단계: AI가 그 설명을 찰떡같이 알아듣고 코드를 작성하거나 수정합니다.
3단계: 사용자가 결과물을 구동해 보고, 어색하거나 틀린 부분을 다시 지적합니다.
4단계: AI가 지적받은 코드를 고치고, 사용자는 다시 검수합니다.

[[IMG:vibe-roadmap-1-collab]]

결국 바이브 코딩의 핵심은 코딩 문법을 달달 외우는 게 아닙니다. 내가 원하는 결과를 AI에게 얼마나 명확하게 설명할 수 있는지, 그리고 나온 결과물이 맞게 돌아가는지 판단하는 능력이 전부입니다.

따라서 바이브 코딩을 제대로 하려면 훌륭한 기획력, 문제점을 구체적으로 묘사하는 소통 능력, 그리고 복잡한 작업을 잘게 쪼갤 줄 아는 '태스크 분할 능력'이 필수적입니다.

## 2. 왜 지금 바이브 코딩이 대세가 되었을까?

이게 가능해진 이유는 단순합니다. AI가 단순히 문장을 그럴듯하게 지어내는 수준을 넘어, '코드의 전체적인 구조와 맥락'을 이해하기 시작했기 때문입니다.

실제로 요즘 AI 도구들에게 이런 요구를 하면 막힘없이 수행합니다.
"기존에 짜인 코드 좀 분석해서 설명해 줘."
"내 사이트에 어울리는 로그인/회원가입 기능 만들어줘."
"에러 메시지 보낼 테니까 왜 터졌는지 원인 좀 찾아줘."
"CSS 레이아웃이 깨졌는데 모바일에서도 예쁘게 보이게 고쳐줘."

예전 같으면 이 중 하나만 하려고 해도 수개월 동안 개발 공부를 해야 했습니다. 하지만 이제는 AI가 중간 과정을 획기적으로 단축해 주다 보니 진입장벽이 바닥까지 낮아졌습니다. 특히 1인 창업자, 마케터, 디자이너들이 가볍게 랜딩 페이지를 만들거나 내부 업무용 자동화 스크립트를 짤 때 바이브 코딩은 그야말로 신세계를 선사합니다.

## 3. "알아서 다 해주겠지"라는 환상 깨기

바이브 코딩을 처음 접하는 분들이 가장 많이 하는 실수가 있습니다. "AI한테 대충 말하면 알아서 완벽하게 만들어 주겠지?" 단언컨대, 현실은 절대 그렇지 않습니다. AI는 코드를 기계처럼 빠르게 짜낼 수는 있지만, 당신의 사업 목적이나 실제 고객들이 겪을 예외 상황까지 알아서 배려해 주지는 못합니다.

예를 들어, AI에게 "요즘 유행하는 커뮤니티 사이트 하나 만들어줘"라고 던지면 그럴듯한 게시판 화면은 1분 만에 만들어 올 것입니다. 하지만 그 이면의 세부적인 기획은 전부 비어있게 됩니다.

AI가 스스로 판단하지 못하는, 놓치기 쉬운 핵심 체크리스트는 다음과 같습니다.
- 회원 권한 관리: 일반 회원, 스태프, 관리자의 이용 범위를 어떻게 나눌 것인가?
- 데이터 삭제 정책: 글을 지웠을 때 DB에서 아예 삭제할 것인가, '숨김' 처리만 할 것인가?
- 보안 및 업로드: 파일 업로드 시 악성코드 파일 차단은 어떻게 할 것인가?
- UX/UI 예외 케이스: 모바일 화면이나 인터넷이 느린 환경에서는 어떻게 보여줄 것인가?

결국 바이브 코딩에서 사람은 단순한 '주문자'가 아닙니다. 전체 방향을 잡는 기획자이자, 최종 품질을 책임지는 의사결정권자(검수자)가 되어야 합니다. AI가 짠 코드가 정답인지 오답인지 가려내는 눈은 결국 인간에게 있으니까요.

## 4. 비개발자에게도 '최소한의 지식'은 무기다

바이브 코딩을 하기 위해 컴퓨터공학 전공자 수준의 지식을 쌓을 필요는 없습니다. 하지만 대화가 통하기 위한 '최소한의 개념'은 장착해야 합니다. 축구 규칙도 모르면서 감독을 할 수는 없는 노릇이니까요.

- HTML/CSS: 화면의 뼈대를 세우고 디자인 옷을 입히는 것
- JavaScript: 버튼 클릭이나 화면 전환 같은 '움직임'을 담당하는 것
- DB(데이터베이스): 회원 정보나 게시글 데이터를 차곡차곡 저장하는 창고
- API: 화면(프론트)과 창고(서버) 사이에서 데이터를 배달하는 통로
- 배포: 내가 만든 결과물을 전 세계 사람들이 접속할 수 있도록 인터넷 공간에 올리는 것

이 개념을 알고 AI를 대하는 것과 모르는 것의 차이는 하늘과 땅 차이입니다.

X 안 좋은 질문: "저기, 버튼 눌렀는데 안 돼요. 고쳐주세요."
O 좋은 질문: "게시글 작성 버튼을 누르면 화면에선 정상적인데, 서버 쪽에서 500 에러(서버 내부 오류)가 뜹니다. API 요청 경로랑 DB 저장 로직을 다시 확인해 주세요."

이처럼 바이브 코딩을 잘하는 사람은 코드를 다 외우는 사람이 아니라, AI에게 어디를 봐야 하는지 정확한 길을 찔러줄 수 있는 사람입니다.

[[IMG:vibe-roadmap-1-architecture]]

## 5. 바이브 코딩이 빛을 발하는 순간 vs 위험한 순간

바이브 코딩이 모든 상황에서 정답은 아닙니다. 무엇이든 잘 맞는 궁합이 있고, 절대 건드려서는 안 되는 영역이 있습니다.

이런 상황이라면 적극 추천합니다.
- 아이디어를 검증하기 위해 빠르게 MVP(최소 기능 제품)를 만들 때
- 반복적인 엑셀 작업이나 업무를 자동화하는 스크립트가 필요할 때
- 외주 개발을 맡기기 전, 대략적인 프로토타입을 직접 구현해 보고 싶을 때
- 디자이너나 마케터가 나만의 포트폴리오/랜딩 페이지를 빌드할 때

반면 이런 영역은 절대 조심해야 합니다.
- 실제 돈이 오가는 결제 시스템 및 금융 기능
- 유출되면 끝장나는 개인정보 처리 및 로그인 보안
- 수만 명이 동시에 접속하는 대규모 트래픽 서비스
- 의료, 법률 등 작은 에러가 큰 법적 책임으로 이어지는 서비스

AI가 만든 코드는 겉보기엔 멀쩡히 잘 돌아가는 것처럼 보여도, 내부적으로 보안 구멍이 숭숭 뚫려 있거나 시스템이 불안정한 경우가 많습니다. 중요한 서비스일수록 AI의 결과물을 맹신하지 말고, 반드시 전문가의 검수나 엄격한 테스트를 거쳐야 합니다. AI는 작업 속도를 높여줄 뿐, 사고가 났을 때 책임을 대신 져주지 않기 때문입니다.

## 6. 좋은 바이브 코딩 vs 나쁜 바이브 코딩

AI에게 일을 잘 시키는 사람과 그렇지 못한 사람의 차이는 프롬프트의 디테일에서 갈립니다.

나쁜 바이브 코딩 (AI에게 독학을 시키는 유형): "멋진 커뮤니티 사이트 하나 만들어줘. 관리자 페이지도 알아서 예쁘게 꾸며주고, 오류 안 나게 잘 짜줘." → AI가 마음대로 추측해서 코딩하기 때문에, 결국 내가 원치 않는 엉뚱한 결과물이 나옵니다.

좋은 바이브 코딩 (명확하게 업무를 지시하는 유형): "회원 등급은 일반, 운영자, 최고관리자 3단계로 나눕니다. 일반 회원은 글쓰기만 가능하고, 운영자는 게시글을 '숨김(deleted 상태 변경)' 처리할 수 있어야 합니다. 목록 화면에는 제목, 작성자, 작성일, 조회수를 표 형태로 보여주세요." → AI가 오차 없이 정확하고 깔끔한 코드를 뽑아냅니다.

바이브 코딩을 시작하는 초보자를 위한 3계명

크게 보지 말고 쪼개서 보기: 전체 서비스를 한 번에 만들려 하지 마세요. '로그인 화면 만들기' → '글쓰기 버튼 만들기'처럼 아주 작은 단위로 나누어 AI에게 요청하세요.

만들 때마다 확인하기: AI가 코드를 짜줄 때마다 실제로 구동해 보고 버그가 없는지 체크하세요. 문제가 쌓인 상태에서 나중에 고치려면 AI도 길을 잃습니다.

수시로 백업(저장)하기: 방금 전까지 잘 되던 코드가 AI의 말 한마디에 완전히 망가질 수 있습니다. 정상 작동하는 시점의 코드는 반드시 따로 복사해 두거나 Git 등을 통해 저장해 두세요.`;

// 1편 이미지 슬롯(ai_diagram) — diagramPrompt 는 사용자 원문 영어 프롬프트 그대로.
const CHAPTER1_SLOTS = [
  {
    assetKey: "vibe-roadmap-1-collab",
    caption:
      "바이브 코딩의 협업 과정: 사람의 기획과 AI의 코드 작성이 오가는 핑퐁 워크플로우",
    alt: "사람과 홀로그램 AI 어시스턴트가 웹 개발 프로젝트를 함께 다듬는 일러스트",
    diagramPrompt:
      "A modern minimalistic illustration of a human creative professional collaborating with a holographic AI assistant. They are iterating on a website development project interface, step-by-step connection, clean UI layout, soft tech glow, dynamic and collaborative atmosphere, vector style, corporate Memphis aesthetic, cinematic lighting --ar 16:9 --style raw",
  },
  {
    assetKey: "vibe-roadmap-1-architecture",
    caption:
      "웹 서비스의 기본 구조: 프론트엔드(화면) → API(통로) → 백엔드 서버 → 데이터베이스(창고)",
    alt: "프론트엔드·API·백엔드 서버·데이터베이스가 연결된 웹 아키텍처 인포그래픽",
    diagramPrompt:
      "A simplified tech infographics explaining web architecture. Showing 'Frontend UI', 'API Pipeline', 'Backend Server', and 'Database Storage' connected with glowing neon arrows. Sleek 3D isometric design, clean typography, dark background with futuristic cyan and purple lights, educational diagram --ar 16:9",
  },
];

// ── 12편 챕터 정의 (2~12편은 제목/목표/소주제만) ─────────────────────────────────

interface ChapterDef {
  order: number;
  title: string;
  goal: string;
  outline: string[];
}

const CHAPTERS: ChapterDef[] = [
  {
    order: 1,
    title: "바이브 코딩이란? 개발자가 아니어도 개발할 수 있다는 말의 진짜 의미",
    goal: "바이브 코딩의 개념과 장점, 한계, 그리고 초보자가 흔히 빠지는 착각을 정리해 전체 시리즈의 토대를 잡는다.",
    outline: [
      "바이브 코딩 = AI와 대화하며 코드를 만들고 고치는 개발 방식",
      "사람의 역할: 단순 주문자가 아니라 기획자·검수자",
      "지금 가능해진 이유와 진입장벽의 하락",
      "빛을 발하는 영역 vs 절대 조심해야 할 영역",
      "좋은 지시 vs 나쁜 지시, 그리고 초보자 3계명",
    ],
  },
  {
    order: 2,
    title: "바이브 코딩을 시작하기 전에 반드시 알아야 할 개발 흐름",
    goal: "기획 → 구조 파악 → 작업 지시 → 코드 수정 → 검수 → 배포로 이어지는 개발 전체 흐름을 개념적으로 잡는다.",
    outline: [
      "개발은 코딩만이 아니다: 기획부터 배포까지 한눈에",
      "기획: 무엇을 만들지 먼저 정의하기",
      "구조 파악: AI가 프로젝트를 이해하게 하기",
      "작업 지시 → 코드 수정 → 검수의 반복 루프",
      "배포: 완성한 결과물을 세상에 내보내기",
    ],
  },
  {
    order: 3,
    title: "ChatGPT, Claude Code, Cursor, Codex는 각각 언제 써야 할까?",
    goal: "대표 AI 개발 도구들의 역할 차이를 이해하고, 상황별로 어떤 도구를 골라야 하는지 판단 기준을 세운다.",
    outline: [
      "ChatGPT: 아이디어·설명·학습용 대화형 도구",
      "Claude Code: 프로젝트 전체를 다루는 터미널형 에이전트",
      "Cursor: 에디터에 통합된 코드 수정 도구",
      "Codex: 코드 읽기·수정·실행형 에이전트",
      "상황별 도구 선택 가이드",
    ],
  },
  {
    order: 4,
    title: "AI에게 개발을 맡기기 전에 준비해야 할 기획서 작성법",
    goal: "AI가 정확히 이해할 수 있는 기획서 작성법 — 메뉴·기능·화면·DB·예외 상황을 어떻게 정리하는지 익힌다.",
    outline: [
      "왜 기획서가 결과물의 품질을 좌우하나",
      "메뉴·기능 목록 정리하기",
      "화면(UI)과 사용자 흐름 정의",
      "데이터(DB) 구조와 저장 항목",
      "예외 상황·권한·정책 명시",
    ],
  },
  {
    order: 5,
    title: '바이브 코딩 프롬프트 작성법: "만들어줘"라고 하면 망하는 이유',
    goal: "모호한 지시가 왜 실패하는지 이해하고, 좋은 지시문의 구조와 단계별 요청법을 체득한다.",
    outline: [
      '"만들어줘"가 망하는 이유: AI의 추측을 유발',
      "좋은 지시문의 구조(맥락·목표·제약·검증)",
      "나쁜 지시문 vs 좋은 지시문 예시",
      "한 번에 하나씩, 단계별로 쪼개 요청",
      "원하는 결과를 구체적으로 묘사하기",
    ],
  },
  {
    order: 6,
    title: "기존 프로젝트를 AI에게 이해시키는 방법",
    goal: "이미 존재하는 프로젝트를 AI가 파악하게 만드는 법 — 폴더 구조 설명, README, CLAUDE.md, 규칙, 작업 범위 제한을 다룬다.",
    outline: [
      "AI가 프로젝트를 이해하는 방식",
      "폴더 구조와 핵심 파일 설명하기",
      "README와 CLAUDE.md로 맥락 제공",
      "Rules로 스타일·규칙 고정",
      "작업 범위를 좁혀 사고 방지",
    ],
  },
  {
    order: 7,
    title: "AI가 만든 코드는 왜 자꾸 엉망이 될까?",
    goal: "AI 코드 품질이 무너지는 근본 원인(컨텍스트 부족·요구 모호·검수 부재·과도한 한 번 요청)을 짚고 예방법을 익힌다.",
    outline: [
      "컨텍스트 부족: AI가 맥락을 잃을 때",
      "요구사항 모호함이 부르는 엉뚱한 결과",
      "검수 부재로 쌓이는 오류",
      "한 번에 너무 많이 시키는 실수",
      "코드 품질을 지키는 습관",
    ],
  },
  {
    order: 8,
    title: "바이브 코딩에서 가장 중요한 것은 '개발'보다 '검수'다",
    goal: "완성도를 좌우하는 검수의 중요성을 이해하고, 화면·기능·오류·보안 검수 체크리스트를 갖춘다.",
    outline: [
      "왜 검수가 개발보다 중요한가",
      "화면 검수: 레이아웃·반응형·깨짐 확인",
      "기능 검수: 실제 동작·예외 케이스",
      "오류 검수: 에러·로그 확인",
      "보안 검수: 권한·입력·정보 노출 점검",
    ],
  },
  {
    order: 9,
    title: "Claude Code로 실제 웹사이트 기능을 수정하는 기본 흐름",
    goal: "코드 분석 → 작업 계획 → 수정 → 테스트 → 커밋 요청으로 이어지는 실제 수정 작업의 기본 루프를 따라 해본다.",
    outline: [
      "코드 분석: 어디를 고쳐야 하는지 파악",
      "작업 계획 세우기",
      "수정 요청과 변경안(diff) 확인",
      "테스트로 동작 검증",
      "커밋 요청으로 안전하게 저장",
    ],
  },
  {
    order: 10,
    title: "Cursor Rules와 프로젝트 규칙을 왜 써야 할까?",
    goal: "AI가 프로젝트 스타일과 규칙을 일관되게 지키도록 만드는 규칙(Rules) 작성법을 익힌다.",
    outline: [
      "규칙이 없을 때 생기는 스타일 혼란",
      "Cursor Rules란 무엇인가",
      "프로젝트 규칙에 담을 내용",
      "좋은 규칙 작성 예시",
      "규칙 유지·업데이트",
    ],
  },
  {
    order: 11,
    title: "MCP와 Skills는 바이브 코딩에서 왜 중요해질까?",
    goal: "외부 도구 연결(MCP)과 반복 작업 자동화(Skills)의 개념을 이해하고, 프로젝트별 능력 확장의 가치를 파악한다.",
    outline: [
      "MCP: AI를 외부 도구·데이터에 연결하기",
      "Skills: 반복 작업을 능력으로 저장",
      "프로젝트별 능력 확장의 의미",
      "실제 활용 예시",
      "도입 시 주의점",
    ],
  },
  {
    order: 12,
    title: "바이브 코딩 입문자가 절대 하지 말아야 할 10가지",
    goal: "초보자가 흔히 저지르는 치명적 실수 10가지를 정리해 시리즈를 마무리하고 안전한 습관을 각인한다.",
    outline: [
      "한 번에 다 맡기기",
      "검수 생략하기",
      "백업 없이 수정하기",
      "보안키·비밀번호 노출",
      "맥락 없이 요청하기 등 나머지 치명적 실수",
    ],
  },
];

// ── 메인 ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getDb();

  console.info("[seed-roadmap] 시작 — 바이브 코딩 입문 로드맵 12편");

  // 1. 시리즈 upsert
  const insertedSeries = await db
    .insert(botCurriculumSeries)
    .values({
      title: SERIES.title,
      board: SERIES.board,
      tool: SERIES.tool,
      intro: SERIES.intro,
      isActive: true,
    })
    .onConflictDoNothing({ target: botCurriculumSeries.title })
    .returning({ id: botCurriculumSeries.id });

  let seriesId: string;
  if (insertedSeries.length > 0) {
    seriesId = insertedSeries[0]!.id;
    console.info(`  [series] 삽입: "${SERIES.title}" (id=${seriesId})`);
  } else {
    const [existing] = await db
      .select({ id: botCurriculumSeries.id })
      .from(botCurriculumSeries)
      .where(eq(botCurriculumSeries.title, SERIES.title))
      .limit(1);
    seriesId = existing!.id;
    console.info(`  [series] 기존: "${SERIES.title}" (id=${seriesId})`);
  }

  // 2. 챕터 삽입
  const chapterIds = new Map<number, string>();
  for (const ch of CHAPTERS) {
    const inserted = await db
      .insert(botCurriculumChapters)
      .values({
        seriesId,
        orderIndex: ch.order,
        title: ch.title,
        goal: ch.goal,
        outline: ch.outline,
        status: "planned",
      })
      .onConflictDoNothing({
        target: [botCurriculumChapters.seriesId, botCurriculumChapters.orderIndex],
      })
      .returning({ id: botCurriculumChapters.id });

    let chapterId: string;
    if (inserted.length > 0) {
      chapterId = inserted[0]!.id;
      console.info(`    [chapter] 삽입: ${ch.order}편 "${ch.title}"`);
    } else {
      const [existing] = await db
        .select({ id: botCurriculumChapters.id })
        .from(botCurriculumChapters)
        .where(
          and(
            eq(botCurriculumChapters.seriesId, seriesId),
            eq(botCurriculumChapters.orderIndex, ch.order),
          ),
        )
        .limit(1);
      chapterId = existing!.id;
      console.info(`    [chapter] 기존: ${ch.order}편 "${ch.title}"`);
    }
    chapterIds.set(ch.order, chapterId);
  }

  // 3. 1편 본문 draft 저장 (published 가 아니면 항상 최신 원고로 갱신)
  const chapter1Id = chapterIds.get(1)!;
  const [ch1Row] = await db
    .select({ status: botCurriculumChapters.status })
    .from(botCurriculumChapters)
    .where(eq(botCurriculumChapters.id, chapter1Id))
    .limit(1);

  if (ch1Row?.status === "published") {
    console.info("  [1편] 이미 published — 본문 갱신 건너뜀");
  } else {
    const draftJson = parseResponseToTiptap(CHAPTER1_BODY);
    await db
      .update(botCurriculumChapters)
      .set({
        draftContent: draftJson,
        draftTextEditable: CHAPTER1_BODY,
        status: "drafted",
        updatedAt: new Date(),
      })
      .where(eq(botCurriculumChapters.id, chapter1Id));
    console.info("  [1편] 본문 draft 저장 완료 (status=drafted)");
  }

  // 4. 1편 이미지 슬롯 삽입 (ai_diagram)
  for (const slot of CHAPTER1_SLOTS) {
    await db
      .insert(botCurriculumImageSlots)
      .values({
        chapterId: chapter1Id,
        assetKey: slot.assetKey,
        caption: slot.caption,
        alt: slot.alt,
        guidance: `AI 도식 생성. 아래 프롬프트로 Gemini genImage 호출.\n프롬프트: ${slot.diagramPrompt}`,
        sourceKind: "ai_diagram",
        status: "pending",
        diagramPrompt: slot.diagramPrompt,
      })
      .onConflictDoNothing({
        target: [
          botCurriculumImageSlots.chapterId,
          botCurriculumImageSlots.assetKey,
        ],
      });
  }
  console.info(`  [1편] 이미지 슬롯 ${CHAPTER1_SLOTS.length}개 준비`);

  // 5. 이미지 생성 (Gemini → 업로드 → ready)
  if (SKIP_IMAGES) {
    console.info("  [이미지] SKIP_IMAGES=1 — 이미지 생성 건너뜀 (슬롯은 pending 유지)");
  } else {
    const slotRows = await db
      .select({ id: botCurriculumImageSlots.id, assetKey: botCurriculumImageSlots.assetKey })
      .from(botCurriculumImageSlots)
      .where(eq(botCurriculumImageSlots.chapterId, chapter1Id));

    for (const s of slotRows) {
      process.stdout.write(`  [이미지] ${s.assetKey} 생성 중... `);
      const result = await fillImageSlot(s.id, { force: FORCE });
      if (result.outcome === "filled") {
        console.info(`완료 → ${result.imageUrl}`);
      } else if (result.outcome === "skipped") {
        console.info(`건너뜀 (이미 ready)`);
      } else {
        console.info(`실패: ${result.reason}`);
      }
    }
  }

  // 6. 슬롯이 모두 ready 면 1편을 ready 로 승격 (발행은 하지 않음)
  const promote = await checkAndPromoteChapter(chapter1Id);
  console.info(
    `  [1편] 승격 판정 — ready=${promote.ready} (pending=${promote.pendingCount}/${promote.totalCount})`,
  );

  console.info("\n[seed-roadmap] 완료");
  console.info("  - 시리즈 1개 · 챕터 12편 적재");
  console.info("  - 1편: draft 저장 + 이미지 슬롯 2개");
  console.info("  - 2~12편: planned (제목/목표/소주제만)");
}

main()
  .catch((err) => {
    console.error("[seed-roadmap] 오류:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDb().catch(() => {});
  });
