/**
 * contentGuard — Fastify preHandler 미들웨어 (Story 9.11, AC #3·#4).
 *
 * 콘텐츠 작성 API(POST /posts, POST /qna/questions, POST /qna/answers,
 * POST /comments)에 걸어 스팸 링크는 차단하고, 금칙어는 가린다(마스킹).
 *
 * 사용자 작성 경로(contentGuard preHandler) 처리 흐름:
 *  1. request.body에서 텍스트를 추출 (Tiptap JSON 또는 plain text 모두 지원)
 *  2. detectSpam → 위반 시 422 FORBIDDEN_CONTENT (스팸 링크는 하드 차단 유지)
 *  3. getSiteSetting('forbidden_words') → request.body의 텍스트 필드를
 *     maskForbiddenWord로 in-place 치환 (글은 등록되되 금칙어만 '*'로 가림)
 *
 * 금칙어 처리 정책(2026-07): 글 등록 자체를 막던 하드 차단을 폐기하고
 * 네이버 댓글 방식의 자동 마스킹으로 전환. 사용자는 정상 등록되며 저장 값에서
 * 금칙어만 같은 길이의 '*'로 치환된다. (봇 경로 runContentGuard는 별개로,
 * 금칙어 포함 시 초안을 폐기/재생성하므로 종전대로 차단 판정을 유지한다.)
 *
 * Tiptap JSON body 처리:
 *  - body.content 또는 body.contentJson이 객체인 경우: text 노드 재귀 처리
 *  - 문자열인 경우: 그대로 처리
 *  - title·summary 등 평문 필드도 함께 처리
 *  - body 자체가 없거나 텍스트가 비어 있으면 통과 (방어적 처리)
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { detectForbiddenWord, detectSpam, maskForbiddenWord } from "@ai-jakdang/core";
import { getSiteSetting } from "../lib/siteSettings.js";

// ── Tiptap 노드 텍스트 추출 ──────────────────────────────────────────────────

type TiptapNode = {
  type?: string;
  text?: string;
  content?: TiptapNode[];
};

/**
 * Tiptap JSON 노드 트리에서 text 노드 값을 재귀로 추출해 이어붙인다.
 */
function extractTextFromTiptap(node: TiptapNode): string {
  if (!node || typeof node !== "object") return "";

  const parts: string[] = [];

  if (node.type === "text" && typeof node.text === "string") {
    parts.push(node.text);
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      parts.push(extractTextFromTiptap(child));
    }
  }

  return parts.join(" ");
}

/**
 * request.body에서 사람이 작성한 텍스트를 추출한다.
 *
 * 지원하는 body 구조:
 *  - { content: string }           → 댓글(plain text)
 *  - { content: object }           → Tiptap JSON (posts)
 *  - { contentJson: object }       → Tiptap JSON (qna/questions, qna/answers)
 *  - { title: string }             → 제목도 함께 검사
 */
function extractBodyText(body: unknown): string {
  if (!body || typeof body !== "object") return "";

  const b = body as Record<string, unknown>;
  const parts: string[] = [];

  // 제목 검사
  if (typeof b.title === "string") {
    parts.push(b.title);
  }

  // contentJson (Tiptap JSON) — qna
  if (b.contentJson !== undefined) {
    if (typeof b.contentJson === "object" && b.contentJson !== null) {
      parts.push(extractTextFromTiptap(b.contentJson as TiptapNode));
    } else if (typeof b.contentJson === "string") {
      parts.push(b.contentJson);
    }
  }

  // content — posts(Tiptap JSON) 또는 comments(plain string)
  if (b.content !== undefined) {
    if (typeof b.content === "object" && b.content !== null) {
      parts.push(extractTextFromTiptap(b.content as TiptapNode));
    } else if (typeof b.content === "string") {
      parts.push(b.content);
    }
  }

  return parts.join(" ");
}

// ── 금칙어 마스킹 (in-place) ──────────────────────────────────────────────────

/**
 * Tiptap 노드 트리의 text 노드를 금칙어 마스킹으로 in-place 치환한다.
 * (참고: 금칙어가 서로 다른 text 노드에 걸쳐 쪼개진 경우는 노드 단위라 미탐 가능)
 */
function maskTiptapInPlace(node: TiptapNode, wordList: string[]): void {
  if (!node || typeof node !== "object") return;
  if (node.type === "text" && typeof node.text === "string") {
    node.text = maskForbiddenWord(node.text, wordList);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) maskTiptapInPlace(child, wordList);
  }
}

/**
 * request.body의 텍스트 필드(title·summary·content·contentJson)를
 * 금칙어 마스킹으로 in-place 치환한다. preHandler 이후 핸들러는 가려진 값을 저장한다.
 * (Fastify 검증은 preHandler 이전에 끝나므로 '*' 치환이 스키마를 깨지 않는다.)
 */
function maskBodyInPlace(body: unknown, wordList: string[]): void {
  if (!body || typeof body !== "object" || wordList.length === 0) return;
  const b = body as Record<string, unknown>;

  if (typeof b.title === "string") b.title = maskForbiddenWord(b.title, wordList);
  if (typeof b.summary === "string") b.summary = maskForbiddenWord(b.summary, wordList);

  for (const key of ["contentJson", "content"] as const) {
    const val = b[key];
    if (typeof val === "string") {
      b[key] = maskForbiddenWord(val, wordList);
    } else if (val && typeof val === "object") {
      maskTiptapInPlace(val as TiptapNode, wordList);
    }
  }
}

// ── ContentGuardResult 판별 유니온 ───────────────────────────────────────────

/**
 * runContentGuard 반환 타입.
 *
 * ok: true  → 통과
 * ok: false → 차단 (code: "SPAM" | "FORBIDDEN_WORD" | string, message 필수, reason 선택)
 *
 * 봇 경로(Story 11.4)·파이프라인(Story 11.9/11.10)에서 import해 재사용한다.
 */
export type ContentGuardResult =
  | { ok: true }
  | { ok: false; code: "SPAM" | "FORBIDDEN_WORD" | string; message: string; reason?: string };

// ── 핵심 검사 함수 ────────────────────────────────────────────────────────────

/**
 * 텍스트를 받아 스팸·금칙어를 검사하고 결과를 ContentGuardResult 로 반환한다.
 *
 * - 빈 텍스트는 통과 (preHandler와 봇 경로 모두 동일)
 * - DB/Redis 장애는 호출자가 try/catch로 처리해야 한다 (이 함수는 throw)
 *
 * 봇이 preHandler를 거치지 않고 직접 호출하는 공용 API.
 */
export async function runContentGuard(
  text: string,
  options?: { allowManyUrls?: boolean },
): Promise<ContentGuardResult> {
  // 빈 텍스트는 통과 (방어적 처리)
  if (!text.trim()) return { ok: true };

  // ── 스팸 링크 검사 ──────────────────────────────────────────────────────────
  // allowManyUrls: 실전자료 큐레이션 등 출처 링크가 여러 개인 정당한 글에서
  // "URL 4개 이상" 조건만 예외 처리한다(단축·광고 도메인 차단은 유지).
  if (detectSpam(text, { allowManyUrls: options?.allowManyUrls })) {
    return {
      ok: false,
      code: "SPAM",
      message: "스팸으로 의심되는 내용입니다.",
      reason: "spam_pattern",
    };
  }

  // ── 금칙어 검사 ────────────────────────────────────────────────────────────
  const forbiddenWords = await getSiteSetting<string[]>("forbidden_words");
  const wordList = Array.isArray(forbiddenWords) ? forbiddenWords : [];

  if (detectForbiddenWord(text, wordList)) {
    return {
      ok: false,
      code: "FORBIDDEN_WORD",
      message: "허용되지 않는 단어가 포함되어 있습니다.",
      reason: "forbidden_word",
    };
  }

  return { ok: true };
}

// ── 봇 경로용: 스팸 차단 + 금칙어 마스킹 ──────────────────────────────────────

/**
 * 봇 생성물 전용 콘텐츠 가드 — 스팸 링크만 하드 차단하고 금칙어는 마스킹한다.
 *
 * 사용자 작성 경로(contentGuard preHandler)와 동일한 정책(2026-07: 마스킹 전환)을
 * 봇 경로에도 적용한다. 종전에는 봇이 금칙어를 포함하면 초안 전체를 blocked 처리해
 * (실제로는 정상적인 글도) 게시가 막혔다. 이제 스팸이 아니면 금칙어만 '*'로 가리고
 * 게시를 허용한다.
 *
 * doc(Tiptap 문서)는 in-place로 마스킹되고, 마스킹된 title 문자열이 반환된다.
 *
 * @returns 스팸이면 { ok:false, code:"SPAM" }, 아니면 { ok:true, title: 마스킹된 제목 }
 */
export async function guardBotContentWithMasking(params: {
  /** 스팸 검사에 쓸 평문(제목+본문 이어붙인 텍스트) */
  text: string;
  /** in-place로 금칙어 마스킹할 Tiptap 문서 (선택) */
  doc?: Record<string, unknown> | null;
  /** 마스킹 대상 제목 (선택) */
  title?: string;
}): Promise<
  | { ok: true; title: string }
  | { ok: false; code: "SPAM"; message: string; reason: string }
> {
  const { text, doc, title = "" } = params;

  // 스팸 링크는 봇 경로에서도 하드 차단 유지.
  if (detectSpam(text)) {
    return {
      ok: false,
      code: "SPAM",
      message: "스팸으로 의심되는 내용입니다.",
      reason: "spam_pattern",
    };
  }

  // 금칙어는 차단하지 않고 마스킹.
  const forbiddenWords = await getSiteSetting<string[]>("forbidden_words");
  const wordList = Array.isArray(forbiddenWords) ? forbiddenWords : [];
  let maskedTitle = title;
  if (wordList.length > 0) {
    if (doc) maskTiptapInPlace(doc as TiptapNode, wordList);
    maskedTitle = maskForbiddenWord(title, wordList);
  }

  return { ok: true, title: maskedTitle };
}

// ── preHandler 훅 ────────────────────────────────────────────────────────────

/**
 * 사용자 작성 경로용 Fastify preHandler.
 *
 * - 스팸 링크: 위반 시 422 { error: { code, message } } 반환 (하드 차단 유지).
 * - 금칙어: 차단하지 않고 request.body의 텍스트 필드를 in-place 마스킹 → 통과.
 * - body가 없거나 텍스트가 비어 있으면 통과. DB/Redis 장애 시도 통과 (가용성 우선).
 *
 * 사용 라우트: POST /comments, POST /posts, POST /qna/questions, POST /qna/answers
 */
export async function contentGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const text = extractBodyText(request.body);
    if (!text.trim()) return;

    // ── 스팸 링크: 하드 차단 유지 ────────────────────────────────────────────
    if (detectSpam(text)) {
      await reply.status(422).send({
        error: {
          code: "FORBIDDEN_CONTENT",
          message: "스팸으로 의심되는 내용입니다.",
        },
      });
      return;
    }

    // ── 금칙어: 차단 대신 마스킹 (글은 등록, 단어만 '*'로 가림) ───────────────
    const forbiddenWords = await getSiteSetting<string[]>("forbidden_words");
    const wordList = Array.isArray(forbiddenWords) ? forbiddenWords : [];
    if (wordList.length > 0) {
      maskBodyInPlace(request.body, wordList);
    }
  } catch {
    // DB/Redis 장애 시 통과 (가용성 우선)
  }
}
