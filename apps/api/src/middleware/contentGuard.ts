/**
 * contentGuard — Fastify preHandler 미들웨어 (Story 9.11, AC #3·#4).
 *
 * 콘텐츠 작성 API(POST /posts, POST /qna/questions, POST /qna/answers,
 * POST /comments)에 걸어 금칙어·스팸 링크를 사전 차단한다.
 *
 * 처리 흐름:
 *  1. request.body에서 텍스트를 추출 (Tiptap JSON 또는 plain text 모두 지원)
 *  2. getSiteSetting('forbidden_words') → detectForbiddenWord 검사
 *  3. detectSpam 검사
 *  4. 하나라도 위반 시 → 422 FORBIDDEN_CONTENT
 *
 * Tiptap JSON body 처리:
 *  - body.content 또는 body.contentJson이 객체인 경우: text 노드만 재귀 추출
 *  - 문자열인 경우: 그대로 사용
 *  - 두 필드 모두 없거나 body 자체가 없는 경우: 통과 (방어적 처리)
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { detectForbiddenWord, detectSpam } from "@ai-jakdang/core";
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

// ── preHandler 훅 ────────────────────────────────────────────────────────────

/**
 * 금칙어·스팸 링크를 검사하는 Fastify preHandler.
 *
 * 위반 시 422 { error: { code: "FORBIDDEN_CONTENT", message: "..." } } 반환.
 * body가 없거나 텍스트 추출 결과가 비어 있는 경우에는 통과한다.
 */
export async function contentGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const text = extractBodyText(request.body);

    // 텍스트가 없으면 검사 생략 (방어적 처리)
    if (!text.trim()) return;

    // ── 스팸 링크 검사 ─────────────────────────────────────────────────────
    if (detectSpam(text)) {
      await reply.status(422).send({
        error: {
          code: "FORBIDDEN_CONTENT",
          message: "허용되지 않는 내용이 포함되어 있습니다.",
        },
      });
      return;
    }

    // ── 금칙어 검사 ────────────────────────────────────────────────────────
    const forbiddenWords = await getSiteSetting<string[]>("forbidden_words");
    const wordList = Array.isArray(forbiddenWords) ? forbiddenWords : [];

    if (detectForbiddenWord(text, wordList)) {
      await reply.status(422).send({
        error: {
          code: "FORBIDDEN_CONTENT",
          message: "허용되지 않는 내용이 포함되어 있습니다.",
        },
      });
      return;
    }
  } catch {
    // DB/Redis 장애 시 통과 (가용성 우선)
  }
}
