/**
 * 봇 작성 서비스 — Story 11.4
 *
 * 봇 페르소나가 게시글·댓글·대댓글·Q&A 질문·실전자료를 작성할 때
 * 기존 도메인 서비스와 동일한 경로를 거쳐 모든 부수효과를 보장한다.
 *
 * 절대 규칙 (ARCHITECTURE §0):
 *  - DB 직접 INSERT 금지 (콘텐츠 테이블: posts, comments, questions, resources)
 *  - 모든 콘텐츠 작성은 기존 도메인 서비스 경유 (slug·summary·포인트·OG 잡 동일 처리)
 *  - bot_generation_jobs / bot_activity_log UPDATE/INSERT 는 메타데이터 갱신이므로 허용
 *
 * 재사용 경로:
 *  - 게시글 → apps/api/src/routes/v1/posts/service.ts createPost()
 *  - 댓글·대댓글 → apps/api/src/routes/v1/comments/service.ts createComment()
 *  - Q&A 질문 → apps/api/src/routes/v1/qna/write.service.ts createQuestion()
 *  - 실전자료 → apps/api/src/routes/v1/resources/write.service.ts createResource()
 *  - ContentGuard → apps/api/src/middleware/contentGuard.ts runContentGuard()
 */

import { getDb, schema, type Database } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import type { CreatePostInput, CreativeSpec, RecruitPost } from "@ai-jakdang/contracts";
import { createPost } from "../../routes/v1/posts/service.js";
import { createComment } from "../../routes/v1/comments/service.js";
import { createQuestion } from "../../routes/v1/qna/write.service.js";
import { createResource } from "../../routes/v1/resources/write.service.js";
import { uploadResourceFiles } from "../../routes/v1/resources/upload.service.js";
import { runContentGuard } from "../../middleware/contentGuard.js";
import { notifyBotPublish } from "./telegram-notify.js";
import { fetchCuratedResourceFile } from "./resource-file-fetch.js";
import type { CuratedFileSource } from "@ai-jakdang/server-bot/search";

// ── Tiptap 텍스트 추출 ────────────────────────────────────────────────────────
// contentGuard.ts의 동일 로직 로컬 복제 (export 없어 직접 import 불가).
// 게시글·질문·실전자료 본문의 text 노드를 재귀로 이어붙여 ContentGuard에 전달한다.

type TiptapNode = {
  type?: string;
  text?: string;
  content?: TiptapNode[];
};

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

// ── 입력 타입 ─────────────────────────────────────────────────────────────────

/** createPostAsBot 입력 */
export interface CreatePostAsBotInput {
  /** 봇 user_id (users.is_bot=true 보장 — 11.5 ensureBotUser 계약) */
  botUserId: string;
  /** bot_personas.id — 활동 로그 기록에 사용 */
  personaId: string;
  /** bot_generation_jobs.id — 잡 상태 업데이트에 사용 */
  jobId: string;
  /** 게시글 작성 입력 (createPost 도메인 서비스와 동일 형태) */
  postInput: CreatePostInput & {
    /** 봇은 항상 published (초안 없음) */
    status?: "published";
    creativeSpec?: CreativeSpec;
    recruitPost?: RecruitPost;
  };
  /**
   * 금칙어 하드 차단 건너뛰기 (스팸 링크만 검사).
   * 관리자 저작·검토를 거친 신뢰 콘텐츠(커리큘럼 강의 발행)에서, 부분문자열
   * 매칭으로 "비밀번호로"가 금칙어 "호로"에 오탐되어 막히는 것을 방지한다.
   */
  skipForbiddenGuard?: boolean;
}

/** createCommentAsBot 입력 */
export interface CreateCommentAsBotInput {
  botUserId: string;
  personaId: string;
  jobId: string;
  targetType: "post" | "question" | "answer" | "resource" | "comment";
  targetId: string;
  content: string;
}

/** createReplyAsBot 입력 (parentId 필수) */
export interface CreateReplyAsBotInput extends CreateCommentAsBotInput {
  /** 부모 댓글 ID — 필수. createComment 내부에서 2단계 중첩 차단 */
  parentId: string;
}

/**
 * createQuestionAsBot 입력.
 * questionInput 필드는 createQuestion() (apps/api/src/routes/v1/qna/write.service.ts)
 * CreateQuestionParams 와 동일 형태 (userId 제외 — botUserId 로 대체).
 */
export interface CreateQuestionAsBotInput {
  botUserId: string;
  personaId: string;
  jobId: string;
  questionInput: {
    title: string;
    contentJson: Record<string, unknown>;
    tags?: string[];
    /** 봇은 항상 published */
    status?: "published" | "draft";
  };
}

/**
 * createResourceAsBot 입력.
 * resourceInput 필드는 CreateResourceInput (packages/contracts/src/resource.ts) 과 동일 형태.
 * copyrightAgreed 는 항상 true (봇 운영자 동의 전제) — 호출자가 전달하지 않아도 됨.
 *
 * fileSource(선택): 실전자료 큐레이션에서 발굴한 원본 파일(GitHub 저장소 등)을 받아
 *   다운로드 가능하게 첨부한다. 지정 시 자료 생성 후 파일을 내려받아 uploadResourceFiles로
 *   S3 저장 + ClamAV 스캔 큐에 태운다(best-effort — 실패해도 글은 게시 유지).
 */
export interface CreateResourceAsBotInput {
  botUserId: string;
  personaId: string;
  jobId: string;
  resourceInput: {
    title: string;
    summary: string;
    resourceType: "prompt" | "claude-code-skill" | "mcp" | "rules-config" | "template-checklist";
    environment: string[];
    difficulty: "beginner" | "intermediate" | "advanced";
    /** Tiptap JSON */
    descriptionJson: Record<string, unknown>;
    /** Tiptap JSON */
    usageJson: Record<string, unknown>;
    cautionJson?: Record<string, unknown>;
    version?: string;
    referenceLinks?: { label: string; url: string }[];
    tags?: string[];
    /** 봇은 항상 published */
    status?: "published" | "draft";
  };
  /** 큐레이션 원본 파일 다운로드 소스(있으면 자료에 파일 첨부). */
  fileSource?: CuratedFileSource | null;
}

/** 모든 botWriteXxx 함수의 반환 타입 */
export interface BotWriteResult {
  /** 게시 성공 = 'published', contentGuard 차단 = 'blocked' */
  status: "published" | "blocked";
  /** 게시 성공 시 post/comment/question/resource id */
  refId?: string;
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/**
 * contentGuard 차단 시 처리:
 * 1) bot_generation_jobs.status = 'blocked' 업데이트
 * 2) bot_activity_log에 blocked 이벤트 기록
 */
async function handleBlocked(
  db: Database,
  opts: { personaId: string; jobId: string },
  reason: string,
): Promise<BotWriteResult> {
  const { personaId, jobId } = opts;

  await db
    .update(schema.botGenerationJobs)
    .set({ status: "blocked", updatedAt: new Date() })
    .where(eq(schema.botGenerationJobs.id, jobId));

  await db.insert(schema.botActivityLog).values({
    personaId,
    eventType: "blocked",
    refId: jobId,
    payload: { reason, jobId },
  });

  return { status: "blocked" };
}

/**
 * 예외 발생 시 처리:
 * 1) bot_generation_jobs.status = 'discarded' 업데이트 (실패해도 원 에러 전파)
 * 2) 원 에러를 재throw — 파이프라인이 재시도 결정을 내릴 수 있도록
 */
async function handleFailed(
  db: Database,
  jobId: string,
  error: unknown,
): Promise<never> {
  try {
    await db
      .update(schema.botGenerationJobs)
      .set({ status: "discarded", updatedAt: new Date() })
      .where(eq(schema.botGenerationJobs.id, jobId));
  } catch (innerErr) {
    console.error(
      "[bot-write] 잡 discarded 업데이트 실패 (무시):",
      (innerErr as Error).message,
    );
  }
  throw error;
}

// ── createPostAsBot ───────────────────────────────────────────────────────────

/**
 * 봇이 게시글을 작성한다.
 *
 * 내부에서 createPost() 를 호출하므로 slug·summary·썸네일·태그·첨부·포인트·OG 잡 등
 * 사람이 작성하는 것과 완전히 동일한 부수효과가 적용된다.
 *
 * - 공지사항 게시 불가 (ARCHITECTURE §3, EPICS-AND-STORIES Story 11.9 AC#6)
 * - contentGuard 차단 시 published 없이 blocked 상태 반환
 */
export async function createPostAsBot(
  input: CreatePostAsBotInput,
): Promise<BotWriteResult> {
  const { botUserId, personaId, jobId, postInput } = input;

  // ── 공지사항 게시 방어 가드 ────────────────────────────────────────────────
  if (postInput.board === "notice") {
    throw new Error("[bot-write] 봇은 공지사항 게시판에 글을 작성할 수 없습니다.");
  }

  const db = getDb();

  try {
    // ── ContentGuard: 제목 + 본문 텍스트 추출 → 검사 ──────────────────────────
    const titleText = postInput.title ?? "";
    const bodyText = postInput.contentJson
      ? extractTextFromTiptap(postInput.contentJson as unknown as TiptapNode)
      : "";
    const text = [titleText, bodyText].filter(Boolean).join(" ");

    const guardResult = await runContentGuard(text, {
      spamOnly: input.skipForbiddenGuard,
    });
    if (!guardResult.ok) {
      return await handleBlocked(
        db,
        { personaId, jobId },
        guardResult.code ?? "FORBIDDEN_CONTENT",
      );
    }

    // ── 게시글 작성 — 도메인 서비스 경유 (DB 직접 INSERT 금지) ────────────────
    const post = await createPost({
      input: { ...postInput, status: postInput.status ?? "published" },
      userId: botUserId,
    });

    // ── 성공: 잡 상태 published 업데이트 + 활동 로그 ─────────────────────────
    await db
      .update(schema.botGenerationJobs)
      .set({ status: "published", publishedPostId: post.id, updatedAt: new Date() })
      .where(eq(schema.botGenerationJobs.id, jobId));

    await db.insert(schema.botActivityLog).values({
      personaId,
      eventType: "post.published",
      refId: post.id,
      payload: { jobId, board: post.board },
    });

    // 텔레그램 간단 알림 (fire-and-forget — 게시 흐름 비차단)
    notifyBotPublish({ personaId, kind: "post", board: post.board, title: postInput.title });

    return { status: "published", refId: post.id };
  } catch (err) {
    return await handleFailed(db, jobId, err);
  }
}

// ── createCommentAsBot ────────────────────────────────────────────────────────

/**
 * 봇이 댓글을 작성한다.
 *
 * 내부에서 createComment() 를 호출하므로 포인트 적립·알림 발행이
 * 사람이 작성하는 것과 동일하게 적용된다.
 */
export async function createCommentAsBot(
  input: CreateCommentAsBotInput,
): Promise<BotWriteResult> {
  const { botUserId, personaId, jobId, targetType, targetId, content } = input;
  const db = getDb();

  try {
    // ── ContentGuard ──────────────────────────────────────────────────────────
    const guardResult = await runContentGuard(content);
    if (!guardResult.ok) {
      return await handleBlocked(
        db,
        { personaId, jobId },
        guardResult.code ?? "FORBIDDEN_CONTENT",
      );
    }

    // ── 댓글 작성 — 도메인 서비스 경유 ─────────────────────────────────────────
    const comment = await createComment({
      userId: botUserId,
      targetType,
      targetId,
      content,
    });

    // ── 성공: 잡 상태 published 업데이트 + 활동 로그 ─────────────────────────
    await db
      .update(schema.botGenerationJobs)
      .set({
        status: "published",
        publishedCommentId: comment.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.botGenerationJobs.id, jobId));

    await db.insert(schema.botActivityLog).values({
      personaId,
      eventType: "comment.published",
      refId: comment.id,
      payload: { jobId, targetType, targetId },
    });

    notifyBotPublish({ personaId, kind: "comment" });

    return { status: "published", refId: comment.id };
  } catch (err) {
    return await handleFailed(db, jobId, err);
  }
}

// ── createReplyAsBot ──────────────────────────────────────────────────────────

/**
 * 봇이 대댓글을 작성한다.
 *
 * parentId 가 필수. createComment() 내부에서 2단계 이상 대댓글을 차단한다
 * (NESTING_NOT_ALLOWED 에러 → catch → handleFailed).
 */
export async function createReplyAsBot(
  input: CreateReplyAsBotInput,
): Promise<BotWriteResult> {
  const { botUserId, personaId, jobId, targetType, targetId, content, parentId } = input;

  // ── parentId 필수 검증 ─────────────────────────────────────────────────────
  if (!parentId) {
    throw new Error("[bot-write] createReplyAsBot: parentId 는 필수입니다.");
  }

  const db = getDb();

  try {
    // ── ContentGuard ──────────────────────────────────────────────────────────
    const guardResult = await runContentGuard(content);
    if (!guardResult.ok) {
      return await handleBlocked(
        db,
        { personaId, jobId },
        guardResult.code ?? "FORBIDDEN_CONTENT",
      );
    }

    // ── 대댓글 작성 — 도메인 서비스 경유 ───────────────────────────────────────
    const comment = await createComment({
      userId: botUserId,
      targetType,
      targetId,
      content,
      parentId,
    });

    // ── 성공: 잡 상태 published 업데이트 + 활동 로그 ─────────────────────────
    await db
      .update(schema.botGenerationJobs)
      .set({
        status: "published",
        publishedCommentId: comment.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.botGenerationJobs.id, jobId));

    await db.insert(schema.botActivityLog).values({
      personaId,
      eventType: "comment.published",
      refId: comment.id,
      payload: { jobId, targetType, targetId, parentId, isReply: true },
    });

    notifyBotPublish({ personaId, kind: "reply" });

    return { status: "published", refId: comment.id };
  } catch (err) {
    return await handleFailed(db, jobId, err);
  }
}

// ── createQuestionAsBot ───────────────────────────────────────────────────────

/**
 * 봇이 Q&A 질문을 작성한다.
 *
 * 내부에서 createQuestion() (Epic3 Q&A 질문 생성 도메인 서비스) 를 호출하므로
 * slug·태그·OG 잡 발행이 사람이 작성하는 것과 동일하게 적용된다.
 */
export async function createQuestionAsBot(
  input: CreateQuestionAsBotInput,
): Promise<BotWriteResult> {
  const { botUserId, personaId, jobId, questionInput } = input;
  const db = getDb();

  try {
    // ── ContentGuard: 제목 + 본문 텍스트 추출 → 검사 ──────────────────────────
    const titleText = questionInput.title ?? "";
    const bodyText = questionInput.contentJson
      ? extractTextFromTiptap(questionInput.contentJson as unknown as TiptapNode)
      : "";
    const text = [titleText, bodyText].filter(Boolean).join(" ");

    const guardResult = await runContentGuard(text);
    if (!guardResult.ok) {
      return await handleBlocked(
        db,
        { personaId, jobId },
        guardResult.code ?? "FORBIDDEN_CONTENT",
      );
    }

    // ── 질문 작성 — Q&A 도메인 서비스 경유 ─────────────────────────────────────
    const question = await createQuestion({
      title: questionInput.title,
      contentJson: questionInput.contentJson,
      tags: questionInput.tags ?? [],
      status: questionInput.status ?? "published",
      userId: botUserId,
    });

    // ── 성공: 잡 상태 published 업데이트 + 활동 로그 (kind='question') ─────────
    await db
      .update(schema.botGenerationJobs)
      .set({ status: "published", publishedPostId: question.id, updatedAt: new Date() })
      .where(eq(schema.botGenerationJobs.id, jobId));

    await db.insert(schema.botActivityLog).values({
      personaId,
      eventType: "post.published",
      refId: question.id,
      payload: { jobId, kind: "question", slug: question.slug },
    });

    notifyBotPublish({ personaId, kind: "question", title: questionInput.title });

    return { status: "published", refId: question.id };
  } catch (err) {
    return await handleFailed(db, jobId, err);
  }
}

// ── createResourceAsBot ───────────────────────────────────────────────────────

/**
 * 봇이 실전자료를 작성한다.
 *
 * 내부에서 createResource() (Epic4 실전자료 생성 도메인 서비스) 를 호출하므로
 * slug·태그·썸네일·포인트가 사람이 작성하는 것과 동일하게 적용된다.
 *
 * 봇은 외부 파일 업로드가 어려우므로 본문 위주 자료만 작성한다
 * (Story 4c.3: 파일 첨부 없음, copyrightAgreed=true 고정).
 */
export async function createResourceAsBot(
  input: CreateResourceAsBotInput,
): Promise<BotWriteResult> {
  const { botUserId, personaId, jobId, resourceInput, fileSource } = input;
  const db = getDb();

  try {
    // ── ContentGuard: 제목 + 설명 본문 텍스트 추출 → 검사 ─────────────────────
    const titleText = resourceInput.title ?? "";
    const bodyText = resourceInput.descriptionJson
      ? extractTextFromTiptap(
          resourceInput.descriptionJson as unknown as TiptapNode,
        )
      : "";
    const text = [titleText, bodyText].filter(Boolean).join(" ");

    // 실전자료 큐레이션은 출처·참고 링크가 정당하게 여러 개 들어간다.
    // "URL 4개 이상 = 스팸" 하드 차단만 예외 처리한다(단축·광고 도메인 차단은 유지).
    const guardResult = await runContentGuard(text, { allowManyUrls: true });
    if (!guardResult.ok) {
      return await handleBlocked(
        db,
        { personaId, jobId },
        guardResult.code ?? "FORBIDDEN_CONTENT",
      );
    }

    // ── 실전자료 작성 — 실전자료 도메인 서비스 경유 ─────────────────────────────
    // copyrightAgreed=true 고정: 봇 운영자가 동의한 것으로 간주 (Story 4c.3)
    const resource = await createResource({
      input: {
        title: resourceInput.title,
        summary: resourceInput.summary,
        resourceType: resourceInput.resourceType,
        environment: resourceInput.environment,
        difficulty: resourceInput.difficulty,
        descriptionJson: resourceInput.descriptionJson,
        usageJson: resourceInput.usageJson,
        cautionJson: resourceInput.cautionJson,
        version: resourceInput.version,
        referenceLinks: resourceInput.referenceLinks,
        copyrightAgreed: true,
        tags: resourceInput.tags ?? [],
        status: resourceInput.status ?? "published",
      },
      userId: botUserId,
    });

    // ── 원본 파일 첨부(큐레이션) — best-effort ────────────────────────────────
    // fileSource가 있으면 원본(GitHub 저장소 zip 등)을 받아 사람 업로드와 동일한
    // 경로(uploadResourceFiles)로 S3 저장 + ClamAV 스캔 큐에 태운다. 스캔이 clean이
    // 되면 다운로드가 열린다. 첨부 실패는 무시하고 글은 그대로 게시 유지한다.
    if (fileSource) {
      try {
        const file = await fetchCuratedResourceFile(fileSource);
        if (file) {
          await uploadResourceFiles(resource.id, [file]);
          console.info(
            `[bot/write] 자료 파일 첨부: ${resource.slug} ← ${file.originalName} (${file.size} bytes)`,
          );
        } else {
          console.info(
            `[bot/write] 자료 파일 첨부 생략(비지원 소스·다운로드 실패): ${resource.slug}`,
          );
        }
      } catch (err) {
        console.error(
          "[bot/write] 자료 파일 첨부 실패(무시, 글은 게시 유지):",
          (err as Error).message,
        );
      }
    }

    // ── 성공: 잡 상태 published 업데이트 + 활동 로그 (kind='resource') ──────────
    await db
      .update(schema.botGenerationJobs)
      .set({ status: "published", publishedPostId: resource.id, updatedAt: new Date() })
      .where(eq(schema.botGenerationJobs.id, jobId));

    await db.insert(schema.botActivityLog).values({
      personaId,
      eventType: "post.published",
      refId: resource.id,
      payload: {
        jobId,
        kind: "resource",
        resourceType: resource.resourceType,
        slug: resource.slug,
      },
    });

    notifyBotPublish({ personaId, kind: "resource", title: resourceInput.title });

    return { status: "published", refId: resource.id };
  } catch (err) {
    return await handleFailed(db, jobId, err);
  }
}
