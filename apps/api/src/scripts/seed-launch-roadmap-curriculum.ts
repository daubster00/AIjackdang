/**
 * "바이브 코딩 실전 서비스 출시 로드맵" 12편 커리큘럼 플랜 시드 스크립트 (멱등).
 *
 * 바이브 코딩으로 만든 결과물을 실제 서비스로 출시하기까지의 전 과정을
 * 기획 → 구조 → 형상관리 → DB/회원 → 보안 → 검수 → 환경분리 → 배포 →
 * 도메인/HTTPS → 운영(로그·백업·보안) → 유지보수 → 최종 점검표 순으로
 * 12편에 걸쳐 다루는 실전형 로드맵.
 *  - 시리즈: "바이브 코딩 실전 서비스 출시 로드맵" (board=vibe-coding-guide)
 *    — 기존 "바이브 코딩 입문 로드맵"·"제로부터 바이브코딩"과 같은 게시판에서 공존.
 *  - 1~12편: 제목/학습목표/소주제(outline)만 status=planned 로 적재.
 *    (본문·이미지는 이후 관리자 초안 생성 단계에서 채운다.)
 *
 * 재실행 안전:
 *  - 시리즈/챕터는 유니크 키(series.title / chapters.(series_id, order_index)) 기준
 *    ON CONFLICT DO NOTHING. 이미 있으면 건드리지 않는다.
 *
 * 실행:
 *   pnpm --filter @ai-jakdang/api exec tsx src/scripts/seed-launch-roadmap-curriculum.ts
 */

import { getDb, closeDb } from "@ai-jakdang/database";
import {
  botCurriculumSeries,
  botCurriculumChapters,
} from "@ai-jakdang/database/schema";
import { eq } from "drizzle-orm";

// ── 시리즈 헤더 ─────────────────────────────────────────────────────────────────

const SERIES = {
  title: "바이브 코딩 실전 서비스 출시 로드맵",
  board: "vibe-coding-guide",
  tool: "Cursor · Claude Code · Git/GitHub · PostgreSQL · 서버 배포(도메인·HTTPS)",
  intro:
    "바이브 코딩으로 만든 결과물을 실제 사용자가 쓰는 서비스로 출시하기까지의 전 과정을 담은 실전 로드맵. 입문자가 코딩보다 더 자주 막히는 지점 — 기능 범위 정의, 프로젝트 구조, Git 형상관리, 데이터베이스·회원 연결, API 키·환경변수 보안, 코드 검수, 운영/테스트 환경 분리, 서버 배포, 도메인·HTTPS, 오류 로그·백업·보안, 출시 후 안전한 업데이트, 그리고 최종 점검표까지 — 을 실제 웹 개발·서버 운영 경험을 바탕으로 12편에 걸쳐 단계별로 정리한다.",
};

// ── 12편 챕터 정의 (전편 제목/목표/소주제만, status=planned) ──────────────────────

interface ChapterDef {
  order: number;
  title: string;
  goal: string;
  outline: string[];
}

const CHAPTERS: ChapterDef[] = [
  {
    order: 1,
    title: "개발 전 기능 범위와 화면 구조 정하기",
    goal: "코드를 짜기 전에 '무엇을 어디까지 만들 것인가'를 먼저 확정하는 법을 익힌다. 기능 범위(스코프)와 핵심 화면 구조를 미리 정의해 두면 AI에게 일관된 지시를 내릴 수 있고, 중간에 방향이 흔들려 다시 뜯어고치는 사고를 막을 수 있다.",
    outline: [
      "출시할 서비스의 한 문장 정의와 핵심 사용자 흐름",
      "1차 출시에 포함할 기능 vs 나중으로 미룰 기능 나누기",
      "주요 화면 목록과 화면 간 이동(내비게이션) 스케치",
      "각 화면에 필요한 데이터와 버튼·입력 요소 정리",
      "범위를 문서로 남겨 AI 지시의 기준선으로 삼기",
    ],
  },
  {
    order: 2,
    title: "AI가 이해하기 좋은 프로젝트 구조 만들기",
    goal: "AI가 프로젝트 전체 맥락을 잃지 않도록 폴더·파일 구조를 깔끔하게 잡는 법을 배운다. 프론트/백엔드/설정 파일을 어떻게 나누고, README·규칙 파일로 어떻게 맥락을 제공하는지 익혀 AI가 엉뚱한 곳을 고치는 일을 줄인다.",
    outline: [
      "왜 폴더 구조가 AI 코드 품질을 좌우하나",
      "프론트엔드·백엔드·설정을 나누는 기본 구조",
      "README·프로젝트 설명 파일로 맥락 제공하기",
      "일관된 파일·폴더 이름 규칙 정하기",
      "AI에게 작업 범위를 좁혀 지시하는 방법",
    ],
  },
  {
    order: 3,
    title: "Git과 GitHub로 작업 내용 보관하기",
    goal: "잘 되던 코드가 AI의 수정 한 번에 망가져도 되돌릴 수 있도록 Git·GitHub로 작업을 안전하게 보관하는 법을 익힌다. 커밋·되돌리기·원격 저장의 기본 개념을 잡아 '백업 없이 수정하다 날리는' 사고를 방지한다.",
    outline: [
      "Git이 왜 바이브 코딩의 안전장치인가",
      "커밋 = 정상 작동하는 시점 저장하기",
      "문제가 생겼을 때 이전 상태로 되돌리기",
      "GitHub에 원격 저장·백업하기",
      "AI에게 커밋을 요청하는 흐름과 주의점",
    ],
  },
  {
    order: 4,
    title: "데이터베이스와 회원 기능 연결하기",
    goal: "회원 가입·로그인과 데이터 저장이 필요한 서비스의 뼈대를 이해한다. 데이터베이스가 무엇이고 회원 정보·게시글 같은 데이터가 어떻게 저장·조회되는지, AI에게 어떻게 요청해야 안전하게 연결되는지 익힌다.",
    outline: [
      "데이터베이스 = 데이터를 저장하는 창고 개념 잡기",
      "회원 가입·로그인이 동작하는 기본 원리",
      "저장할 데이터 항목(테이블·필드) 미리 설계하기",
      "비밀번호·개인정보를 안전하게 다루는 최소 원칙",
      "AI에게 DB·회원 기능을 단계별로 요청하는 법",
    ],
  },
  {
    order: 5,
    title: "외부 API와 환경변수 안전하게 관리하기",
    goal: "결제·메일·AI 같은 외부 서비스를 연결할 때 쓰는 API 키를 안전하게 다루는 법을 배운다. 환경변수로 비밀 키를 분리하고, 코드나 GitHub에 키가 노출되지 않게 하는 습관을 들여 유출 사고를 막는다.",
    outline: [
      "외부 API와 API 키가 무엇인가",
      "환경변수(.env)로 비밀 키를 코드와 분리하기",
      "GitHub에 키가 올라가지 않게 막기(gitignore)",
      "키가 유출됐을 때 벌어지는 일과 대응",
      "AI에게 키를 다루게 할 때의 안전 지시법",
    ],
  },
  {
    order: 6,
    title: "AI가 만든 코드를 직접 검수하는 방법",
    goal: "AI가 짠 코드를 맹신하지 않고 스스로 점검하는 눈을 기른다. 겉보기엔 잘 돌아가도 내부에 보안 구멍·버그가 숨어 있을 수 있으므로, 비개발자도 할 수 있는 수준의 검수 포인트와 확인 절차를 익힌다.",
    outline: [
      "왜 AI 코드를 그대로 믿으면 안 되는가",
      "변경된 코드(diff)를 훑어보는 기본 요령",
      "실제로 구동해 보며 기능·예외 케이스 확인",
      "AI에게 '이 코드가 안전한지' 되묻고 설명받기",
      "의심스러운 부분을 표시하고 다시 고치게 하기",
    ],
  },
  {
    order: 7,
    title: "테스트 환경과 실제 운영 환경 구분하기",
    goal: "내 컴퓨터에서 시험하는 환경과 실제 사용자가 쓰는 운영 환경을 분리해야 하는 이유를 이해한다. 두 환경의 설정·데이터를 섞으면 벌어지는 사고를 알고, 안전하게 시험한 뒤 배포하는 흐름을 잡는다.",
    outline: [
      "개발(로컬)·테스트·운영 환경의 차이",
      "환경을 섞었을 때 생기는 대표적 사고",
      "환경별 설정·데이터베이스를 나누는 원리",
      "먼저 시험하고 나중에 반영하는 배포 흐름",
      "AI에게 환경 구분을 지시하는 법",
    ],
  },
  {
    order: 8,
    title: "서버에 웹서비스 배포하기",
    goal: "내 컴퓨터에서만 돌던 결과물을 전 세계가 접속할 수 있는 서버에 올리는 과정을 익힌다. 배포가 무엇인지, 어떤 방식(플랫폼·서버)이 있는지 이해하고 첫 배포를 무사히 마치는 것을 목표로 한다.",
    outline: [
      "배포 = 결과물을 인터넷에 올리는 것",
      "배포 방식 비교(간편 플랫폼 vs 직접 서버)",
      "배포 전 준비물(빌드·환경변수·설정) 점검",
      "첫 배포 진행과 접속 확인",
      "배포가 실패할 때 원인 찾는 기본 방법",
    ],
  },
  {
    order: 9,
    title: "도메인과 HTTPS 연결하기",
    goal: "임시 주소가 아니라 내 도메인으로 서비스를 열고, 자물쇠(HTTPS) 보안 연결을 붙이는 법을 익힌다. 도메인 구입·연결과 SSL 인증서 적용의 개념을 잡아 신뢰할 수 있는 주소로 서비스를 공개한다.",
    outline: [
      "도메인이 무엇이고 어떻게 구입·연결하나",
      "도메인을 서버에 연결하는 기본 원리(DNS)",
      "HTTPS와 SSL 인증서가 필요한 이유",
      "인증서 적용해 자물쇠 표시 붙이기",
      "연결이 안 될 때 확인하는 체크포인트",
    ],
  },
  {
    order: 10,
    title: "오류 로그·백업·보안 기본 설정하기",
    goal: "서비스를 열어둔 뒤 반드시 갖춰야 할 운영 기본기를 세운다. 오류를 기록하는 로그, 데이터가 날아가지 않게 하는 백업, 최소한의 보안 설정을 이해해 사고가 나도 복구·대응할 수 있게 만든다.",
    outline: [
      "오류 로그를 남겨야 하는 이유와 확인법",
      "데이터 백업 주기와 복구 시나리오",
      "최소한의 보안 설정(접근 제한·기본 방어)",
      "이상 징후를 빨리 알아채는 알림 개념",
      "AI에게 로그·백업·보안을 요청하는 법",
    ],
  },
  {
    order: 11,
    title: "출시 후 수정과 업데이트를 안전하게 진행하기",
    goal: "이미 사용자가 쓰고 있는 서비스를 고칠 때 서비스를 망가뜨리지 않고 업데이트하는 법을 배운다. 먼저 시험하고, 되돌릴 수 있게 준비하고, 조금씩 반영하는 안전한 유지보수 습관을 익힌다.",
    outline: [
      "운영 중 서비스를 고칠 때의 위험",
      "테스트 환경에서 먼저 검증하기",
      "문제가 생기면 즉시 되돌릴 수 있게 준비",
      "작은 단위로 나눠 반영하기",
      "사용자 영향과 공지·타이밍 고려",
    ],
  },
  {
    order: 12,
    title: "실제 사용자를 받기 전 최종 점검표",
    goal: "출시 직전 마지막으로 확인해야 할 항목을 한 번에 점검한다. 기능·보안·성능·데이터·법적 준비까지 놓치기 쉬운 부분을 체크리스트로 정리해 자신 있게 실제 사용자를 받는 것으로 시리즈를 마무리한다.",
    outline: [
      "기능·화면 최종 동작 점검",
      "보안·개인정보·API 키 노출 재확인",
      "백업·로그·오류 대응 준비 확인",
      "속도·모바일·예외 상황 점검",
      "출시 후 문의·상담 연결 창구 준비",
    ],
  },
];

// ── 메인 ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getDb();

  console.info("[seed-launch-roadmap] 시작 — 바이브 코딩 실전 서비스 출시 로드맵 12편");

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

  // 2. 챕터 삽입 (planned)
  let inserted = 0;
  let skipped = 0;
  for (const ch of CHAPTERS) {
    const rows = await db
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

    if (rows.length > 0) {
      inserted += 1;
      console.info(`    [chapter] 삽입: ${ch.order}편 "${ch.title}"`);
    } else {
      skipped += 1;
      console.info(`    [chapter] 기존(건너뜀): ${ch.order}편 "${ch.title}"`);
    }
  }

  console.info("\n[seed-launch-roadmap] 완료");
  console.info(`  - 시리즈 1개 · 챕터 삽입 ${inserted}편 / 기존 ${skipped}편`);
  console.info("  - 전편 status=planned (제목/목표/소주제만, 본문·이미지는 이후 초안 생성)");
}

main()
  .catch((err) => {
    console.error("[seed-launch-roadmap] 오류:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDb().catch(() => {});
  });
