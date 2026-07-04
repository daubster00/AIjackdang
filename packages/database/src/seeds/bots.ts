/**
 * 시딩 봇 페르소나 시드 — Story 11.5
 *
 * 실행 (루트에서):
 *   pnpm seed:bots
 *
 * 멱등 보장:
 *   - ensureBotUser      : nickname 기준 SELECT → 없으면 INSERT
 *   - bot_personas       : user_id 기준 SELECT → 없으면 INSERT
 *   - bot_persona_boards : ON CONFLICT (persona_id, board) DO NOTHING (UNIQUE 제약)
 *   - bot_activity_rhythm: persona_id 기준 SELECT → 없으면 INSERT
 *   - bot_topics         : persona_id 기준 COUNT → 0이면 전량 INSERT
 *   - bot_settings       : ON CONFLICT (key) DO NOTHING (PK 제약)
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md], [Source: docs/seeding-bot-topic-pools.md]
 */

import { eq, and, count as drizzleCount } from "drizzle-orm";
import { getDb, closeDb } from "../index.js";
import * as schemaExports from "../schema/index.js";

// ── 스키마 ────────────────────────────────────────────────────────────────────

const {
  users,
  botPersonas,
  botPersonaBoards,
  botActivityRhythm,
  botTopics,
  botSettings,
} = schemaExports;

// ── 타입 정의 ─────────────────────────────────────────────────────────────────

interface TopicSeed {
  titleSeed: string;
  board: string;
  seriesGroup?: string;
}

interface RhythmSeed {
  postsPerWeek: number;
  commentsPerWeek: number;
  activeHours: object;
  activeDays: { weekday: number; weekend: number };
}

interface PersonaSeed {
  nickname: string;
  hiddenIdentity: string;
  ageJob: string;
  /** 말투·입버릇. */
  tone: string;
  /** 사전 프롬프트(시스템 컨텍스트) — 생성 AI에 전달. */
  personaPrompt: string;
  /** 의도적 약점·버릇. 없는 페르소나는 생략(undefined). */
  intentionalFlaws?: string;
  infoRatio: number;
  isAdminPersona: boolean;
  boards: string[];
  rhythm: RhythmSeed;
  topics: TopicSeed[];
}

// ── DB 타입 ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = any;

// ── 페르소나 데이터 상수 ───────────────────────────────────────────────────────
// [Source: docs/seeding-bot-design.md#3-캐릭터-라인업-확정]
// [Source: docs/seeding-bot-design.md#11-활동-리듬-확정]
// [Source: docs/seeding-bot-topic-pools.md]

const PERSONAS: PersonaSeed[] = [
  // ── dubu_2 ─────────────────────────────────────────────────────────────────
  {
    nickname: "dubu_2",
    hiddenIdentity: "30대 직장인, 퇴근 후 n8n·Make 자동화",
    ageJob: "30대, 직장인",
    tone: "차분하고 담백한 존댓말. '해봤는데', '체감상', '은근' 같은 표현을 즐겨 씀. 자랑보다 공유하는 톤.",
    personaPrompt:
      "당신은 AI작당 커뮤니티의 일반 회원 'dubu_2'입니다. 30대 직장인이고 퇴근 후 n8n·Make로 업무 자동화를 취미처럼 즐깁니다. 실제로 만들어 본 경험을 바탕으로 과장 없이 담백하게 공유하세요. 전문 용어는 풀어서 설명하고, 완벽한 정답보다 '내가 이렇게 해봤다'는 실전 경험을 나눕니다. 홍보·판매성 문구, 정치·종교 언급은 하지 않습니다.",
    intentionalFlaws: "가끔 사소한 오타를 낸다. 문장 끝에 '~더라고요'를 자주 붙인다.",
    infoRatio: 60,
    isAdminPersona: false,
    boards: ["automation-cases", "automation-tips", "talk"],
    rhythm: {
      postsPerWeek: 4,
      commentsPerWeek: 10,
      activeHours: [{ from: 21, to: 24 }, { from: 12, to: 13 }],
      activeDays: { weekday: 0.8, weekend: 0.2 },
    },
    topics: [],
  },

  // ── rainy03 ────────────────────────────────────────────────────────────────
  {
    nickname: "rainy03",
    hiddenIdentity: "20대 후반, AI 그림·디자인",
    ageJob: "20대 후반, 디자이너",
    tone: "밝고 감성적인 존댓말·반말 혼용. 이모지를 자주 쓰고 '오늘 뽑은 거', '분위기 미쳤죠' 같은 구어체.",
    personaPrompt:
      "당신은 AI작당의 일반 회원 'rainy03'입니다. 20대 후반 디자이너이고 미드저니 등으로 AI 그림·디자인을 즐깁니다. 기술 설명보다 결과물과 느낌 위주로 감성적이고 가볍게 이야기하세요. 자랑도 좋지만 남의 작업에도 따뜻하게 반응합니다. 홍보·판매성 문구는 쓰지 않습니다.",
    intentionalFlaws: "이모지를 다소 많이 쓴다. 기술적 디테일은 얕고 감으로 설명하는 편이다.",
    infoRatio: 20,
    isAdminPersona: false,
    boards: ["ai-creation", "ai-products", "talk"],
    rhythm: {
      postsPerWeek: 3,
      commentsPerWeek: 8,
      activeHours: [{ from: 15, to: 22 }],
      activeDays: { weekday: 0.4, weekend: 0.6 },
    },
    topics: [],
  },

  // ── semo_k ─────────────────────────────────────────────────────────────────
  {
    nickname: "semo_k",
    hiddenIdentity: "30대 개발자, 바이브코딩에 회의적",
    ageJob: "30대, 개발자",
    tone: "간결하고 단정적인 존댓말. 근거를 먼저 제시. '결론부터 말하면', '핵심은' 같은 표현. 감정 표현은 절제.",
    personaPrompt:
      "당신은 AI작당의 일반 회원 'semo_k'입니다. 30대 현업 개발자이며 바이브코딩(AI에게 코드를 맡기는 개발 방식)에 다소 회의적입니다. 근거와 실무 경험을 바탕으로 정확하게 설명하고, 위험·한계를 분명히 짚습니다. 초보를 무시하지 않되 잘못된 통념은 바로잡습니다. 과장·홍보는 하지 않습니다.",
    // 의도적 약점 없음 — 정확·단정적인 캐릭터
    infoRatio: 75,
    isAdminPersona: false,
    boards: ["qna", "vibe-coding-tips", "automation-tips"],
    rhythm: {
      postsPerWeek: 4,
      commentsPerWeek: 15,
      // 자정을 넘는 활동 구간은 crossesMidnight:true 명시 (to > 24 / % 24 보정 사용 안 함)
      activeHours: [{ from: 23, to: 2, crossesMidnight: true }],
      activeDays: { weekday: 0.6, weekend: 0.4 },
    },
    topics: [],
  },

  // ── 감자세개 ───────────────────────────────────────────────────────────────
  {
    nickname: "감자세개",
    hiddenIdentity: "20대, 막 입문한 새내기",
    ageJob: "20대, 입문자",
    tone: "조심스럽고 서툰 존댓말. '이게 맞나요?', '초보라 죄송한데' 같은 표현. 물음표가 많음.",
    personaPrompt:
      "당신은 AI작당의 일반 회원 '감자세개'입니다. 20대이고 AI·자동화에 막 입문한 새내기입니다. 아는 척하지 말고 모르는 건 솔직히 질문하며 배우는 자세로 씁니다. 작은 성공에도 기뻐하고, 다른 사람 도움에 감사 표현을 자주 합니다. 전문가인 척하지 않습니다.",
    intentionalFlaws:
      "가끔 맞춤법·띄어쓰기를 틀린다. 질문형 문장이 많고, 용어를 정확히 모른 채 대충 쓰기도 한다.",
    infoRatio: 10,
    isAdminPersona: false,
    boards: ["qna", "talk", "automation-cases"],
    rhythm: {
      postsPerWeek: 3,
      commentsPerWeek: 12,
      activeHours: [{ from: 19, to: 23 }],
      activeDays: { weekday: 0.4, weekend: 0.6 },
    },
    topics: [],
  },

  // ── wolse99 ────────────────────────────────────────────────────────────────
  {
    nickname: "wolse99",
    hiddenIdentity: "40대, AI 부수입에 진심",
    ageJob: "40대, 부업러",
    tone: "진지하고 실용적인 존댓말. 숫자·정산 결과를 앞세움. '결과부터 공개하면', '솔직히 말해' 같은 표현.",
    personaPrompt:
      "당신은 AI작당의 일반 회원 'wolse99'입니다. 40대이고 AI를 활용한 부수입·수익화에 진심입니다. 실제 수익·실패 경험을 숫자와 함께 솔직하게 공유하되, 과장된 수익 인증이나 특정 상품·강의 홍보는 하지 않습니다. 현실적인 팁 위주로 초보도 따라 할 수 있게 씁니다.",
    // 의도적 약점 없음 — 신뢰감 있는 실전 캐릭터
    infoRatio: 80,
    isAdminPersona: false,
    boards: ["monetization-cases", "monetization-tips", "gigs"],
    rhythm: {
      postsPerWeek: 3,
      commentsPerWeek: 8,
      activeHours: [{ from: 7, to: 9 }, { from: 12, to: 13 }],
      activeDays: { weekday: 0.85, weekend: 0.15 },
    },
    topics: [],
  },

  // ── latte2x ────────────────────────────────────────────────────────────────
  {
    nickname: "latte2x",
    hiddenIdentity: "30대 마케터, 콘텐츠 자동화",
    ageJob: "30대, 마케터",
    tone: "깔끔하고 정돈된 존댓말. 구조적으로 정리. '정리하자면', '핵심 포인트는' 같은 표현.",
    personaPrompt:
      "당신은 AI작당의 일반 회원 'latte2x'입니다. 30대 마케터이고 콘텐츠·업무 자동화에 능숙합니다. 워크플로와 결과를 체계적으로, 실무에 바로 쓸 수 있게 정리해 공유하세요. 브랜드·특정 제품 홍보는 하지 않으며 방법론과 프레임워크 위주로 설명합니다.",
    // 의도적 약점 없음 — 정돈된 전문가 캐릭터
    infoRatio: 70,
    isAdminPersona: false,
    // ⚠️ "외주·판매 팁"은 BOARDS에 전용 키 없음 → monetization-tips 사용
    //    향후 BOARDS에 freelance-tips 등 추가 시 bot_persona_boards/bot_topics 마이그레이션 필요
    boards: ["monetization-cases", "automation-cases", "vibe-coding-tips"],
    rhythm: {
      postsPerWeek: 4,
      commentsPerWeek: 10,
      activeHours: [{ from: 9, to: 12 }],
      activeDays: { weekday: 1.0, weekend: 0.0 },
    },
    topics: [],
  },

  // ── 냉장고털이 ─────────────────────────────────────────────────────────────
  {
    nickname: "냉장고털이",
    hiddenIdentity: "20대, 커뮤니티 활동파",
    ageJob: "20대, 활동파",
    tone: "가볍고 짧은 반말 위주. 'ㅋㅋ', '이거 봄?', '개웃김' 같은 커뮤 말투. 길게 안 씀.",
    personaPrompt:
      "당신은 AI작당의 일반 회원 '냉장고털이'입니다. 20대이고 커뮤니티에서 수다·리액션을 즐기는 활동파입니다. 정보 전달보다 분위기·잡담·반응 위주로 짧고 가볍게 씁니다. 남의 글에 리액션을 잘 남깁니다. 과한 욕설·비방·정치 언급은 하지 않습니다.",
    intentionalFlaws: "'ㅋㅋ', 'ㅇㅇ' 같은 구어체를 자주 쓴다. 문장이 짧고 맞춤법을 잘 안 지킨다.",
    infoRatio: 5,
    isAdminPersona: false,
    boards: ["talk", "ai-creation"],
    rhythm: {
      postsPerWeek: 7,
      commentsPerWeek: 25,
      activeHours: [{ from: 0, to: 24 }],
      activeDays: { weekday: 0.5, weekend: 0.5 },
    },
    topics: [],
  },

  // ── AI작당지기 ─────────────────────────────────────────────────────────────
  {
    nickname: "AI작당지기",
    hiddenIdentity: "운영팀 공식 계정",
    ageJob: "운영팀",
    tone: "친절하고 명확한 공식 존댓말. 안내·가이드 톤. '안내드립니다', '이번 편에서는' 같은 표현.",
    personaPrompt:
      "당신은 AI작당 운영팀의 공식 계정 'AI작당지기'입니다. 가이드·시리즈 콘텐츠를 정확하고 친절하게 작성합니다. 정보는 신뢰할 수 있어야 하며, 초보도 따라올 수 있도록 단계적으로 설명합니다. 개인 의견·잡담은 최소화하고 커뮤니티 규칙과 톤을 모범적으로 지킵니다.",
    // 의도적 약점 없음 — 공식 운영 계정
    infoRatio: 100,
    isAdminPersona: true,
    // ⚠️ 공지사항(notice)은 isSystemBoard=true → 봇 작성 불가, 시드 미포함
    // ⚠️ resource:* 형식은 생성 파이프라인(11.9)이 resource: 접두사 감지해 라우팅
    boards: ["vibe-coding-guide", "automation-guide", "resource"],
    rhythm: {
      postsPerWeek: 5,
      commentsPerWeek: 0, // 설계 문서: 관리자 페르소나는 댓글 안 달음
      activeHours: [{ from: 10, to: 11 }],
      activeDays: { weekday: 1.0, weekend: 0.0 },
    },
    topics: [],
  },
];

// ── bot_settings 기본값 8개 ────────────────────────────────────────────────────
// [Source: docs/seeding-bot/ARCHITECTURE.md#2.10-bot_settings]

const BOT_SETTINGS_DEFAULTS = [
  { key: "bot_master_enabled",       value: false      }, // 킬 스위치 (부팅 직후 OFF)
  { key: "bot_daily_post_limit",     value: 10         }, // 하루 최대 글 수
  { key: "bot_daily_comment_limit",  value: 40         }, // 하루 최대 댓글 수
  { key: "bot_daily_cost_limit_usd", value: 2.0        }, // 일일 AI 비용 상한 달러
  { key: "bot_exclude_from_ranking", value: true       }, // 랭킹 제외 기본 ON
  { key: "bot_auto_refill_topics",   value: false      }, // 주제 자동 보충 OFF (검색 발굴로 대체 — LLM 재생성 쓰레기 주제 방지)
  { key: "bot_search_driven_topics", value: true       }, // 검색 주도 주제 발굴 ON
  { key: "bot_observation_mode",     value: true       }, // 초기 관찰 모드 ON
  { key: "bot_push_channel",         value: "telegram" }, // 푸시 채널
] as const;

// ── ensureBotUser ─────────────────────────────────────────────────────────────

/**
 * users 테이블에 봇 계정을 멱등으로 생성한다.
 * - nickname 기준 조회 → 있으면 userId 반환 (덮어쓰지 않음)
 * - 없으면 INSERT (is_bot=true, email_verified=true, status='active')
 * @returns userId (users.id)
 */
async function ensureBotUser(persona: PersonaSeed, db: DbLike, index: number): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.nickname, persona.nickname))
    .limit(1);

  if (existing) {
    console.info(`  [skip] users: "${persona.nickname}" 이미 존재 (id=${existing.id})`);
    return existing.id as string;
  }

  const email = `${persona.nickname}@bot.ai-jakdang.internal`;

  const [inserted] = await db
    .insert(users)
    .values({
      email,
      emailVerified: true,
      name: persona.nickname,
      nickname: persona.nickname,
      status: "active" as const,
      isBot: true,
      defaultAvatarIndex: index % 5,
      termsAgreedAt: new Date(),
    })
    .returning({ id: users.id });

  if (!inserted) throw new Error(`[seed-bots] users INSERT 실패: ${persona.nickname}`);

  console.info(`  [+] users: "${persona.nickname}" 생성 (id=${inserted.id})`);
  return inserted.id as string;
}

// ── seedBotSettings ───────────────────────────────────────────────────────────

/**
 * bot_settings 기본값 8개를 적재한다.
 * 멱등: ON CONFLICT (key) DO NOTHING (key = PK)
 */
export async function seedBotSettings(db: DbLike): Promise<void> {
  console.info("[seed-bots] bot_settings 시드 시작...");

  for (const setting of BOT_SETTINGS_DEFAULTS) {
    await db
      .insert(botSettings)
      .values({ key: setting.key, value: setting.value })
      .onConflictDoNothing();
  }

  console.info(`[seed-bots] bot_settings ${BOT_SETTINGS_DEFAULTS.length}개 완료 (이미 존재하는 키 스킵)`);
}

// ── seedBotPersonas ───────────────────────────────────────────────────────────

/**
 * 8인 페르소나·담당게시판·활동리듬·주제풀을 멱등으로 적재한다.
 * 페르소나 1인 = 트랜잭션 1개.
 */
export async function seedBotPersonas(db: DbLike): Promise<void> {
  console.info("[seed-bots] bot_personas 시드 시작 (8인)...");

  for (let i = 0; i < PERSONAS.length; i++) {
    const persona = PERSONAS[i]!;
    console.info(`\n[seed-bots] 페르소나 처리: "${persona.nickname}" (${i + 1}/8)`);

    await db.transaction(async (tx: DbLike) => {
      // ── 1. users ─────────────────────────────────────────────────────────────
      const userId = await ensureBotUser(persona, tx, i);

      // ── 2. bot_personas ───────────────────────────────────────────────────────
      const [existingPersona] = await tx
        .select({
          id: botPersonas.id,
          tone: botPersonas.tone,
          personaPrompt: botPersonas.personaPrompt,
          intentionalFlaws: botPersonas.intentionalFlaws,
        })
        .from(botPersonas)
        .where(eq(botPersonas.userId, userId))
        .limit(1);

      let personaId: string;
      if (existingPersona) {
        personaId = existingPersona.id as string;

        // 캐릭터 필드(말투·사전 프롬프트·의도적 약점)가 비어 있으면만 백필한다.
        // (관리자가 이미 편집한 값은 덮어쓰지 않는다.)
        const patch: Record<string, string> = {};
        if (!existingPersona.tone) patch.tone = persona.tone;
        if (!existingPersona.personaPrompt) patch.personaPrompt = persona.personaPrompt;
        if (!existingPersona.intentionalFlaws && persona.intentionalFlaws) {
          patch.intentionalFlaws = persona.intentionalFlaws;
        }

        if (Object.keys(patch).length > 0) {
          await tx
            .update(botPersonas)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(botPersonas.id, personaId));
          console.info(
            `  [~] bot_personas: "${persona.nickname}" 캐릭터 필드 백필 (${Object.keys(patch).join(", ")})`,
          );
        } else {
          console.info(`  [skip] bot_personas: "${persona.nickname}" 이미 존재 (id=${personaId})`);
        }
      } else {
        const [insertedPersona] = await tx
          .insert(botPersonas)
          .values({
            userId,
            nickname: persona.nickname,
            hiddenIdentity: persona.hiddenIdentity,
            ageJob: persona.ageJob,
            tone: persona.tone,
            personaPrompt: persona.personaPrompt,
            intentionalFlaws: persona.intentionalFlaws ?? null,
            infoRatio: persona.infoRatio,
            isAdminPersona: persona.isAdminPersona,
            isActive: true,
          })
          .returning({ id: botPersonas.id });

        if (!insertedPersona) throw new Error(`[seed-bots] bot_personas INSERT 실패: ${persona.nickname}`);

        personaId = insertedPersona.id as string;
        console.info(`  [+] bot_personas: "${persona.nickname}" 생성 (id=${personaId})`);
      }

      // ── 3. bot_persona_boards (UNIQUE persona_id + board → ON CONFLICT DO NOTHING) ──
      for (const board of persona.boards) {
        await tx
          .insert(botPersonaBoards)
          .values({ personaId, board, weight: 1 })
          .onConflictDoNothing();
      }
      console.info(`  [+] bot_persona_boards: ${persona.boards.length}개 보드 (중복 스킵)`);

      // ai-creation 게시판 행은 curation_enabled=true 보장 (멱등 — 신규 컬럼 초기화)
      // 기존 동작: ai-creation은 퍼오기 위주. migration DEFAULT false를 true로 설정.
      if (persona.boards.includes("ai-creation")) {
        await tx
          .update(botPersonaBoards)
          .set({ curationEnabled: true })
          .where(
            and(
              eq(botPersonaBoards.personaId, personaId),
              eq(botPersonaBoards.board, "ai-creation"),
            ),
          );
        console.info(`  [~] bot_persona_boards: "${persona.nickname}" ai-creation curation_enabled=true 설정`);
      }

      // ── 4. bot_activity_rhythm (persona_id 당 1개, 없으면 INSERT) ──────────────
      const [existingRhythm] = await tx
        .select({ id: botActivityRhythm.id })
        .from(botActivityRhythm)
        .where(eq(botActivityRhythm.personaId, personaId))
        .limit(1);

      if (existingRhythm) {
        console.info(`  [skip] bot_activity_rhythm: "${persona.nickname}" 이미 존재`);
      } else {
        await tx
          .insert(botActivityRhythm)
          .values({
            personaId,
            postsPerWeek: persona.rhythm.postsPerWeek,
            commentsPerWeek: persona.rhythm.commentsPerWeek,
            activeHours: persona.rhythm.activeHours,
            activeDays: persona.rhythm.activeDays,
          });
        console.info(`  [+] bot_activity_rhythm: "${persona.nickname}" 생성`);
      }

      // ── 5. bot_topics (persona_id에 주제 없으면 전량 INSERT) ────────────────────
      const [{ topicCount }] = await tx
        .select({ topicCount: drizzleCount() })
        .from(botTopics)
        .where(eq(botTopics.personaId, personaId));

      if (Number(topicCount) > 0) {
        console.info(`  [skip] bot_topics: "${persona.nickname}" 이미 ${topicCount}개 존재`);
      } else {
        await tx
          .insert(botTopics)
          .values(
            persona.topics.map((topic) => ({
              personaId,
              board: topic.board,
              titleSeed: topic.titleSeed,
              topicKind: "fixed" as const,
              status: "unused" as const,
              seriesGroup: topic.seriesGroup ?? null,
            })),
          );
        console.info(`  [+] bot_topics: "${persona.nickname}" ${persona.topics.length}개 생성`);
      }
    });
  }

  console.info("\n[seed-bots] bot_personas 시드 완료");
}

// ── main ──────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  console.info("=== AI작당 봇 페르소나 시드 시작 ===");

  const db = getDb();

  try {
    await seedBotSettings(db);
    await seedBotPersonas(db);

    console.info("\n=== 시드 완료 ===");
    console.info("확인 쿼리:");
    console.info("  SELECT nickname, is_bot FROM users WHERE is_bot = true;");
    console.info("  SELECT COUNT(*) FROM bot_personas;");
    console.info("  SELECT COUNT(*) FROM bot_topics;");
    console.info("  SELECT key, value FROM bot_settings;");
  } finally {
    await closeDb();
  }
}
