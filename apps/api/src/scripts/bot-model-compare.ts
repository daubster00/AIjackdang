/**
 * 봇 모델 비교 작성 스크립트 (수동 검증용).
 *
 * 한 봇(감자세개)이 **같은 주제**로 글을 3번 쓰되,
 * 생성 모델만 각 제공사의 최고 사양으로 바꿔가며 작성한다.
 *   - GPT     : gpt-4.1        (openai)
 *   - 클로드   : claude-opus-4-5 (anthropic)
 *   - 제미나이 : gemini-2.5-pro  (google)
 *
 * 목적: "같은 페르소나·같은 주제"를 고정한 상태에서 모델별로 위트/구성/
 * 자연스러움이 어떻게 다른지 나란히 비교하기 위함.
 *
 * 주의점:
 *  - runPostPipeline을 쓰지 않는다. 파이프라인의 selectTopic이 DB에 쌓인
 *    미사용 주제를 우선 선택해 realtimeTopic(주입 주제)을 무시하기 때문 —
 *    "같은 주제 고정"이 깨진다. 그래서 여기서는 주제를 코드에 직접 고정하고
 *    생성→게시만 직접 호출한다.
 *  - 자기검열(censor)은 건너뛴다. 이 스크립트의 목적은 "글 작성 품질" 비교이지
 *    모더레이션 판정이 아니므로, 세 편 모두 확실히 게시되어야 나란히 비교된다.
 *  - 게시글 제목에 [모델비교·GPT] 같은 태그를 달아 감자세개 이름으로 talk에
 *    실제 게시한다(검토 후 삭제 가능).
 *
 * .env 는 @ai-jakdang/config 가 import 시점에 자동 로드한다.
 *
 * 실행: pnpm --filter @ai-jakdang/api exec tsx src/scripts/bot-model-compare.ts
 */

import { eq } from "drizzle-orm";
import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { callModel } from "@ai-jakdang/server-bot/ai";
import {
  buildPersonaSystemPrompt,
  buildPostUserPrompt,
} from "@ai-jakdang/bot-core";
import type { BotPersonaForPrompt } from "@ai-jakdang/bot-core";
import { createPostAsBot } from "../services/bot/write.js";

// ── 고정 설정 ─────────────────────────────────────────────────────────────────

const PERSONA_NICKNAME = "감자세개";
const BOARD = "talk";
const TOPIC = "AI 도구에 매달 돈 쓰는 거 여러분은 어떻게 생각하세요?";

/**
 * 각 제공사의 최고 사양(검증된 최상위) 모델.
 * gemini-2.5-pro는 내부 추론(thinking) 토큰을 소비하므로 maxTokens를 넉넉히
 * 줘야 실제 본문 파트가 빈 채로 반환되는 것을 막을 수 있다.
 * 재실행 시 이미 게시된 모델은 주석 처리해 중복 게시를 피한다.
 */
const MODELS: { label: string; provider: string; model: string; maxTokens?: number }[] = [
  { label: "GPT", provider: "openai", model: "gpt-4.1" },
  { label: "클로드", provider: "anthropic", model: "claude-opus-4-5" },
  { label: "제미나이", provider: "google", model: "gemini-2.5-pro", maxTokens: 4000 },
];

// ── 모델 응답 텍스트 → Tiptap JSON (경량 마크다운 변환) ────────────────────────

type Node = { type: string; text?: string; attrs?: Record<string, unknown>; content?: Node[] };

function toTiptap(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  // 모델이 Tiptap doc JSON을 그대로 반환한 경우 그대로 사용
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.type === "doc" && Array.isArray(parsed.content)) return parsed;
    } catch {
      /* 무시 → 마크다운 파싱 */
    }
  }
  const nodes: Node[] = [];
  const lines = trimmed.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = (lines[i] ?? "").trimEnd();
    // 코드펜스(```lang ... ```) — 내부는 원문 그대로 codeBlock으로 보존
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        code.push(lines[i] ?? "");
        i++;
      }
      i++; // 닫는 ``` 소비
      nodes.push({
        type: "codeBlock",
        attrs: lang ? { language: lang } : {},
        content: [{ type: "text", text: code.join("\n") }],
      });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.+)/);
    if (h) {
      nodes.push({ type: "heading", attrs: { level: h[1].length }, content: [{ type: "text", text: h[2] }] });
      i++;
      continue;
    }
    nodes.push({ type: "paragraph", content: [{ type: "text", text: line.replace(/\*\*(.*?)\*\*/g, "$1") }] });
    i++;
  }
  if (nodes.length === 0) nodes.push({ type: "paragraph", content: [{ type: "text", text: trimmed }] });
  return { type: "doc", content: nodes };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getDb();

  const [persona] = await db
    .select()
    .from(schema.botPersonas)
    .where(eq(schema.botPersonas.nickname, PERSONA_NICKNAME))
    .limit(1);

  if (!persona) {
    throw new Error(`페르소나 '${PERSONA_NICKNAME}' 를 찾을 수 없습니다.`);
  }

  const personaForPrompt: BotPersonaForPrompt = {
    nickname: persona.nickname,
    personaPrompt: persona.personaPrompt,
    tone: persona.tone,
    intentionalFlaws: persona.intentionalFlaws,
    isAdminPersona: persona.isAdminPersona,
    infoRatio: persona.infoRatio,
  };

  const systemPrompt = buildPersonaSystemPrompt(personaForPrompt);
  const userPrompt = buildPostUserPrompt({
    titleSeed: TOPIC,
    facts: { facts: [], sourceUrls: [], confidence: "low" },
    board: BOARD,
    postKind: "chat", // 감자세개는 info_ratio=10 → chat
  });

  console.info(
    `[bot-model-compare] '${PERSONA_NICKNAME}' → '${TOPIC}' 를 ${MODELS.length}개 모델로 작성 (게시판=${BOARD})\n`,
  );

  const results: {
    label: string;
    model: string;
    status: string;
    postId?: string;
    slug?: string;
    inTok?: number;
    outTok?: number;
    chars?: number;
    reason?: string;
  }[] = [];

  for (const m of MODELS) {
    console.info(`[bot-model-compare] ▶ ${m.label} (${m.provider}/${m.model}) 생성 중...`);

    // 잡 레코드 생성 (createPostAsBot이 jobId로 상태 업데이트)
    const [job] = await db
      .insert(schema.botGenerationJobs)
      .values({
        personaId: persona.id,
        jobKind: "post",
        targetBoard: BOARD,
        status: "generating",
        regenCount: 0,
      })
      .returning({ id: schema.botGenerationJobs.id });

    const jobId = job!.id;

    try {
      const gen = await callModel(
        { provider: m.provider, model: m.model },
        { system: systemPrompt, user: userPrompt, maxTokens: m.maxTokens ?? 1500 },
        { personaId: persona.id, jobId, usageContext: { purpose: "generation" } },
      );

      const contentJson = toTiptap(gen.text);
      const title = `[모델비교·${m.label}] ${TOPIC}`;
      const tags = ["모델비교", m.label, "챗GPT"];

      const write = await createPostAsBot({
        botUserId: persona.userId ?? persona.id,
        personaId: persona.id,
        jobId,
        postInput: { board: BOARD, title, contentJson, status: "published", tags },
      });

      let slug: string | undefined;
      if (write.refId) {
        const [row] = await db
          .select({ slug: schema.posts.slug })
          .from(schema.posts)
          .where(eq(schema.posts.id, write.refId))
          .limit(1);
        slug = row?.slug;
      }

      console.info(
        `[bot-model-compare] ✔ ${m.label}: ${write.status}` +
          (write.refId ? ` (postId=${write.refId})` : "") +
          ` [in=${gen.usage.inputTokens} out=${gen.usage.outputTokens} chars=${gen.text.length}]`,
      );

      results.push({
        label: m.label,
        model: m.model,
        status: write.status,
        postId: write.refId,
        slug,
        inTok: gen.usage.inputTokens,
        outTok: gen.usage.outputTokens,
        chars: gen.text.length,
      });
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`[bot-model-compare] ✘ ${m.label} 오류:`, msg);
      await db
        .update(schema.botGenerationJobs)
        .set({ status: "discarded", updatedAt: new Date() })
        .where(eq(schema.botGenerationJobs.id, jobId));
      results.push({ label: m.label, model: m.model, status: "error", reason: msg });
    }
  }

  // ── 결과 요약 ────────────────────────────────────────────────────────────────
  console.info("\n[bot-model-compare] ===== 결과 요약 =====");
  for (const r of results) {
    console.info(
      `  ${r.label.padEnd(6)} | ${r.model.padEnd(18)} | ${r.status.padEnd(10)}` +
        (r.slug ? ` | /talk/${r.slug}` : "") +
        (r.chars != null ? ` | ${r.chars}자(in ${r.inTok}/out ${r.outTok} tok)` : "") +
        (r.reason ? ` | ${r.reason}` : ""),
    );
  }
  const ok = results.filter((r) => r.status === "published").length;
  console.info(`\n[bot-model-compare] 게시 성공 ${ok}/${results.length}`);
  console.info("[bot-model-compare] (자기검열은 비교 목적상 생략했습니다)");
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[bot-model-compare] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
